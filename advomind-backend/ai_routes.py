# advomind-backend/ai_routes.py
"""
AI case summarizer.

Gathers everything already tracked in Advomind for a case - description,
diary notes, detail notes, hearing notes, and the extracted text of uploaded
documents - and asks Gemini to produce a short summary for the lawyer or
secretary handling it. The summary is cached directly on the case (or
archive) document so it doesn't regenerate on every page view, only when
explicitly requested again.

Uploaded-document text is only included when it's trustworthy: text-layer
PDFs and Word files are exact, and OCR'd files are used only when their
confidence is at least MIN_USABLE_OCR_CONFIDENCE. Feeding garbled OCR into
the model would produce a fluent but wrong summary, so low-confidence files
are skipped and reported back to the user instead.

Calls Gemini's REST API directly with `requests` rather than the
google-generativeai SDK - the SDK can pick up ambient Google Cloud
credentials (e.g. from the Firebase Admin service account already used
elsewhere in this project) and try to use those instead of the API key,
which fails with a confusing 401 ACCESS_TOKEN_TYPE_UNSUPPORTED error.
"""

import os
import re
import time
from datetime import datetime

import requests
from flask import Blueprint, request, jsonify

from firebase_admin_setup import get_admin_auth, get_admin_db

ai_bp = Blueprint("ai", __name__, url_prefix="/ai")

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if GEMINI_API_KEY:
    GEMINI_API_KEY = GEMINI_API_KEY.strip().strip('"').strip("'")  # forgive stray quotes/spaces
    print(f"[ai] Gemini key loaded: {GEMINI_API_KEY[:4]}...{GEMINI_API_KEY[-4:]} ({len(GEMINI_API_KEY)} chars)")
else:
    print("[ai] GEMINI_API_KEY is not set")

# Models to try, in order of preference. Google's lineup changes often, and any one
# model can be overloaded (503), out of quota (429) or retired (404) - so a request
# falls through this list instead of failing. Override with GEMINI_MODELS in .env
# (comma-separated).
GEMINI_MODELS = [
    m.strip()
    for m in os.environ.get("GEMINI_MODELS", "gemini-3.8-flash,gemini-flash-lite-latest").split(",")
    if m.strip()
]
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

# How much uploaded-document text goes into one summary request.
MAX_CHARS_PER_FILE = 6000
MAX_TOTAL_FILE_CHARS = 20000
MIN_USABLE_OCR_CONFIDENCE = 75


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


def _file_text_usable(file_data):
    """Returns (usable, reason_if_not). Only trustworthy text goes to the model."""
    text = (file_data.get("extractedText") or "").strip()

    if not text:
        return False, "text not extracted yet"

    readable = re.sub(r"--- Page \d+ ---", "", text).strip()
    if len(readable) < 20:
        return False, "no readable text was found"

    confidence = file_data.get("ocrConfidence")
    if confidence is not None and confidence < MIN_USABLE_OCR_CONFIDENCE:
        return False, f"low OCR confidence ({confidence:.0f}/100), text is probably unreliable"

    return True, None


def _gather_documents_text(db, case_id):
    """Returns (prompt_section_or_None, files_used, files_skipped)."""
    files = [f.to_dict() for f in db.collection("files").where("case_id", "==", case_id).stream()]
    files.sort(key=lambda f: f.get("createdAt", 0), reverse=True)  # newest first

    used = []
    skipped = []
    blocks = []
    budget = MAX_TOTAL_FILE_CHARS

    for fd in files:
        name = fd.get("name") or "Untitled file"
        usable, reason = _file_text_usable(fd)

        if not usable:
            skipped.append({"name": name, "reason": reason})
            continue

        if budget <= 0:
            skipped.append({"name": name, "reason": "not included (length limit reached)"})
            continue

        text = fd["extractedText"].strip()
        allowed = min(MAX_CHARS_PER_FILE, budget)
        cut = len(text) > allowed
        text = text[:allowed]
        budget -= len(text)

        notes = []
        if any("may be missing" in w for w in (fd.get("ocrWarnings") or [])):
            notes.append("may be incomplete")
        if cut:
            notes.append("truncated")

        label = f" ({', '.join(notes)})" if notes else ""
        blocks.append(f"--- Document: {name}{label} ---\n{text}")
        used.append({"name": name, "note": ", ".join(notes) or None})

    section = None
    if blocks:
        section = (
            "Uploaded documents (text was machine-extracted from files and may contain errors):\n\n"
            + "\n\n".join(blocks)
        )

    return section, used, skipped


def _gather_case_text(db, case_id, case_data):
    """Returns (text, files_used, files_skipped)."""
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

    docs_section, files_used, files_skipped = _gather_documents_text(db, case_id)
    if docs_section:
        parts.append(docs_section)

    return "\n\n".join(parts), files_used, files_skipped


def _call_gemini(prompt):
    """Returns (text, model_used). Calls Gemini's REST API directly with the key in a
    header - never via the SDK, which can silently prefer ambient Google Cloud
    credentials over the key.

    Tries each model in GEMINI_MODELS in turn:
      * 503 (overloaded): retried once on the same model, then moves on
      * 429 (quota), 404 (retired), timeouts, odd responses: moves on
      * 400/401/403 (bad key or request): stops at once - another model can't fix that"""
    failures = []

    for model in GEMINI_MODELS:
        url = f"{GEMINI_BASE}/{model}:generateContent"

        for attempt in range(2):
            try:
                response = requests.post(
                    url,
                    headers={"Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY},
                    json={"contents": [{"parts": [{"text": prompt}]}]},
                    timeout=45,
                )
            except requests.RequestException as e:
                failures.append(f"{model}: {type(e).__name__}")
                break

            if response.ok:
                try:
                    data = response.json()
                    return data["candidates"][0]["content"]["parts"][0]["text"].strip(), model
                except (KeyError, IndexError, ValueError):
                    failures.append(f"{model}: unexpected response (possibly blocked or empty)")
                    break

            code = response.status_code

            if code in (400, 401, 403):
                raise RuntimeError(f"Gemini rejected the request ({code}) on {model}: {response.text[:300]}")

            if code == 503 and attempt == 0:
                time.sleep(2)
                continue

            failures.append(f"{model}: HTTP {code}")
            break

    raise RuntimeError("All Gemini models failed - " + "; ".join(failures))


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

    case_text, files_used, files_skipped = _gather_case_text(db, case_id, case_data)

    prompt = (
        "You are helping a lawyer quickly review a case. Summarize the following case "
        "information in 4-6 short sentences: the core facts, current status, and anything "
        "that appears outstanding or needs attention. Be concise and factual. Do not invent "
        "any details not present below. Text under 'Uploaded documents' was machine-extracted "
        "and may contain errors: use it as supporting detail, and don't state anything that "
        "rests only on text that looks garbled.\n\n" + case_text
    )

    try:
                summary_text, model_used = _call_gemini(prompt)
    except Exception as e:
        return _err(f"Summary generation failed: {e}", 500)

    generated_at = datetime.utcnow().isoformat() + "Z"

    summary = {
        "text": summary_text,
        "generatedAt": generated_at,
        "filesUsed": files_used,
        "filesSkipped": files_skipped,
        "model": model_used,
    }

    case_ref.update({"aiSummary": summary})

    return jsonify({
        "summary": summary_text,
        "generatedAt": generated_at,
        "filesUsed": files_used,
        "filesSkipped": files_skipped,
        "model": model_used,
    }), 200