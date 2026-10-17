# advomind-backend/ai_routes.py
"""
AI case summarizer.

Gathers everything already tracked in Advomind for a case - description,
diary notes, detail notes, hearing notes - and asks Gemini to produce a
short summary for the lawyer/secretary handling it. The summary is cached
directly on the case (or archive) document so it doesn't regenerate on
every page view, only when explicitly requested again.

Calls Gemini's REST API directly with `requests` rather than the
google-generativeai SDK - the SDK can pick up ambient Google Cloud
credentials (e.g. from the Firebase Admin service account already used
elsewhere in this project) and try to use those instead of the API key,
which fails with a confusing 401 ACCESS_TOKEN_TYPE_UNSUPPORTED error.
Calling the REST endpoint directly avoids that entirely.

Does NOT read uploaded file contents yet - that needs OCR first, which is
a planned follow-up, not part of this.
"""

import os
import time
from datetime import datetime

import requests
from flask import Blueprint, request, jsonify

from firebase_admin_setup import get_admin_auth, get_admin_db

ai_bp = Blueprint("ai", __name__, url_prefix="/ai")

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-3.8-flash"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"


def _err(message, status=400):
    return jsonify({"error": message}), status


def _verify_caller():
    """Returns (uid, profile, None) on success, or (None, None, error_response)."""
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None, None, _err("Missing Authorization header", 401)

    id_token = header.split(" ", 1)[1]

    try:
        decoded = get_admin_auth().verify_id_token(id_token, clock_skew_seconds=10)
    except Exception:
        return None, None, _err("Invalid or expired token", 401)

    uid = decoded["uid"]
    db = get_admin_db()
    profile_snap = db.collection("users").document(uid).get()

    if not profile_snap.exists:
        return None, None, _err("No profile found for this account", 403)

    return uid, profile_snap.to_dict(), None


def _has_case_access(uid, profile, case_data):
    """Mirrors the Firestore security rules' access logic, since the Admin
    SDK bypasses those rules entirely and this has to re-check by hand."""
    role = profile.get("role")
    owner_id = case_data.get("userId")

    if role == "lawyer":
        my_owner_id = uid
    elif role == "secretary":
        my_owner_id = profile.get("lawyerId")
    else:
        return False

    if owner_id != my_owner_id:
        return False

    court = case_data.get("court_type")

    if role == "secretary":
        if profile.get("disabled"):
            return False
        if court not in (profile.get("assignedCourts") or []):
            return False

    assigned_to = case_data.get("assignedTo")
    if assigned_to and role == "secretary" and assigned_to != uid:
        return False

    return True


def _find_case(db, case_id):
    """Checks the live 'cases' collection first, then 'archive' as a
    fallback - mirrors the frontend's own archived-case fallback logic."""
    snap = db.collection("cases").document(case_id).get()
    if snap.exists:
        return snap.reference, snap.to_dict()

    archive_matches = db.collection("archive").where("originalCaseId", "==", case_id).limit(1).stream()
    for a in archive_matches:
        return a.reference, a.to_dict()

    return None, None


def _gather_case_text(db, case_id, case_data):
    parts = [
        f"Case title: {case_data.get('title', 'Untitled')}",
        f"Status: {case_data.get('status', 'Unknown')}",
    ]

    if case_data.get("description"):
        parts.append(f"Description: {case_data['description']}")

    owner_id = case_data.get("userId")
    client_id = case_data.get("client_id")
    if owner_id and client_id:
        client_snap = db.collection("users").document(owner_id).collection("clients").document(client_id).get()
        if client_snap.exists:
            parts.append(f"Client: {client_snap.to_dict().get('name', 'Unknown')}")

    detail_notes = db.collection("detailsNotes").where("case_id", "==", case_id).stream()
    detail_texts = [f"- {d.to_dict().get('title', '')}: {d.to_dict().get('body', '')}" for d in detail_notes]
    if detail_texts:
        parts.append("Case details:\n" + "\n".join(detail_texts))

    diary_notes = db.collection("diaryNotes").where("case_id", "==", case_id).stream()
    diary_texts = [f"- {d.to_dict().get('title', '')}: {d.to_dict().get('body', '')}" for d in diary_notes]
    if diary_texts:
        parts.append("Diary notes:\n" + "\n".join(diary_texts))

    hearings = list(db.collection("hearings").where("case_id", "==", case_id).stream())
    hearings_sorted = sorted(hearings, key=lambda h: h.to_dict().get("date", ""))
    hearing_texts = []
    for h in hearings_sorted:
        hd = h.to_dict()
        line = f"- {hd.get('date', '')}: {hd.get('event', '')}"
        if hd.get("notes"):
            line += f" ({hd['notes']})"
        hearing_texts.append(line)
    if hearing_texts:
        parts.append("Hearings:\n" + "\n".join(hearing_texts))

    return "\n\n".join(parts)


def _call_gemini(prompt, max_retries=3):
    """Calls Gemini's REST API directly with the API key in a header -
    never via the SDK, to avoid it silently preferring ambient Google Cloud
    credentials over the key.

    Retries on 503 (model temporarily overloaded, per Google's own error
    message this is usually transient) with a short increasing delay."""
    last_error = None

    for attempt in range(max_retries):
        response = requests.post(
            GEMINI_URL,
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": GEMINI_API_KEY,
            },
            json={
                "contents": [
                    {"parts": [{"text": prompt}]}
                ]
            },
            timeout=30,
        )

        if response.ok:
            data = response.json()
            try:
                return data["candidates"][0]["content"]["parts"][0]["text"].strip()
            except (KeyError, IndexError):
                raise RuntimeError(f"Unexpected Gemini response shape: {data}")

        last_error = f"Gemini API error {response.status_code}: {response.text}"

        if response.status_code == 503 and attempt < max_retries - 1:
            time.sleep(2 * (attempt + 1))  # 2s, then 4s
            continue

        break

    raise RuntimeError(last_error)


@ai_bp.route("/summarize-case", methods=["POST"])
def summarize_case():
    if not GEMINI_API_KEY:
        return _err("AI summarizer isn't configured yet (GEMINI_API_KEY missing on the server)", 500)

    uid, profile, error = _verify_caller()
    if error:
        return error

    data = request.get_json(silent=True) or {}
    case_id = data.get("caseId")
    if not case_id:
        return _err("caseId is required")

    db = get_admin_db()
    case_ref, case_data = _find_case(db, case_id)

    if not case_data:
        return _err("Case not found", 404)

    if not _has_case_access(uid, profile, case_data):
        return _err("You don't have access to this case", 403)

    case_text = _gather_case_text(db, case_id, case_data)

    prompt = (
        "You are helping a lawyer quickly review a case. Summarize the following case "
        "information in 3-5 short sentences: the core facts, current status, and anything "
        "that appears outstanding or needs attention. Be concise and factual. Do not invent "
        "any details not present below.\n\n" + case_text
    )

    try:
        summary_text = _call_gemini(prompt)
    except Exception as e:
        return _err(f"Summary generation failed: {e}", 500)

    generated_at = datetime.utcnow().isoformat() + "Z"

    case_ref.update({
        "aiSummary": {
            "text": summary_text,
            "generatedAt": generated_at
        }
    })

    return jsonify({"summary": summary_text, "generatedAt": generated_at}), 200