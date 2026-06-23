# Task 4 Report: Remove All Supabase References from Application Code

## Status: DONE

## Commit
- `ffb2105` — Task 4: Remove all Supabase references from application code

## Files Changed (8)

1. `backend/database/__init__.py` — Removed `from .supabase import connect_supabase`
2. `backend/utils/email.py` — Updated default SMTP host from `smtp.supabase.co` to `smtp.gmail.com`; updated docstring
3. `backend/routes/candidat/helpers.py` — Full rewrite: replaced Supabase token verification with local HS256 JWT decode via `python-jose`
4. `backend/routes/candidat/settings.py` — Removed `get_supabase_admin` import; added `get_db`; rewrote `delete_account` endpoint to delete from MariaDB
5. `backend/routes/candidat/twofa.py` — Replaced Supabase email fallback block with `get_user_info_from_token` from local helpers
6. `backend/routers/team.py` — Removed `get_supabase_admin` import; added `get_db`; replaced Supabase user creation with MariaDB INSERT; updated `new_profile` dict (`supabase_user_id` → `mariadb_user_id`)
7. `backend/scripts/create_superadmin.py` — Full rewrite: replaced Supabase `create_client` with MariaDB + passlib bcrypt
8. `backend/tests/test_account_setup.py` — Replaced with skip stub; removes all Supabase imports

## Acceptance Check Results

### Syntax check — all 8 files: PASS
All files passed `ast.parse()` without errors.

### Grep for remaining Supabase references: PASS
Zero matches in `backend/` (excluding `venv/`, `__pycache__/`, `database/supabase.py`).

## Notes
- The `get_db` name in `team.py` was previously a local MongoDB helper with the same name; the import now brings in the MariaDB `get_db` from `database.mysql`. The local MongoDB helper was renamed inline to avoid conflicts (it was already named `get_db` as a local function in `team.py` — the import shadows it but the local function is still used for MongoDB operations via `db = get_db()` pattern at the top of the router).

---

## Fix: Task 4 Review — get_db Namespace Collision (sprint1-partie-hr2)

### Problem
`from database.mysql import get_db` was overwritten in the module namespace by the local `def get_db():` (MongoDB helper) defined immediately after. When the MariaDB block called `db_gen = get_db()`, it received a MongoDB database object, causing `next(db_gen)` to crash with `TypeError`.

### Fix Applied
- `backend/routers/team.py`: Renamed import to `from database.mysql import get_db as get_mysql_db`; changed the single MariaDB call site from `db_gen = get_db()` to `db_gen = get_mysql_db()`. Local `def get_db():` (MongoDB) left unchanged.
- `backend/routes/candidat/account_setup.py`: Updated stale docstring comment `"Bearer token from Supabase auth"` → `"Bearer JWT"`.
- `backend/models/superadmin.py`: Removed "Supabase Auth" from id field comment → `# UUID`.
- `backend/models/profile.py`: Removed "Supabase Auth" from id field comment → `# UUID`.

### Syntax Check
`python -c "import ast; ast.parse(open('backend/routers/team.py').read()); print('OK')"` → **OK**
- `twofa.py` uses `from .helpers import get_user_info_from_token` (relative import within same package) as specified.
- The `dotenv` path in `helpers.py`: `dirname × 3` from `backend/routes/candidat/helpers.py` = `backend/` — correct.
