import os
import certifi
from pymongo import MongoClient
from dotenv import load_dotenv

dotenv_path = os.path.join('backend', '.env')
load_dotenv(dotenv_path)

mongo_url = os.getenv("MONGODB_URL")
client = MongoClient(mongo_url, tlsCAFile=certifi.where())
db = client["nexthire"]

print("--- MongoDB Profiles ---")
profiles = list(db.hr_profiles.find({}, {"_id": 1, "email": 1, "role": 1, "status": 1}))
for p in profiles:
    print(f"ID: {p['_id']}, Email: {p['email']}, Role: {p['role']}, Status: {p['status']}")
