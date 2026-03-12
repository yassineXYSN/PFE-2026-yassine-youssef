from motor.motor_asyncio import AsyncIOMotorClient
import os
import certifi
from dotenv import load_dotenv

# Load .env from backend/ directory
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
load_dotenv(dotenv_path)

_client = None

def get_async_mongodb_client():
    """
    Returns a global AsyncIOMotorClient instance.
    """
    global _client
    if _client is None:
        mongo_url = os.getenv("MONGODB_URL")
        if not mongo_url:
            raise Exception("MONGODB_URL not found in environment variables.")

        use_certifi = not os.getenv("MONGODB_ATLAS_TLS_INSECURE", "").lower() in ("1", "true", "yes")
        client_options = {
            "serverSelectionTimeoutMS": 5000,
        }
        if use_certifi:
            client_options["tlsCAFile"] = certifi.where()
        else:
            client_options["tlsAllowInvalidCertificates"] = True

        _client = AsyncIOMotorClient(mongo_url, **client_options)
    
    return _client

def get_async_db():
    """
    Returns the AsyncIOMotorDatabase instance for 'HumatiQ'.
    """
    client = get_async_mongodb_client()
    # Or extract from URL if needed. Defaulting to HumatiQ for this project.
    return client["HumatiQ"]
