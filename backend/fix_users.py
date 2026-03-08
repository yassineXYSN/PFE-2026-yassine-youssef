import os
import certifi
import sys
from pymongo import MongoClient
from supabase import create_client, Client
from dotenv import load_dotenv

# Ensure we can import from backend
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

dotenv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
load_dotenv(dotenv_path)

def fix_users():
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")
    mongo_url = os.getenv("MONGODB_URL")

    if not all([supabase_url, supabase_key, mongo_url]):
        print("Error: Missing environment variables in backend/.env")
        return

    # Initialize clients
    try:
        supabase: Client = create_client(supabase_url, supabase_key)
        mongo_client = MongoClient(mongo_url, tlsCAFile=certifi.where())
        db = mongo_client["nexthire"]
        print("✅ Connected to Supabase and MongoDB.")
    except Exception as e:
        print(f"❌ Connection error: {e}")
        return

    print("\n--- Diagnostic: Supabase Users ---")
    print("Listing ALL profiles from MongoDB (nexthire.hr_profiles):")
    profiles = list(db.hr_profiles.find())
    
    found_target = False
    target_id = "1f319f2b-535f-4173-b739-0affdbbc7b03"
    
    if not profiles:
        print("No profiles found in MongoDB.")
    else:
        for p in profiles:
            is_target = p.get('_id') == target_id
            if is_target: found_target = True
            prefix = "[TARGET] " if is_target else "- "
            print(f"{prefix}Email: {p.get('email', 'N/A')}")
            print(f"  ID: {p.get('_id')}")
            print(f"  Role: {p.get('role')}")
            print("-" * 20)

    if not found_target:
        print(f"\n⚠️ ID {target_id} NOT found in MongoDB.")
        print("Would you like to create a basic profile for this user? (y/n)")
        choice = "y" # Simulating for now, but I'll make the script prompt the user if they run it manually
        # Since I'm an agent, I'll just provide the functional script.
        
    print("\n--- Fix Utility Commands ---")
    print(f"To manually create the profile for {target_id}, run this script with --create-admin <email>")
    
    if "--create-admin" in sys.argv:
        email = sys.argv[sys.argv.index("--create-admin") + 1]
        new_profile = {
            "_id": target_id,
            "email": email,
            "role": "admin",
            "status": "active",
            "first_name": "Admin",
            "last_name": "User",
            "created_at": "2023-01-01T00:00:00Z"
        }
        db.hr_profiles.insert_one(new_profile)
        print(f"✅ Created admin profile for {email} in MongoDB.")

    print("\n--- Recommendations ---")
    print("1. If this is a SuperAdmin, ensure metadata is set in Supabase Dashboard (Auth -> Users -> User -> Metadata).")
    print("   Metadata JSON should look like: {\"role\": \"superadmin\"}")
    print("2. For Admins, ensure they exist in MongoDB with role='admin'.")

if __name__ == "__main__":
    fix_users()
