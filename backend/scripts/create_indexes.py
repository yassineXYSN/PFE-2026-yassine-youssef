import os
import certifi
import sys
from pymongo import MongoClient, ASCENDING, DESCENDING
from dotenv import load_dotenv

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
load_dotenv(dotenv_path)

def create_indexes():
    mongo_url = os.getenv("MONGODB_URL")
    if not mongo_url:
        print("Error: MONGODB_URL not found.")
        return

    try:
        client = MongoClient(mongo_url, tlsCAFile=certifi.where())
        db = client["HumatiQ"]
        print("✅ Connected to MongoDB. Starting indexing...")

        # hr_jobs indexes
        print("Creating indexes for 'hr_jobs'...")
        db.hr_jobs.create_index([("company_id", ASCENDING)])
        db.hr_jobs.create_index([("created_at", DESCENDING)])
        print("  - Index on company_id: ✅")
        print("  - Index on created_at: ✅")

        # candidat_applications indexes
        print("Creating indexes for 'candidat_applications'...")
        db.candidat_applications.create_index([("company_id", ASCENDING)])
        db.candidat_applications.create_index([("job_id", ASCENDING)])
        db.candidat_applications.create_index([("created_at", DESCENDING)])
        db.candidat_applications.create_index([("ai_score", DESCENDING)])
        print("  - Index on company_id: ✅")
        print("  - Index on job_id: ✅")
        print("  - Index on created_at: ✅")
        print("  - Index on ai_score: ✅")

        # hr_profiles indexes
        print("Creating indexes for 'hr_profiles'...")
        db.hr_profiles.create_index([("company_id", ASCENDING)])
        db.hr_profiles.create_index([("email", ASCENDING)], unique=True)
        print("  - Index on company_id: ✅")
        print("  - Unique index on email: ✅")

        # Demo-account 2FA indexes
        print("Creating indexes for 'demo_access_codes'...")
        db.demo_access_codes.create_index([("user_id", ASCENDING)])
        db.demo_access_codes.create_index([("expires_at", ASCENDING)])
        print("  - Index on user_id: ✅")
        print("  - Index on expires_at: ✅")

        print("Creating indexes for 'demo_trusted_devices'...")
        db.demo_trusted_devices.create_index([("user_id", ASCENDING)])
        db.demo_trusted_devices.create_index([("device_id", ASCENDING)])
        print("  - Index on user_id: ✅")
        print("  - Index on device_id: ✅")

        print("Creating indexes for 'demo_login_audit'...")
        db.demo_login_audit.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
        print("  - Compound index on (user_id, created_at): ✅")

        print("\n🚀 All indexes created successfully! Your queries will now be significantly faster.")

    except Exception as e:
        print(f"❌ Error creating indexes: {e}")

if __name__ == "__main__":
    create_indexes()
