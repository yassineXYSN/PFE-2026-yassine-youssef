from database.mongodb import connect_mongodb
from bson import ObjectId
import sys

def check_company_status(company_id):
    client = connect_mongodb()
    if not client:
        print("Error: Could not connect to MongoDB")
        return
    
    db = client["HumatiQ"]
    company = db.hr_companies.find_one({"_id": ObjectId(company_id)})
    
    if not company:
        print(f"Error: Company with ID {company_id} not found")
        return
    
    print(f"Company Found: {company.get('name')}")
    print(f"Onboarding Done (DB): {company.get('onboarding_done')}")
    print(f"Full Company Data: {company}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python check_onboarding.py <company_id>")
    else:
        check_company_status(sys.argv[1])
