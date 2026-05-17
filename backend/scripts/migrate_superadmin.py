"""
Migration: Move superAdmin documents from hr_profiles to the dedicated superadmins collection.

Run once from the backend directory:
    python scripts/migrate_superadmin.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

from database.mongodb import connect_mongodb

def migrate():
    client = connect_mongodb()
    if not client:
        print("ERROR: Could not connect to MongoDB.")
        sys.exit(1)

    db = client["HumatiQ"]

    superadmins_in_hr = list(db.hr_profiles.find({"role": "superadmin"}))

    if not superadmins_in_hr:
        print("No superadmin documents found in hr_profiles. Nothing to migrate.")
        return

    print(f"Found {len(superadmins_in_hr)} superadmin(s) in hr_profiles:")
    for sa in superadmins_in_hr:
        print(f"  - {sa.get('email')} (id: {sa.get('_id')})")

    migrated = 0
    skipped = 0

    for doc in superadmins_in_hr:
        _id = doc["_id"]

        # Skip if already in superadmins
        if db.superadmins.find_one({"_id": _id}):
            print(f"  SKIP: {doc.get('email')} already exists in superadmins collection.")
            skipped += 1
            continue

        # Build the superadmin document (keep only relevant fields)
        superadmin_doc = {
            "_id": _id,
            "first_name": doc.get("first_name"),
            "last_name": doc.get("last_name"),
            "email": doc.get("email"),
            "role": "superadmin",
            "status": doc.get("status", "active"),
            "phone": doc.get("phone"),
            "avatar_url": doc.get("avatar_url"),
            "created_at": doc.get("created_at"),
            "updated_at": doc.get("updated_at"),
        }

        db.superadmins.insert_one(superadmin_doc)
        db.hr_profiles.delete_one({"_id": _id})

        print(f"  MIGRATED: {doc.get('email')} → superadmins collection (removed from hr_profiles)")
        migrated += 1

    print(f"\nDone. Migrated: {migrated}, Skipped: {skipped}")

if __name__ == "__main__":
    migrate()
