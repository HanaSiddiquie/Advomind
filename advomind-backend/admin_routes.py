# advomind-backend/admin_routes.py
"""
Admin-only routes for lawyer/secretary account management.

These are the ONLY endpoints in the app that need a privileged backend -
everything else in Advomind talks to Firestore directly from the client
and is enforced by firestore.rules. This exists purely because creating
a second Firebase Auth account from the client would sign the lawyer out
of their own session; the Admin SDK avoids that entirely.
"""

import secrets
import string
from functools import wraps

from flask import Blueprint, request, jsonify
from firebase_admin import auth as fb_auth
from firebase_admin._auth_utils import EmailAlreadyExistsError, UserNotFoundError

from firebase_admin_setup import get_admin_auth, get_admin_db

admin_bp = Blueprint("admin", __name__, url_prefix="/admin")

VALID_COURTS = {"civil", "session", "high"}


def _err(message, status=400):
    return jsonify({"error": message}), status


def _generate_temp_password():
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(16))


def require_lawyer(fn):
    """Verifies the Authorization: Bearer <idToken> header belongs to
    a signed-in user whose Firestore profile has role == 'lawyer'.
    Passes the lawyer's uid into the view as `lawyer_uid`."""

    @wraps(fn)
    def wrapper(*args, **kwargs):
        header = request.headers.get("Authorization", "")

        if not header.startswith("Bearer "):
            return _err("Missing Authorization header", 401)

        id_token = header.split(" ", 1)[1]

        try:
            decoded = get_admin_auth().verify_id_token(id_token, clock_skew_seconds=10)
        except Exception as e:
            print(f"[AUTH] Token verification failed: {type(e).__name__}: {e}")
            return _err("Invalid or expired token", 401)

        uid = decoded["uid"]

        db = get_admin_db()
        profile_snap = db.collection("users").document(uid).get()

        if not profile_snap.exists:
            return _err("No profile found for this account", 403)

        profile = profile_snap.to_dict()

        if profile.get("role") != "lawyer":
            return _err("Only lawyer accounts can manage secretaries", 403)

        return fn(*args, lawyer_uid=uid, **kwargs)

    return wrapper


@admin_bp.route("/create-secretary", methods=["POST"])
@require_lawyer
def create_secretary(lawyer_uid):
    data = request.get_json(silent=True) or {}

    email = (data.get("email") or "").strip().lower()
    name = (data.get("name") or "").strip()
    assigned_courts = data.get("assignedCourts") or []

    if not email or not name:
        return _err("email and name are required")

    if not assigned_courts or not isinstance(assigned_courts, list):
        return _err("assignedCourts must be a non-empty list")

    invalid = [c for c in assigned_courts if c not in VALID_COURTS]
    if invalid:
        return _err(f"Invalid court(s): {invalid}")

    admin_auth_client = get_admin_auth()
    db = get_admin_db()

    temp_password = _generate_temp_password()

    try:
        new_user = admin_auth_client.create_user(
            email=email,
            password=temp_password,
            display_name=name,
        )
    except EmailAlreadyExistsError:
        return _err("An account with this email already exists", 409)
    except Exception as e:
        return _err(f"Failed to create account: {e}", 500)

    db.collection("users").document(new_user.uid).set({
        "role": "secretary",
        "lawyerId": lawyer_uid,
        "name": name,
        "email": email,
        "assignedCourts": assigned_courts,
        "disabled": False,
        "canDelete": False,
        "createdAt": admin_firestore_now(),
    })

    return jsonify({
        "uid": new_user.uid,
        "email": email,
        "name": name,
        "assignedCourts": assigned_courts,
    }), 201


@admin_bp.route("/secretaries/<secretary_uid>/status", methods=["PATCH"])
@require_lawyer
def set_secretary_status(secretary_uid, lawyer_uid):
    data = request.get_json(silent=True) or {}

    if "disabled" not in data or not isinstance(data["disabled"], bool):
        return _err("Body must include boolean 'disabled'")

    db = get_admin_db()
    doc_ref = db.collection("users").document(secretary_uid)
    snap = doc_ref.get()

    if not snap.exists or snap.to_dict().get("lawyerId") != lawyer_uid:
        return _err("Secretary not found under your account", 404)

    admin_auth_client = get_admin_auth()

    try:
        admin_auth_client.update_user(secretary_uid, disabled=data["disabled"])
    except UserNotFoundError:
        return _err("Auth account not found", 404)

    doc_ref.update({"disabled": data["disabled"]})

    return jsonify({"uid": secretary_uid, "disabled": data["disabled"]}), 200


@admin_bp.route("/secretaries/<secretary_uid>", methods=["DELETE"])
@require_lawyer
def delete_secretary(secretary_uid, lawyer_uid):
    db = get_admin_db()
    doc_ref = db.collection("users").document(secretary_uid)
    snap = doc_ref.get()

    if not snap.exists or snap.to_dict().get("lawyerId") != lawyer_uid:
        return _err("Secretary not found under your account", 404)

    admin_auth_client = get_admin_auth()

    try:
        admin_auth_client.delete_user(secretary_uid)
    except UserNotFoundError:
        pass  # already gone from Auth, still clean up Firestore

    doc_ref.delete()

    return jsonify({"deleted": secretary_uid}), 200


def admin_firestore_now():
    from firebase_admin import firestore as admin_firestore
    return admin_firestore.SERVER_TIMESTAMP