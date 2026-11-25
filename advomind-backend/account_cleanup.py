# advomind-backend/account_cleanup.py
"""
Removes sign-ups that never verified their email, so mistyped or fake addresses don't pile up.

Only deletes an account when ALL of these are true:
  * its email is still unverified,
  * it was created after the verification rule started (older accounts are never touched),
  * it is older than UNVERIFIED_DAYS,
  * its profile says role = "lawyer" (self sign-up) - secretary accounts are never touched.
"""

import time

from firebase_admin_setup import get_admin_auth, get_admin_db

UNVERIFIED_DAYS = 3
VERIFY_FROM_MS = 1795363200000  # 2026-11-22T16:00:00Z - same moment as VERIFY_FROM in AuthRoleContext.js


def cleanup_unverified_accounts(now_ms=None):
    """Returns how many accounts were removed. Never raises (it runs inside the scheduler)."""
    removed = 0
    try:
        now_ms = now_ms or int(time.time() * 1000)
        cutoff = now_ms - UNVERIFIED_DAYS * 24 * 3600 * 1000
        auth_client = get_admin_auth()
        db = get_admin_db()

        for user in auth_client.list_users().iterate_all():
            if user.email_verified:
                continue
            created = getattr(user.user_metadata, "creation_timestamp", None)
            if not created or created < VERIFY_FROM_MS or created > cutoff:
                continue

            ref = db.collection("users").document(user.uid)
            snap = ref.get()
            if not snap.exists or (snap.to_dict() or {}).get("role") != "lawyer":
                continue

            try:
                auth_client.delete_user(user.uid)
                ref.delete()
                removed += 1
            except Exception as e:
                print(f"[cleanup] could not remove {user.uid}: {type(e).__name__}: {e}")
    except Exception as e:
        print(f"[cleanup] skipped: {type(e).__name__}: {e}")

    if removed:
        print(f"[cleanup] removed {removed} unverified sign-up(s)")
    return removed