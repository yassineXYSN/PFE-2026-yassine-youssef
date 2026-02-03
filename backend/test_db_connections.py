from database.mongodb import connect_mongodb
from database.supabase import connect_supabase
import sys
import os
from dotenv import load_dotenv

# Load environment variables explicitly (optional now that modules do it, but good for safety)
load_dotenv()

def check_connections():
    print("--- Checking Database Connections ---")
    
    mongo_client = connect_mongodb()
    supabase_client = connect_supabase()
    
    if mongo_client and supabase_client:
        print("\n✅ Both connections established/initialized successfully!")
    else:
        print("\n⚠️ Some connections failed. Check the logs above.")

if __name__ == "__main__":
    # Ensure we can import from the current directory
    sys.path.append(".")
    check_connections()
