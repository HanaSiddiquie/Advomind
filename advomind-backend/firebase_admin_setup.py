# advomind-backend/firebase_admin_setup.py
"""
Firebase Admin SDK bootstrap.

This is the ONLY place in the backend that should hold privileged
Firebase credentials. Never commit the key file this points at -
it's covered by .gitignore under advomind-backend/secrets/.

Set FIREBASE_SERVICE_ACCOUNT_PATH as an env var if you want to point
somewhere else; otherwise it defaults to secrets/firebase-service-account.json
next to this file.
"""

import os
import firebase_admin
from firebase_admin import credentials, auth as admin_auth, firestore as admin_firestore

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_DEFAULT_KEY_PATH = os.path.join(_THIS_DIR, "secrets", "firebase-service-account.json")
KEY_PATH = os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH", _DEFAULT_KEY_PATH)

_app = None


def get_app():
    global _app
    if _app is None:
        if not os.path.exists(KEY_PATH):
            raise RuntimeError(
                f"Firebase service account key not found at {KEY_PATH}. "
                "Generate one in Firebase Console > Project Settings > Service "
                "Accounts, save it there, and never commit it."
            )
        cred = credentials.Certificate(KEY_PATH)
        _app = firebase_admin.initialize_app(cred)
    return _app


def get_admin_auth():
    get_app()
    return admin_auth


def get_admin_db():
    get_app()
    return admin_firestore.client()