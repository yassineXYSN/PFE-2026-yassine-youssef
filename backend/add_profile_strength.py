import os
import sys

# Ensure backend directory is in the PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from database.mongodb import connect_mongodb
from routes.candidat.account_setup import calculate_profile_strength

def main():
    print("Connecting to MongoDB...")
    client = connect_mongodb()
    if not client:
        print("Failed to connect to MongoDB. Make sure your environment variables are configured.")
        sys.exit(1)
        
    db = client["HumatiQ"]
    candidates_collection = db["candidates"]
    
    candidates = candidates_collection.find()
    count = 0
    
    print("Calculating and adding profile strength to existing candidates...")
    for candidate in candidates:
        strength_data = calculate_profile_strength(candidate)
        
        candidates_collection.update_one(
            {"_id": candidate["_id"]},
            {"$set": {
                "profileStrength": strength_data["score"],
                "profileMissing": strength_data["missing"]
            }}
        )
        count += 1
        print(f"Updated {candidate.get('email', 'Unknown')} with profileStrength: {strength_data['score']}, missing: {strength_data['missing']}")
        
    print(f"Successfully updated {count} candidates.")

if __name__ == "__main__":
    main()
