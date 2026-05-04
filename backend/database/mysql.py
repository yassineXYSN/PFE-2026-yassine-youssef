import os
from datetime import datetime, date
import pymysql
import pymysql.cursors
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))


def _conn_params() -> dict:
    return {
        "host":     os.getenv("DB_HOST", "localhost"),
        "port":     int(os.getenv("DB_PORT", 3306)),
        "user":     os.getenv("DB_USER"),
        "password": os.getenv("DB_PASSWORD"),
        "database": os.getenv("DB_NAME"),
        "charset":  "utf8mb4",
        "cursorclass": pymysql.cursors.DictCursor,
    }


def get_db():
    conn = pymysql.connect(**_conn_params())
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def connect_mysql():
    try:
        conn = pymysql.connect(**{**_conn_params(), "cursorclass": pymysql.cursors.Cursor})
        conn.cursor().execute("SELECT 1")
        conn.close()
        print("✅ MySQL/MariaDB connection established.")
    except Exception as e:
        print(f"❌ MySQL/MariaDB connection failed: {e}")


def row(r: dict | None) -> dict | None:
    """Make a DictCursor row JSON-serialisable."""
    if r is None:
        return None
    out = {}
    for k, v in r.items():
        if isinstance(v, (datetime, date)):
            out[k] = v.isoformat()
        else:
            out[k] = v
    return out
