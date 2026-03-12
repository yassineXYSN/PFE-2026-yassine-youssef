import sys
import os
from bson import ObjectId

# Ensure the backend directory is in the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database.mongodb import connect_mongodb

def inspect_db():
    db = connect_mongodb()["HumatiQ"]
    
    print("--- Inspecting hr_jobs ---")
    jobs = list(db.hr_jobs.find({"status": "published"}).limit(5))
    for job in jobs:
        print(f"Job: {job.get('title')}, Company ID: {job.get('company_id')} (Type: {type(job.get('company_id'))})")
        
    print("\n--- Inspecting hr_companies ---")
    for job in jobs:
        cid = job.get('company_id')
        if not cid:
            print("No company_id for this job")
            continue
            
        try:
            if isinstance(cid, str) and len(cid) == 24:
                query_id = ObjectId(cid)
            else:
                query_id = cid
            
            company = db.hr_companies.find_one({"_id": query_id})
            if company:
                print(f"Match found for {cid}: Name={company.get('name')}, Logo URL={company.get('logo_url')}")
            else:
                print(f"NO MATCH found for {cid} in hr_companies")
        except Exception as e:
            print(f"Error checking {cid}: {e}")

if __name__ == "__main__":
    inspect_db()
