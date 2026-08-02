# advomind-backend/backfill_assigned_to.py
"""
One-time migration: adds `assignedTo: None` to any existing case, hearing,
archive, or file document that doesn't already have the field.

Why this is needed: the new Firestore rules and frontend queries treat a
missing `assignedTo` field differently from an explicit `null` - secretaries
querying for "unassigned" docs only match documents where the field is
explicitly present and equal to null. Documents created before this feature
existed have no such field at all, so without this backfill they'd silently
disappear from secretaries' views (lawyers are unaffected either way).

Safe to run multiple times - it only touches documents missing the field.

Usage:
    cd advomind-backend
    python backfill_assigned_to.py
"""

from firebase_admin_setup import get_admin_db

COLLECTIONS = ["cases", "hearings", "archive", "files"]


def backfill():
    db = get_admin_db()
    total_updated = 0

    for coll_name in COLLECTIONS:
        docs = db.collection(coll_name).stream()
        updated_in_collection = 0

        for snap in docs:
            data = snap.to_dict()
            if "assignedTo" not in data:
                snap.reference.update({"assignedTo": None})
                updated_in_collection += 1

        print(f"{coll_name}: updated {updated_in_collection} document(s)")
        total_updated += updated_in_collection

    print(f"\nDone. {total_updated} document(s) updated in total.")


if __name__ == "__main__":
    backfill()