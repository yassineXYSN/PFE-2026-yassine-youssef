# Task 1: MariaDB Foundation — mysql.py + dependencies.py + schema.sql

## Context

This is Phase 1 of a Supabase → MariaDB auth migration for the NextHire AI backend (FastAPI).
The project currently uses Supabase for all auth; we are replacing it with a self-hosted
MariaDB instance using local HS256 JWTs. MongoDB stays for all business data.

This task creates the **three foundation files** that all subsequent auth tasks depend on.
Nothing else is modified in this task.

## Files to Create

### 1. `backend/database/mysql.py`

PyMySQL helper module. Implement the following functions:

```python
# Environment variables expected (from backend/.env):
# DB_HOST, DB_PORT (default 3306), DB_USER, DB_PASSWORD, DB_NAME

def connect_mysql():
    """
    Test the MariaDB connection on startup and print status.
    Called once in main.py lifespan startup.
    Returns True on success, False on failure.
    """

def get_db():
    """
    Yield a PyMySQL connection for use as a FastAPI dependency.
    Cursor uses DictCursor so rows come back as dicts.
    Always closes the connection after the request.
    Usage: db: Connection = Depends(get_db)
    """

def row(cursor, query: str, params=None) -> dict | None:
    """
    Execute a SELECT query expected to return 0 or 1 rows.
    Returns the first row as a dict, or None.
    """
```

Use `pymysql.connect(...)` with `cursorclass=pymysql.cursors.DictCursor`.
Load env vars with `python-dotenv` the same way existing DB modules do
(load `.env` from the backend's parent directory).

### 2. `backend/dependencies.py`

JWT helpers using `python-jose` (HS256). Already a dependency in requirements.txt.

```python
# Environment variable: SECRET_KEY (from backend/.env)
# Token expiry: ACCESS_TOKEN_EXPIRE_MINUTES (default 60*24 = 1440 minutes = 24h)

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """
    Create a signed HS256 JWT.
    Payload: copy of `data` + "exp" claim.
    """

async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    """
    FastAPI dependency: decode + verify the HS256 JWT from the Authorization header.
    Returns dict with at least: id, email, role.
    Raises HTTP 401 on invalid/expired token.
    Does NOT enrich from MongoDB here (that stays in middleware/auth.py).
    """
```

Use `HTTPBearer` security scheme. On decode failure raise `HTTPException(status_code=401)`.

### 3. `docs/schema.sql`

MariaDB DDL for the identity layer. Create or extend the file at `docs/schema.sql`.

Required tables (minimum):

```sql
-- users: identity only — no business data
CREATE TABLE IF NOT EXISTS users (
    id         CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
    email      VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- profiles: role + status, links to MongoDB business data by user id
CREATE TABLE IF NOT EXISTS profiles (
    id          CHAR(36)     NOT NULL PRIMARY KEY,
    role        ENUM('candidat','hr','manager','admin','superadmin') NOT NULL DEFAULT 'candidat',
    status      ENUM('pending','active','inactive','suspended') NOT NULL DEFAULT 'pending',
    first_name  VARCHAR(100),
    last_name   VARCHAR(100),
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_profile_user FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Add a comment at the top explaining the schema scope:
`-- Identity layer: stores only auth identity and role/status. All business data lives in MongoDB.`

## Constraints

- Use PyMySQL (not SQLAlchemy). Already used in the senior reference.
- JWT: HS256 with python-jose. Already in requirements.txt.
- No extra dependencies beyond what's already in requirements.txt (pymysql will be added in Task 4).
- No tests required for this task (pure infrastructure/config files, no runnable app yet).
- Do NOT modify any existing files.
- Follow the dotenv loading pattern already used in `backend/database/mongodb.py`.

## Acceptance

- `backend/database/mysql.py` exists and is importable
- `backend/dependencies.py` exists with `create_access_token` and `get_current_user`
- `docs/schema.sql` exists with `users` and `profiles` tables
- All three files follow the patterns described above

## Note on pymysql import

Since pymysql is not yet installed in the venv (it's added in Task 4), wrap the `import pymysql` 
in a try/except and add a clear error message if it's missing, so the module can be imported 
without crashing import-time. The actual connection will fail at runtime if the package is absent.
