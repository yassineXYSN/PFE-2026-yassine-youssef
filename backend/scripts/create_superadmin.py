"""
Create a superadmin account in MariaDB + MongoDB.

Usage (from the backend/ directory):
    python scripts/create_superadmin.py
"""

import os
import sys
import uuid
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

from passlib.context import CryptContext
from database.mysql import get_db
from database.mongodb import connect_mongodb

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def main():
    print("=== Create Superadmin ===\n")
    first_name = input("First name: ").strip()
    last_name  = input("Last name:  ").strip()
    email      = input("Email:      ").strip().lower()
    password   = input("Password:   ").strip()

    if not all([first_name, last_name, email, password]):
        print("ERROR: All fields are required.")
        sys.exit(1)

    user_id = str(uuid.uuid4())
    password_hash = pwd_context.hash(password)

    # 1. Insert into MariaDB (users + profiles)
    import pymysql.err
    db_gen = get_db()
    db_conn = next(db_gen)
    try:
        with db_conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO users (id, email, password_hash) VALUES (%s, %s, %s)",
                (user_id, email, password_hash)
            )
            cursor.execute(
                "INSERT INTO profiles (id, role, status, first_name, last_name) VALUES (%s, %s, %s, %s, %s)",
                (user_id, "superadmin", "active", first_name, last_name)
            )
        db_conn.commit()
        print(f"\n[OK] MariaDB user created (id: {user_id})")
    except pymysql.err.IntegrityError:
        db_conn.rollback()
        print("ERROR: Email already exists in MariaDB.")
        sys.exit(1)
    except Exception as e:
        db_conn.rollback()
        print(f"ERROR creating MariaDB user: {e}")
        sys.exit(1)
    finally:
        try: next(db_gen)
        except StopIteration: pass

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
            "email": email,
            "role": "superadmin",
            "status": "active",
            "phone": None,
            "avatar_url": None,
            "created_at": now,
            "updated_at": now,
        })
        print(f"[OK] MongoDB superadmin document created.")

    print(f"\nSuperadmin '{first_name} {last_name}' ({email}) created successfully.")
    print(f"User ID: {user_id}")


if __name__ == "__main__":
    main()
