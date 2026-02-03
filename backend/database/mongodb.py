from pymongo import MongoClient
import os
from dotenv import load_dotenv

# Load .env from backend/ directory (parent of this file's directory)
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
load_dotenv(dotenv_path)

def connect_mongodb():
    """
    Establishes a connection to MongoDB using the URL from environment variables.
    Returns the MongoDB client if successful, or raises an error.
    """
    mongo_url = os.getenv("MONGODB_URL")
    if not mongo_url:
        print("Error: MONGODB_URL not found in environment variables.")
        return None

    try:
        client = MongoClient(mongo_url, serverSelectionTimeoutMS=5000)
        # Trigger a connection verification
        client.admin.command('ping')
        print("✅ MongoDB connection established successfully.")
        return client
    except Exception as e:
        print(f"❌ Error connecting to MongoDB: {e}")
        return None
