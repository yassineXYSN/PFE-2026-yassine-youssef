from pymongo import MongoClient
import os
import certifi
from dotenv import load_dotenv

# Load .env from backend/ directory (parent of this file's directory)
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
load_dotenv(dotenv_path)

# Global client instance to enable connection pooling
_client = None

def connect_mongodb():
    """
    Connects to MongoDB Atlas (not Compass/local). Uses MONGODB_URL from .env.
    Reuses the existing connection if already established.
    """
    global _client
    if _client is not None:
        try:
            # Check if connection is still alive
            _client.admin.command('ping')
            return _client
        except Exception:
            # Connection lost, will re-establish
            _client = None

    mongo_url = os.getenv("MONGODB_URL")
    if not mongo_url:
        print("Error: MONGODB_URL not found in environment variables.")
        return None

    # Atlas + Windows: TLS handshake can fail; certifi CA + optional insecure bypass
    use_certifi = not os.getenv("MONGODB_ATLAS_TLS_INSECURE", "").lower() in ("1", "true", "yes")
    client_options = {
        "serverSelectionTimeoutMS": 5000,
        "maxPoolSize": 50,
        "minPoolSize": 10,
        "retryWrites": True,
    }
    if use_certifi:
        client_options["tlsCAFile"] = certifi.where()
    else:
        # Dev only: bypass TLS verification (fixes TLSV1_ALERT_INTERNAL_ERROR on Windows)
        client_options["tlsAllowInvalidCertificates"] = True

    try:
        _client = MongoClient(mongo_url, **client_options)
        # Trigger a connection verification
        _client.admin.command('ping')
        print("MongoDB connection established successfully (Pool active).")
        return _client
    except Exception as e:
        print(f"Error connecting to MongoDB: {e}")
        _client = None
        return None
