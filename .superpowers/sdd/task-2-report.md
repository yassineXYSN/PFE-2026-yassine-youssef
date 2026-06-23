# Task 2 Report: Rewrite middleware/auth.py and auth.py for local JWT + MariaDB

## Status: DONE

## Commit
- `ed0ffc0` Task 2: Rewrite middleware/auth.py and auth.py for local JWT + MariaDB
  - 2 files changed, 127 insertions(+), 410 deletions(-)

## Syntax Checks
- `backend/middleware/auth.py`: OK
- `backend/auth.py`: OK

## What Was Done

### backend/middleware/auth.py
- Removed all Supabase imports (`database.supabase`, `jose`, `anyio`, `time`, `json`)
- Removed `decode_jwt_local()`, retry logic, SUPABASE_JWT_SECRET, pending-invitation linking
- New `get_current_user` delegates JWT decode to `dependencies.get_current_user` via `Depends(_decode_jwt)`
- MongoDB enrichment kept: checks `superadmins` collection, then `hr_profiles`, keyed on JWT `id` claim
- Returns `{id, email, role, company_id, department_id}`
- `require_roles()` preserved unchanged

### backend/auth.py
- Deleted: `_unlink_identity`, `_find_other_users_by_email`, `_original_provider_from_raw`
- Deleted endpoints: `verify-provider`, `login_info` (GET /login placeholder), `notify-login`
- Added: `POST /login` (email+password against MariaDB, bcrypt verify, JWT issue, background email)
- Added: `POST /register` (uuid generation, bcrypt hash, INSERT users+profiles, JWT issue)
- Added: `GET /me` (Depends on `get_current_user` from dependencies.py)
- Added: `POST /logout` (stateless, returns message)
- Imports: `passlib.context.CryptContext`, `database.mysql.get_db` + `row`, `dependencies.create_access_token` + `get_current_user`

## Acceptance Criteria Check
- [x] `middleware/auth.py` no longer imports from `database.supabase`
- [x] `auth.py` no longer imports from `database.supabase`
- [x] `get_current_user` in `middleware/auth.py` returns `{id, email, role, company_id, department_id}`
- [x] `require_roles()` still works the same way
- [x] `/login`, `/register`, `/me`, `/logout` endpoints exist in `auth.py`
- [x] No Supabase imports anywhere in either file

## Concerns
None. Both files match the brief exactly.

---

## Review Fix Pass — Commit `6e3ea79`

All 5 findings from code review applied and verified:

1. **Fix 1 (CRITICAL) — /me import**: Changed `from dependencies import create_access_token, get_current_user` to split form: `from dependencies import create_access_token` + `from middleware.auth import get_current_user`. The `/me` endpoint now uses the enriched user (with `company_id`, `department_id`).

2. **Fix 2 (Important) — register race condition**: Removed pre-check SELECT + `if existing: raise 409`. Now relies on DB unique constraint; `pymysql.err.IntegrityError` is caught before the generic `Exception` handler and raises a clean 409 response.

3. **Fix 3 (Important) — middleware/auth.py unused imports**: Removed `HTTPBearer`, `HTTPAuthorizationCredentials` from the `fastapi.security` import line, and removed the unused `security = HTTPBearer()` assignment. The entire `from fastapi.security import ...` line was dropped.

4. **Fix 4 (Important) — unused `timedelta` import**: Removed `from datetime import timedelta` from `backend/auth.py` top-level imports.

5. **Fix 5 (Minor) — `import uuid` moved to top**: Removed `import uuid` from inside the register function body; added `import uuid` to the top-level imports section.

### Syntax Checks
- `backend/auth.py`: OK
- `backend/middleware/auth.py`: OK
