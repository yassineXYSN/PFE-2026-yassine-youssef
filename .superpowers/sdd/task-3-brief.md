# Task 3: Update main.py + requirements.txt (Remove Supabase)

## Context

Phase 1 auth migration. Tasks 1 and 2 have created the new MariaDB foundation and auth layer.
This task wires them into the application entry point and cleans up the package list.

**Only modify: `backend/main.py` and `backend/requirements.txt`**

## File 1: Update `backend/main.py`

### Change 1: Replace Supabase import + lifespan call with MariaDB

Remove:
```python
from database.supabase import connect_supabase
```

Add to the DB imports section:
```python
from database.mysql import connect_mysql
```

In the `lifespan` function, replace:
```python
connect_supabase()
```
With:
```python
connect_mysql()
```

### Change 2: Remove duplicate auth router

Currently the app registers auth routes twice:
```python
app.include_router(auth.router, prefix="/auth")
app.include_router(auth.router, prefix="/api/auth")
```

Remove the `/auth` registration, keep only `/api/auth`:
```python
app.include_router(auth.router, prefix="/api/auth")
```

### Change 3: Tighten CORS

Replace:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

With:
```python
_allowed_origins_raw = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
_allowed_origins = [o.strip() for o in _allowed_origins_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

`os` is already imported at the top of main.py (`import os`).

## File 2: Update `backend/requirements.txt`

- Remove the line: `supabase`
- Add a new line: `pymysql`

The file currently has `passlib` and `bcrypt` already — no change needed there.

## Acceptance

- `backend/main.py` has no `supabase` anywhere
- `backend/main.py` calls `connect_mysql()` in the lifespan startup
- `backend/main.py` only registers auth router at `/api/auth` (not `/auth`)
- CORS uses `allow_origins` with an env-driven list, not `allow_origin_regex=".*"`
- `backend/requirements.txt` has `pymysql` and no `supabase`

## Verification

After changes, syntax-check main.py:
```bash
python -c "import ast; ast.parse(open('backend/main.py').read()); print('OK')"
```

Commit message: "Task 3: Wire connect_mysql, remove Supabase, clean CORS and auth routing"
