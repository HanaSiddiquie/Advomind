# advomind-backend/backfill_assigned_to.py
"""
One-time migration: adds `assignedTo: None` to any existing case, hearing,
archive, or file document that doesn't already have the field, and backfills
`court_type` on file records that predate the search feature.

Why this is needed: the new Firestore rules and frontend queries treat a
missing `assignedTo` field differently from an explicit `null` - secretaries
querying for "unassigned" docs only match documents where the field is
explicitly present and equal to null. Documents created before this feature
existed have no such field at all, so without this backfill they'd silently
disappear from secretaries' views (lawyers are unaffected either way).

Files also never had a court_type field until the search feature added
court-aware rules for them - this script resolves each file's court by
looking up its parent case.

Safe to run multiple times - it only touches documents missing the field.

Usage:
    cd advomind-backend
    python backfill_assigned_to.py
"""

from firebase_admin_setup import get_admin_db

COLLECTIONS = ["cases", "hearings", "archive", "files"]


def backfill_assigned_to():
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

    print(f"\nassignedTo backfill done. {total_updated} document(s) updated in total.")


def backfill_file_court_type():
    """Files never had court_type until the search feature added court-aware
    rules for them. Look up each file's parent case (checking both the live
    'cases' collection and 'archive', since the case may have been archived
    since the file was uploaded) and copy its court_type onto the file."""
    db = get_admin_db()
    updated = 0
    skipped = 0

    files = db.collection("files").stream()

    for snap in files:
        data = snap.to_dict()
        if "court_type" in data:
            continue

        case_id = data.get("case_id")
        court_type = None

        if case_id:
            case_snap = db.collection("cases").document(case_id).get()
            if case_snap.exists:
                court_type = case_snap.to_dict().get("court_type")
            else:
                # Might belong to an archived case instead.
                archive_matches = db.collection("archive") \
                    .where("originalCaseId", "==", case_id).limit(1).stream()
                for a in archive_matches:
                    court_type = a.to_dict().get("court_type")

        if court_type:
            snap.reference.update({"court_type": court_type})
            updated += 1
        else:
            skipped += 1
            print(f"  WARNING: could not resolve court_type for file {snap.id} (case_id={case_id})")

    print(f"files court_type backfill: updated {updated}, skipped {skipped}")


if __name__ == "__main__":
    backfill_assigned_to()
    print()
    backfill_file_court_type()