# Task 3 Report: Wire connect_mysql, Remove Supabase, Clean CORS and Auth Routing

## Status: DONE

## Commit
- `f2348fa` Task 3: Wire connect_mysql, remove Supabase, clean CORS and auth routing

## Changes Applied

### backend/main.py (4 changes)
1. **Import swap**: Replaced `from database.supabase import connect_supabase` with `from database.mysql import connect_mysql`
2. **Lifespan startup**: Replaced `connect_supabase()` call with `connect_mysql()` in the lifespan function
3. **CORS tightened**: Replaced `allow_origin_regex=".*"` with env-driven `allow_origins` list defaulting to `http://localhost:5173`
4. **Duplicate router removed**: Removed `app.include_router(auth.router, prefix="/auth")`, kept only `/api/auth`

### backend/requirements.txt (2 changes)
- Removed: `supabase`
- Added: `pymysql`

## Syntax Check
```
python -c "import ast; ast.parse(open('backend/main.py').read()); print('OK')"
OK
```

## Acceptance Criteria Verification
- [x] `backend/main.py` has no `supabase` anywhere
- [x] `backend/main.py` calls `connect_mysql()` in lifespan startup
- [x] Auth router registered only at `/api/auth` (not `/auth`)
- [x] CORS uses `allow_origins` with env-driven list, not `allow_origin_regex=".*"`
- [x] `backend/requirements.txt` has `pymysql` and no `supabase`

## Concerns
None. All 4 main.py changes and 2 requirements.txt changes applied cleanly. Syntax check passed.
