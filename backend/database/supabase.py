from supabase import create_client, Client
import os
from dotenv import load_dotenv

# Load .env from backend/ directory (parent of this file's directory)
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
load_dotenv(dotenv_path)

def connect_supabase():
    """
    Establishes a connection to Supabase using URL and Key from environment variables.
    Returns the Supabase client if successful, or raises an error.
    """
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")

    if not supabase_url or not supabase_key:
        print("Error: SUPABASE_URL or SUPABASE_KEY not found in environment variables.")
        return None

    try:
        # supabase-py doesn't strictly "connect" until a request is made, 
        # but we can initialize the client.
        client: Client = create_client(supabase_url, supabase_key)
        
        # Simple health check to verify credentials/url
        # We assume there might be a 'health' or similar check, 
        # but valid initialization is often enough for step 1.
        # To strictly verify, we might need to access a table. 
        # For now, we return the client if initialization didn't fail.
        print("✅ Supabase client initialized successfully.")
        return client
    except Exception as e:
        print(f"❌ Error initializing Supabase client: {e}")
        return None
