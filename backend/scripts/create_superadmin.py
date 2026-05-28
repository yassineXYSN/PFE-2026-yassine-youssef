"""
Create a superadmin account.

Usage (from the backend/ directory):
    python scripts/create_superadmin.py
"""

import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

from supabase import create_client
from database.mongodb import connect_mongodb


def main():
    supabase_url = os.getenv("SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not service_role_key:
        print("ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in backend/.env")
        sys.exit(1)

    print("=== Create Superadmin ===\n")
    first_name = input("First name: ").strip()
    last_name  = input("Last name:  ").strip()
    email      = input("Email:      ").strip()
    password   = input("Password:   ").strip()

    if not all([first_name, last_name, email, password]):
        print("ERROR: All fields are required.")
        sys.exit(1)

    # 1. Create user in Supabase Auth
    admin_client = create_client(supabase_url, service_role_key)
    try:
        res = admin_client.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {
                "first_name": first_name,
                "last_name": last_name,
                "role": "superadmin",
            },
        })
        user_id = res.user.id
        print(f"\n[OK] Supabase user created (id: {user_id})")
    except Exception as e:
        print(f"ERROR creating Supabase user: {e}")
        sys.exit(1)

    # 2. Insert into MongoDB superadmins collection
    client = connect_mongodb()
    if not client:
        print("ERROR: Could not connect to MongoDB.")
        sys.exit(1)

    db = client["HumatiQ"]

    if db.superadmins.find_one({"_id": user_id}):
        print("WARNING: Superadmin document already exists in MongoDB — skipping insert.")
    else:
        now = datetime.utcnow()
        db.superadmins.insert_one({
            "_id": user_id,
            "first_name": first_name,
            "last_name": last_name,
            "email": email.lower().strip(),
            "role": "superadmin",
            "status": "active",
            "phone": None,
            "avatar_url": None,
            "created_at": now,
            "updated_at": now,
        })
        print(f"[OK] Superadmin document inserted in MongoDB")

    print(f"\nDone. You can now log in as {email}")


if __name__ == "__main__":
    main()
