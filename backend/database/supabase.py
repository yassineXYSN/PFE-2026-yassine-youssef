from supabase import create_client, Client
import os
from dotenv import load_dotenv

# Load .env from backend/ directory
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
load_dotenv(dotenv_path)

_supabase: Client = None

def connect_supabase():
    """
    Initializes the global Supabase client.
    """
    global _supabase
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")

    if not supabase_url or not supabase_key:
        print("Error: SUPABASE_URL or SUPABASE_KEY not found in environment variables.")
        return None

    try:
        _supabase = create_client(supabase_url, supabase_key)
        print("Supabase client initialized successfully.")
        return _supabase
    except Exception as e:
        print(f"Error initializing Supabase client: {e}")
        return None

def get_supabase() -> Client:
    """
    Returns the initialized Supabase client.
    """
    global _supabase
    if _supabase is None:
        return connect_supabase()
    return _supabase

_supabase_admin: Client = None

def get_supabase_admin() -> Client:
    """
    Returns a Supabase client with service_role permissions for admin actions.
    """
    global _supabase_admin
    if _supabase_admin is not None:
        return _supabase_admin
        
    supabase_url = os.getenv("SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not service_role_key:
        print("WARNING: SUPABASE_SERVICE_ROLE_KEY not found. Admin actions will fail.")
        return None

    try:
        _supabase_admin = create_client(supabase_url, service_role_key)
        return _supabase_admin
    except Exception as e:
        print(f"Error initializing Supabase Admin client: {e}")
        return None
