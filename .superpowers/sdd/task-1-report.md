# Task 1 Report: MariaDB Foundation

## Status: DONE

## Files Created

### backend/database/mysql.py
- Follows the same dotenv loading pattern as `backend/database/mongodb.py` (resolves .env relative to the file's parent directory)
- `connect_mysql()`: tests connection at startup, returns True/False, prints status
- `get_db()`: FastAPI dependency that yields a DictCursor-based connection and always closes it
- `row()`: executes a single-row SELECT, returns dict or None
- `import pymysql` is wrapped in try/except with a clear warning if the package is absent (not yet installed)

### backend/dependencies.py
- Loads .env from the same directory as the file (backend/)
- `create_access_token()`: signs HS256 JWT with exp claim using python-jose
- `get_current_user()`: FastAPI Security dependency using HTTPBearer; decodes and verifies JWT, raises HTTP 401 on failure; returns dict with id, email, role
- Does NOT enrich from MongoDB (that remains in middleware/auth.py)

### docs/schema.sql
- Header comment: "Identity layer: stores only auth identity and role/status. All business data lives in MongoDB."
- `users` table: id CHAR(36) UUID PK, email UNIQUE, password_hash, timestamps
- `profiles` table: id FK → users(id) ON DELETE CASCADE, role ENUM, status ENUM, first_name, last_name, timestamps
- Both tables: InnoDB, utf8mb4

## Constraints Verified
- No existing files modified
- No new dependencies added (pymysql guarded with try/except; python-jose already in requirements.txt)
- Dotenv pattern matches mongodb.py exactly
- No tests required (infrastructure-only)

## Review Fixes (commit cf1cd23)

- **Fix 1 — SECRET_KEY guard**: Added module-level `RuntimeError` if `SECRET_KEY` is unset, empty, or still `"changeme"`, preventing silent insecure deployments.
- **Fix 2 — utcnow deprecation**: Replaced `datetime.utcnow()` with `datetime.now(timezone.utc)`; imported `timezone` from `datetime`.
- **Fix 3 — get_db() docstring**: Updated to accurately say it yields a PyMySQL connection (not a cursor) configured with DictCursor as default cursor class.
- **Fix 4 — exception logging**: Changed `connect_mysql()` except block to print `type(e).__name__` alongside the message so operators can distinguish config bugs from network timeouts.
