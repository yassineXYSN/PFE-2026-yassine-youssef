import os
from dotenv import load_dotenv

# Load .env from backend/ directory (parent of this file's directory)
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
load_dotenv(dotenv_path)

try:
    import pymysql
    import pymysql.cursors
    _pymysql_available = True
except ImportError:
    _pymysql_available = False
    print("WARNING: pymysql is not installed. MariaDB features will be unavailable. "
          "Install it with: pip install pymysql")

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "nexthire_auth")


def connect_mysql() -> bool:
    """
    Test the MariaDB connection on startup and print status.
    Called once in main.py lifespan startup.
    Returns True on success, False on failure.
    """
    if not _pymysql_available:
        print("Error: pymysql is not installed. Cannot connect to MariaDB.")
        return False

    try:
        conn = pymysql.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            cursorclass=pymysql.cursors.DictCursor,
        )
        conn.close()
        print("MariaDB connection established successfully.")
        return True
    except Exception as e:
        print(f"Error connecting to MariaDB: {e}")
        return False


def get_db():
    """
    Yield a PyMySQL connection for use as a FastAPI dependency.
    Cursor uses DictCursor so rows come back as dicts.
    Always closes the connection after the request.
    Usage: db: Connection = Depends(get_db)
    """
    if not _pymysql_available:
        raise RuntimeError("pymysql is not installed. Cannot create MariaDB connection.")

    conn = pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        cursorclass=pymysql.cursors.DictCursor,
    )
    try:
        yield conn
    finally:
        conn.close()


def row(cursor, query: str, params=None) -> dict | None:
    """
    Execute a SELECT query expected to return 0 or 1 rows.
    Returns the first row as a dict, or None.
    """
    cursor.execute(query, params)
    return cursor.fetchone()
