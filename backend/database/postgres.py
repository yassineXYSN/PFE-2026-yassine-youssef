import os
import uuid
from datetime import datetime
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))


def get_db():
    conn = psycopg2.connect(
        os.getenv("DATABASE_URL"),
        cursor_factory=psycopg2.extras.RealDictCursor,
    )
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def connect_postgres():
    try:
        conn = psycopg2.connect(os.getenv("DATABASE_URL"))
        conn.cursor().execute("SELECT 1")
        conn.close()
        print("✅ PostgreSQL connection established.")
    except Exception as e:
        print(f"❌ PostgreSQL connection failed: {e}")


def row(r):
    """Convert a psycopg2 RealDictRow to a JSON-serializable dict."""
    if r is None:
        return None
    out = {}
    for k, v in r.items():
        if isinstance(v, uuid.UUID):
            out[k] = str(v)
        elif isinstance(v, datetime):
            out[k] = v.isoformat()
        else:
            out[k] = v
    return out
