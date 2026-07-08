# Security Code-Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the code-level security vulnerabilities found in the production-readiness audit (broken authorization, unauthenticated interview WebSockets, exposed test routes, unvalidated uploads, no rate limiting, hardcoded URLs, weak password/2FA/CORS handling) — without touching infrastructure/config items.

**Architecture:** Additive, minimally-invasive changes to the existing FastAPI backend and the Vite/React frontend. Authorization is enforced through the existing `require_roles` / `get_current_user` dependencies and a new WebSocket auth helper. Rate limiting is added via `slowapi` (in-process, single-instance). No database schema changes are required by any task in scope.

**Tech Stack:** FastAPI, python-jose (HS256 JWT), passlib/bcrypt, PyMySQL (MariaDB), PyMongo (MongoDB), pyotp, slowapi (new), React + Vite.

## Global Constraints

- **In scope:** code-level fixes only. **Explicitly OUT of scope (do NOT touch in this plan):** TURN server provisioning, MongoDB TLS / `MONGODB_ATLAS_TLS_INSECURE`, rotating or relocating secrets in `backend/.env`, container sizing / model-load tuning, multi-instance scheduler redesign.
- **No new system-level dependencies.** Upload validation must not require `libmagic`/`python-magic` or any apt package. Rate limiting uses in-process storage only (no Redis).
- **Preserve existing auth model:** HS256 JWT in the `Authorization: Bearer` header; claims `{id, email, role}`. Do not change the token format.
- **Existing env vars only.** Where code currently hardcodes a URL, read the *already-defined* env var (`FRONTEND_URL`, and the frontend's `VITE_API_URL`). Do not introduce new secrets.
- **Test runner:** `python -m pytest` from the `backend/` directory. Auth/authz tests use `app.dependency_overrides` (no live DB needed); DB-dependent assertions are noted where unavoidable.
- **Roles:** `ALLOWED_ROLES = {candidat, hr, recruiter, chef_departement, manager, admin, superadmin}`. `superadmin` bypasses `require_roles`. "HR-side" roles = `{hr, recruiter, chef_departement, manager, admin}` (everything except `candidat`).
- **Commit after each task.** DRY, YAGNI, TDD, frequent commits.

---

## File Structure

**Backend — modified**
- `backend/routers/candidates.py` — add HR-role gating to all `/api/candidates/*` endpoints (Task 1).
- `backend/routers/interviews.py` — add auth + participant check to the three WebSocket endpoints; fix hardcoded invite URL (Task 2, Task 6).
- `backend/routers/quiz.py` — remove/guard the unauthenticated `/test/quiz` route (Task 3).
- `backend/main.py` — stop mounting test routers in production; tighten CORS; disable docs in production; drop the `GET /` stub (Task 3, Task 8).
- `backend/routes/candidat/profile.py` — upload validation + fix hardcoded image URL (Task 4, Task 6).
- `backend/routes/candidat/account_setup.py` — upload validation (Task 4).
- `backend/auth.py` — password policy, remove default temp password, wire 2FA challenge (Task 7, Task 10).
- `backend/routes/candidat/twofa.py` — TOTP verify hardening; expose a login-verify endpoint (Task 9, Task 10).
- `backend/utils/schedulers.py` — fix hardcoded reminder URL (Task 6).
- `backend/routers/team.py` — already uses `FRONTEND_URL`; verify only (Task 6).
- `backend/requirements.txt` — add `slowapi` (Task 5).

**Backend — created**
- `backend/utils/uploads.py` — shared upload-validation helper (Task 4).
- `backend/utils/ratelimit.py` — shared `slowapi` limiter instance (Task 5).
- `backend/utils/ws_auth.py` — WebSocket JWT decode + interview-participant check (Task 2).
- `backend/config.py` — single `IS_PRODUCTION` / `ENVIRONMENT` flag read from env, reused by Tasks 3 & 8.

**Frontend — modified**
- `frontend/src/hooks/useWebRTC.js` — append JWT to the signaling WebSocket URL (Task 2).
- `frontend/src/hooks/useInterviewAnalysis.js`, `frontend/src/hooks/useAudioAnalyzer.js` — append JWT to AI WebSocket URLs (Task 2).

**Backend — tests created**
- `backend/tests/test_candidates_authz.py` (Task 1)
- `backend/tests/test_ws_auth.py` (Task 2)
- `backend/tests/test_test_routes_disabled.py` (Task 3)
- `backend/tests/test_upload_validation.py` (Task 4)
- `backend/tests/test_rate_limit.py` (Task 5)
- `backend/tests/test_password_policy.py` (Task 7)
- `backend/tests/test_cors_and_docs.py` (Task 8)
- `backend/tests/test_totp_verify.py` (Task 9)
- `backend/tests/test_login_2fa.py` (Task 10)

---

## Shared prerequisite: environment flag

Tasks 3 and 8 both need to know "are we in production." Create it once, first.

### Task 0: Add a single environment flag

**Files:**
- Create: `backend/config.py`
- Test: `backend/tests/test_config_flag.py`

**Interfaces:**
- Produces: `ENVIRONMENT: str` (lowercased, default `"development"`) and `IS_PRODUCTION: bool` importable from `config`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_config_flag.py
import importlib
import config


def test_defaults_to_development(monkeypatch):
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    importlib.reload(config)
    assert config.ENVIRONMENT == "development"
    assert config.IS_PRODUCTION is False


def test_production_flag(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "Production")
    importlib.reload(config)
    assert config.ENVIRONMENT == "production"
    assert config.IS_PRODUCTION is True
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_config_flag.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'config'`

- [ ] **Step 3: Create the module**

```python
# backend/config.py
import os

ENVIRONMENT = os.getenv("ENVIRONMENT", "development").strip().lower()
IS_PRODUCTION = ENVIRONMENT == "production"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_config_flag.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/config.py backend/tests/test_config_flag.py
git commit -m "chore: add ENVIRONMENT/IS_PRODUCTION config flag"
```

---

## Phase 1 — High severity (exploitable)

### Task 1: Role-gate the HR candidate endpoints (fixes IDOR)

Every `/api/candidates/*` endpoint currently depends only on `get_current_user`, so **any** authenticated user — including a `candidat` — can list and read every candidate's PII, CV, and documents. Restrict them to HR-side roles.

**Files:**
- Modify: `backend/routers/candidates.py` (endpoints at lines 384, 435, 542, 605, 648, 705, and any other `@router` in the file)
- Test: `backend/tests/test_candidates_authz.py`

**Interfaces:**
- Consumes: `require_roles` from `middleware.auth` (existing: `require_roles(allowed_roles: list)` returns a dependency; `superadmin` always passes).
- Produces: all candidate endpoints reject `candidat` (and anonymous) with 403.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_candidates_authz.py
import os
import sys
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
from middleware.auth import get_current_user

client = TestClient(app)


def _as(role):
    return lambda: {"id": "u1", "email": "u@x.io", "role": role,
                    "company_id": "c1", "department_id": None}


def test_candidat_cannot_list_candidates():
    app.dependency_overrides[get_current_user] = _as("candidat")
    try:
        r = client.get("/api/candidates")
        assert r.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_candidat_cannot_read_candidate_detail():
    app.dependency_overrides[get_current_user] = _as("candidat")
    try:
        r = client.get("/api/candidates/some-id")
        assert r.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_candidat_cannot_download_cv():
    app.dependency_overrides[get_current_user] = _as("candidat")
    try:
        r = client.get("/api/candidates/some-id/cv/download")
        assert r.status_code == 403
    finally:
        app.dependency_overrides.clear()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_candidates_authz.py -v`
Expected: FAIL — endpoints return 404/500 (they run the body), not 403.

- [ ] **Step 3: Add role gating to every endpoint**

At the top of `backend/routers/candidates.py`, extend the import:

```python
from middleware.auth import get_current_user, require_roles
```

Add the allow-set near the other module constants (after line 17):

```python
HR_SIDE_ROLES = ["hr", "recruiter", "chef_departement", "manager", "admin"]
```

Then, for **each** `@router.<method>(...)` handler in this file, replace the parameter

```python
    current_user: dict = Depends(get_current_user),
```

with

```python
    current_user: dict = Depends(require_roles(HR_SIDE_ROLES)),
```

Endpoints to update (verify by scanning the file — do not miss any): the list `@router.get("")` (line 384), `@router.get("/{candidate_id}")` (435), `@router.put("/{candidate_id}/rating")` (542), `@router.get("/{candidate_id}/cv/download")` (605), `@router.get("/{candidate_id}/qualifications/{category}/{item_id}/document")` (648), `@router.put("/{candidate_id}/qualifications/{category}/{item_id}/verification")` (705). Keep the existing `ALLOWED_RATING_ROLES` internal check on the rating endpoint — the dependency is the outer gate, that check stays as defense in depth.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_candidates_authz.py -v`
Expected: PASS (3 passed). The 403 is raised by the dependency before any DB access, so no live DB is required.

- [ ] **Step 5: Commit**

```bash
git add backend/routers/candidates.py backend/tests/test_candidates_authz.py
git commit -m "fix(security): restrict candidate endpoints to HR roles (IDOR)"
```

> **Follow-up noted, NOT in this task:** full cross-company tenant isolation (an HR of company A should not see company B's candidates) requires a data-model decision about the candidate↔company relationship and is deferred. Role-gating closes the "any candidate reads all PII" hole, which is the exploitable part.

---

### Task 2: Authenticate & authorize the interview WebSockets

`/api/interviews/ws/{room_id}/{client_id}`, `/api/interviews/ai/ws/audio`, and `/api/interviews/ai/ws/analyze` accept any connection. Require a valid JWT (passed as a `?token=` query param, since browsers can't set WS headers) and, for the signaling socket, require that the caller is a participant of that interview.

**Files:**
- Create: `backend/utils/ws_auth.py`
- Modify: `backend/routers/interviews.py` (WS endpoints at lines 876, 913, 955)
- Modify: `frontend/src/hooks/useWebRTC.js` (line 191), `frontend/src/hooks/useInterviewAnalysis.js` (line 93 area), `frontend/src/hooks/useAudioAnalyzer.js` (line 79 area)
- Test: `backend/tests/test_ws_auth.py`

**Interfaces:**
- Produces: `decode_ws_token(token: str | None) -> dict | None` (returns claims dict `{id,email,role}` or `None`); `user_is_interview_participant(db, room_id: str, user_id: str) -> bool`.
- Consumes: `SECRET_KEY`, `ALGORITHM` from `dependencies`; `connect_mongodb`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_ws_auth.py
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dependencies import create_access_token
from utils.ws_auth import decode_ws_token


def test_decode_rejects_missing_token():
    assert decode_ws_token(None) is None
    assert decode_ws_token("") is None


def test_decode_rejects_garbage():
    assert decode_ws_token("not-a-jwt") is None


def test_decode_accepts_valid_token():
    tok = create_access_token({"id": "u1", "email": "u@x.io", "role": "hr"})
    claims = decode_ws_token(tok)
    assert claims is not None
    assert claims["id"] == "u1"
    assert claims["role"] == "hr"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_ws_auth.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'utils.ws_auth'`

- [ ] **Step 3: Create the helper**

```python
# backend/utils/ws_auth.py
from typing import Optional

from bson import ObjectId
from jose import jwt, JWTError

from dependencies import SECRET_KEY, ALGORITHM
from database.mongodb import connect_mongodb


def decode_ws_token(token: Optional[str]) -> Optional[dict]:
    """Decode a JWT passed as a WebSocket query param. Returns claims or None."""
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
    if not payload.get("id") or not payload.get("role"):
        return None
    return payload


def user_is_interview_participant(db, room_id: str, user_id: str) -> bool:
    """True if user_id is the recruiter on the interview, or the candidate on
    the linked application."""
    if not ObjectId.is_valid(room_id):
        return False
    interview = db.hr_interviews.find_one({"_id": ObjectId(room_id)})
    if not interview:
        return False
    if str(interview.get("recruiter_id")) == str(user_id):
        return True
    app_id = interview.get("application_id")
    if app_id and ObjectId.is_valid(str(app_id)):
        appdoc = db.job_applications.find_one({"_id": ObjectId(app_id)})
        if appdoc and str(appdoc.get("candidate_id") or appdoc.get("user_id")) == str(user_id):
            return True
    return False
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_ws_auth.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Guard the signaling WebSocket**

In `backend/routers/interviews.py`, add the import near the other util imports:

```python
from utils.ws_auth import decode_ws_token, user_is_interview_participant
```

Replace the `websocket_endpoint` signature/prologue (line 876-878) so it reads the token before `manager.connect`:

```python
@router.websocket("/ws/{room_id}/{client_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, client_id: str):
    claims = decode_ws_token(websocket.query_params.get("token"))
    if claims is None:
        await websocket.close(code=1008)  # policy violation
        return
    db = get_db()
    if not user_is_interview_participant(db, room_id, claims["id"]):
        await websocket.close(code=1008)
        return
    await manager.connect(websocket, room_id)
    # ... rest of the existing body unchanged ...
```

- [ ] **Step 6: Guard the two AI WebSockets**

For `ai_audio_socket` (line 913) and `ai_face_socket` (line 955), add the same token gate at the very top, before `await websocket.accept()`:

```python
    claims = decode_ws_token(websocket.query_params.get("token"))
    if claims is None:
        await websocket.close(code=1008)
        return
    await websocket.accept()
    # ... rest unchanged ...
```

- [ ] **Step 7: Send the token from the frontend**

In `frontend/src/hooks/useWebRTC.js`, import the token accessor at the top:

```javascript
import { getToken } from '../core/apiClient';
```

Change the WS URL build (line 191) to append the token:

```javascript
    const apiBase = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;
    const token = getToken();
    const wsUrl = apiBase.replace(/^http/, 'ws') + `/api/interviews/ws/${roomId}/${clientId}?token=${encodeURIComponent(token || '')}`;
```

In `frontend/src/hooks/useInterviewAnalysis.js` and `frontend/src/hooks/useAudioAnalyzer.js`, do the same at each `new WebSocket(WS_URL)` site — import `getToken` and change to:

```javascript
    const token = getToken();
    const socket = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token || '')}`);
```

(If `WS_URL` may already contain a query string, use `${WS_URL}${WS_URL.includes('?') ? '&' : '?'}token=...`.)

- [ ] **Step 8: Run backend tests + build the frontend**

Run: `python -m pytest tests/test_ws_auth.py -v` → PASS
Run: `cd frontend && npm run build` → build succeeds (no import errors)

- [ ] **Step 9: Commit**

```bash
git add backend/utils/ws_auth.py backend/routers/interviews.py backend/tests/test_ws_auth.py frontend/src/hooks/useWebRTC.js frontend/src/hooks/useInterviewAnalysis.js frontend/src/hooks/useAudioAnalyzer.js
git commit -m "fix(security): authenticate & authorize interview WebSockets"
```

---

### Task 3: Disable the unauthenticated test/demo routes in production

`GET /test/quiz` is explicitly unauthenticated and triggers real LLM work; the `/api/test-pipeline/*` router writes fake data into the real DB. Stop mounting them when `IS_PRODUCTION`.

**Files:**
- Modify: `backend/main.py` (router registration lines 160-162)
- Modify: `backend/routers/quiz.py` (`/test/quiz` at line 1193 — belt-and-suspenders guard)
- Test: `backend/tests/test_test_routes_disabled.py`

**Interfaces:**
- Consumes: `IS_PRODUCTION` from `config` (Task 0).

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_test_routes_disabled.py
import importlib
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _routes_for_env(env, monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", env)
    import config
    importlib.reload(config)
    import main
    importlib.reload(main)
    return {getattr(r, "path", None) for r in main.app.routes}


def test_test_routes_absent_in_production(monkeypatch):
    paths = _routes_for_env("production", monkeypatch)
    assert "/test/quiz" not in paths
    assert not any(p and p.startswith("/api/test-pipeline") for p in paths)


def test_test_routes_present_in_development(monkeypatch):
    paths = _routes_for_env("development", monkeypatch)
    assert any(p and p.startswith("/api/test-pipeline") for p in paths)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_test_routes_disabled.py -v`
Expected: FAIL — the test routers are always mounted.

- [ ] **Step 3: Gate the router registration**

In `backend/main.py`, add near the top imports:

```python
from config import IS_PRODUCTION
```

Wrap the three test-router mounts (currently lines 160-162) so only non-test routers always mount:

```python
app.include_router(quiz_router, prefix="/api")
if not IS_PRODUCTION:
    app.include_router(quiz_test_router, prefix="/test")
    app.include_router(test_pipeline_router, prefix="/api")
```

- [ ] **Step 4: Add a defensive guard inside the route**

In `backend/routers/quiz.py`, at the very start of `test_quiz_generation` (after line 1202's docstring), add:

```python
    from config import IS_PRODUCTION
    from fastapi import HTTPException
    if IS_PRODUCTION:
        raise HTTPException(status_code=404, detail="Not found")
```

- [ ] **Step 5: Run test to verify it passes**

Run: `python -m pytest tests/test_test_routes_disabled.py -v`
Expected: PASS (2 passed)

- [ ] **Step 6: Commit**

```bash
git add backend/main.py backend/routers/quiz.py backend/tests/test_test_routes_disabled.py
git commit -m "fix(security): do not mount test/demo routes in production"
```

---

### Task 4: Enforce upload validation (type + size)

The profile-image, document, and account-setup upload paths write client-supplied bytes with the client-supplied extension to `static/uploads/` and serve them back. Add an extension allow-list, a content-type check, and a size cap. No new system deps.

**Files:**
- Create: `backend/utils/uploads.py`
- Modify: `backend/routes/candidat/profile.py` (`upload_profile_image` line 270, `upload_document` line 315)
- Modify: `backend/routes/candidat/account_setup.py` (`_save_upload` line 65 and its callers)
- Test: `backend/tests/test_upload_validation.py`

**Interfaces:**
- Produces:
  - `IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}`
  - `DOC_EXTS = {".pdf", ".doc", ".docx"}`
  - `MAX_IMAGE_BYTES = 5 * 1024 * 1024`, `MAX_DOC_BYTES = 15 * 1024 * 1024`
  - `validate_upload(filename: str, data: bytes, *, allowed_exts: set, max_bytes: int, allowed_content_types: set | None = None, content_type: str | None = None) -> str` — returns the safe lowercased extension, or raises `HTTPException(400/413)`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_upload_validation.py
import os
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.uploads import validate_upload, IMAGE_EXTS, MAX_IMAGE_BYTES


def test_accepts_valid_png():
    ext = validate_upload("photo.PNG", b"x" * 10, allowed_exts=IMAGE_EXTS, max_bytes=MAX_IMAGE_BYTES)
    assert ext == ".png"


def test_rejects_disallowed_extension():
    with pytest.raises(HTTPException) as e:
        validate_upload("evil.svg", b"<svg/>", allowed_exts=IMAGE_EXTS, max_bytes=MAX_IMAGE_BYTES)
    assert e.value.status_code == 400


def test_rejects_no_extension():
    with pytest.raises(HTTPException) as e:
        validate_upload("noext", b"x", allowed_exts=IMAGE_EXTS, max_bytes=MAX_IMAGE_BYTES)
    assert e.value.status_code == 400


def test_rejects_oversize():
    with pytest.raises(HTTPException) as e:
        validate_upload("big.png", b"x" * (MAX_IMAGE_BYTES + 1), allowed_exts=IMAGE_EXTS, max_bytes=MAX_IMAGE_BYTES)
    assert e.value.status_code == 413
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_upload_validation.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'utils.uploads'`

- [ ] **Step 3: Create the helper**

```python
# backend/utils/uploads.py
import os
from typing import Optional
from fastapi import HTTPException

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
DOC_EXTS = {".pdf", ".doc", ".docx"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_DOC_BYTES = 15 * 1024 * 1024


def validate_upload(
    filename: str,
    data: bytes,
    *,
    allowed_exts: set,
    max_bytes: int,
    allowed_content_types: Optional[set] = None,
    content_type: Optional[str] = None,
) -> str:
    """Validate an uploaded file. Returns the safe lowercased extension.

    Raises HTTPException 400 (bad type) or 413 (too large).
    """
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > max_bytes:
        raise HTTPException(status_code=413, detail="File too large")
    ext = os.path.splitext(filename or "")[1].lower()
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail=f"File type not allowed: {ext or 'none'}")
    if allowed_content_types and content_type and content_type not in allowed_content_types:
        raise HTTPException(status_code=400, detail=f"Content-type not allowed: {content_type}")
    return ext
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_upload_validation.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Wire it into the upload handlers**

In `backend/routes/candidat/profile.py`, add the import at the top:

```python
from utils.uploads import validate_upload, IMAGE_EXTS, DOC_EXTS, MAX_IMAGE_BYTES, MAX_DOC_BYTES
```

In `upload_profile_image` (line 270), after `file_bytes = await file.read()` and before computing `ext`/`filename`, replace the raw `ext = os.path.splitext(...)` line with a validated one:

```python
        file_bytes = await file.read()
        ext = validate_upload(file.filename, file_bytes,
                              allowed_exts=IMAGE_EXTS, max_bytes=MAX_IMAGE_BYTES,
                              content_type=file.content_type)
        filename = f"{user_id}_{secrets.token_hex(8)}{ext}"
```

In `upload_document` (line 315), after `file_bytes = await file.read()`:

```python
    file_bytes = await file.read()
    ext = validate_upload(file.filename, file_bytes,
                          allowed_exts=DOC_EXTS, max_bytes=MAX_DOC_BYTES,
                          content_type=file.content_type)
    disk_name = f"{user_id}_{secrets.token_hex(8)}{ext}"
```

In `backend/routes/candidat/account_setup.py`, change `_save_upload` (line 65) to validate before writing. It currently takes `(file_bytes, original_filename, user_id)`; add allowed-exts/max-bytes params so CV vs certificate can be tuned by the caller:

```python
def _save_upload(file_bytes: bytes, original_filename: str, user_id: str,
                 *, allowed_exts=DOC_EXTS, max_bytes=MAX_DOC_BYTES) -> str:
    """Validate then save bytes under static/uploads and return the relative path."""
    ext = validate_upload(original_filename, file_bytes,
                          allowed_exts=allowed_exts, max_bytes=max_bytes)
    disk_name = f"{user_id}_{secrets.token_hex(8)}{ext}"
    path = os.path.join(UPLOAD_DIR, disk_name)
    with open(path, "wb") as f:
        f.write(file_bytes)
    return f"static/uploads/{disk_name}"
```

Add the matching import at the top of `account_setup.py`:

```python
from utils.uploads import validate_upload, DOC_EXTS, MAX_DOC_BYTES
```

(Callers of `_save_upload` keep working via the defaults; no call-site change needed.)

- [ ] **Step 6: Re-run the validation test + import-check the touched modules**

Run: `python -m pytest tests/test_upload_validation.py -v` → PASS
Run: `python -c "import routes.candidat.profile, routes.candidat.account_setup"` → no ImportError

- [ ] **Step 7: Commit**

```bash
git add backend/utils/uploads.py backend/routes/candidat/profile.py backend/routes/candidat/account_setup.py backend/tests/test_upload_validation.py
git commit -m "fix(security): validate upload type and size on candidate uploads"
```

---

### Task 5: Rate-limit the auth endpoints

No throttling exists on login, register, password reset, or verification-code endpoints. Add `slowapi` (in-process) and cap the sensitive auth routes.

**Files:**
- Modify: `backend/requirements.txt` (add `slowapi`)
- Create: `backend/utils/ratelimit.py`
- Modify: `backend/main.py` (register limiter + exception handler)
- Modify: `backend/auth.py` (decorate `login`, `register`, `forgot-password`, `verify-account-code`, `resend-verification-code`)
- Test: `backend/tests/test_rate_limit.py`

**Interfaces:**
- Produces: `limiter = Limiter(key_func=get_remote_address)` importable from `utils.ratelimit`.
- Consumes: `slowapi` (new dependency).

- [ ] **Step 1: Add the dependency**

Append to `backend/requirements.txt`:

```
slowapi
```

Then install into the backend venv:

Run: `pip install slowapi`
Expected: installs `slowapi` and its `limits` dependency.

- [ ] **Step 2: Write the failing test**

```python
# backend/tests/test_rate_limit.py
import os
import sys
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app

client = TestClient(app)


def test_login_is_rate_limited():
    # Wrong creds return 401/400; after the limit we expect 429 within the window.
    codes = [client.post("/api/auth/login", json={"email": "x@x.io", "password": "nope"}).status_code
             for _ in range(12)]
    assert 429 in codes
```

- [ ] **Step 3: Run test to verify it fails**

Run: `python -m pytest tests/test_rate_limit.py -v`
Expected: FAIL — no 429 ever returned.

- [ ] **Step 4: Create the limiter**

```python
# backend/utils/ratelimit.py
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
```

- [ ] **Step 5: Register the limiter in main.py**

In `backend/main.py`, add imports:

```python
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from utils.ratelimit import limiter
```

After `app = FastAPI(lifespan=lifespan)` (line 128), register it:

```python
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

- [ ] **Step 6: Decorate the sensitive endpoints**

In `backend/auth.py`, add:

```python
from fastapi import Request
from utils.ratelimit import limiter
```

`slowapi` requires the handler to accept a `request: Request` argument. Add `request: Request` as the **first** parameter of each decorated endpoint and apply the decorator. Apply these limits:

- `login` → `@limiter.limit("10/minute")`
- `register` → `@limiter.limit("5/minute")`
- `forgot_password` → `@limiter.limit("5/minute")`
- `verify_account_code` → `@limiter.limit("10/minute")`
- `resend_verification_code` → `@limiter.limit("3/minute")`

Example for `login` (lines 26-27), preserving `BackgroundTasks` and the body:

```python
@router.post("/login", tags=["auth"])
@limiter.limit("10/minute")
async def login(request: Request, background_tasks: BackgroundTasks, payload: dict = Body(...)):
```

Repeat the pattern (add `request: Request` first, add `@limiter.limit(...)` under the route decorator) for the other four. Do not otherwise change their bodies.

- [ ] **Step 7: Run test to verify it passes**

Run: `python -m pytest tests/test_rate_limit.py -v`
Expected: PASS — a 429 appears once the 10/minute login cap is crossed.

- [ ] **Step 8: Commit**

```bash
git add backend/requirements.txt backend/utils/ratelimit.py backend/main.py backend/auth.py backend/tests/test_rate_limit.py
git commit -m "fix(security): rate-limit auth endpoints with slowapi"
```

---

## Phase 2 — Medium hardening

### Task 6: Replace hardcoded localhost URLs with existing env config

Interview invite/reminder emails and the profile-image URL hardcode `localhost`, so in production they point at dead hosts. Read the already-defined `FRONTEND_URL` env var (backend) instead. No new secrets.

**Files:**
- Modify: `backend/routers/interviews.py` (line 182)
- Modify: `backend/utils/schedulers.py` (line 79)
- Modify: `backend/routes/candidat/profile.py` (line 302)
- Verify only (no change expected): `backend/routers/team.py` (already uses `FRONTEND_URL`)
- Test: `backend/tests/test_no_hardcoded_localhost.py`

**Interfaces:**
- Consumes: `os.getenv("FRONTEND_URL", ...)`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_no_hardcoded_localhost.py
import os
import re

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGETS = [
    "routers/interviews.py",
    "utils/schedulers.py",
    "routes/candidat/profile.py",
]


def test_no_hardcoded_localhost_urls():
    offenders = []
    for rel in TARGETS:
        with open(os.path.join(BASE, rel), encoding="utf-8") as fh:
            for i, line in enumerate(fh, 1):
                if re.search(r"https?://localhost", line) and "getenv" not in line:
                    offenders.append(f"{rel}:{i}")
    assert not offenders, f"Hardcoded localhost URLs: {offenders}"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_no_hardcoded_localhost.py -v`
Expected: FAIL — lists the three offending lines.

- [ ] **Step 3: Fix interviews.py (line 182)**

```python
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
        link = f"{frontend_url}/candidat/interviews/room/{interview_id}"
```

(`os` is already imported in this module.)

- [ ] **Step 4: Fix schedulers.py (line 79)**

```python
                frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
                link = f"{frontend_url}/candidat/interviews/room/{interview_id}"
```

Confirm `import os` is present at the top of `utils/schedulers.py`; add it if missing.

- [ ] **Step 5: Fix profile.py (line 302)**

The image URL should be built from the API base, not hardcoded. Return a relative path and let the frontend resolve it, OR read an env base. To avoid a new env var, return the relative static path (the frontend already knows the API origin):

```python
        # Relative URL; the frontend prefixes it with VITE_API_URL.
        url = f"/static/uploads/{filename}"
```

> Note: if any stored records or frontend code expect an absolute URL here, prefer reading an existing base (`os.getenv("FRONTEND_URL")` is a page origin, not the API origin — do NOT use it for a `/static` asset). The relative path is the safe, dependency-free choice; verify the image renders in the profile UI after the change.

- [ ] **Step 6: Run test to verify it passes**

Run: `python -m pytest tests/test_no_hardcoded_localhost.py -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/routers/interviews.py backend/utils/schedulers.py backend/routes/candidat/profile.py backend/tests/test_no_hardcoded_localhost.py
git commit -m "fix: use FRONTEND_URL instead of hardcoded localhost in emails/links"
```

---

### Task 7: Strengthen password policy & remove the hardcoded default password

Minimum length is 6 and `admin_create_user` falls back to a hardcoded `TempPassword123!`. Raise the floor to 8 and require the admin to supply a password (or generate a random one).

**Files:**
- Modify: `backend/auth.py` (`change_password` line 491, `reset_password` line 527, `admin_create_user` line 152)
- Test: `backend/tests/test_password_policy.py`

**Interfaces:**
- Produces: `MIN_PASSWORD_LEN = 8` module constant in `auth.py`; `_validate_password(pw: str) -> None` raising `HTTPException(400)`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_password_policy.py
import os
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import auth


def test_short_password_rejected():
    with pytest.raises(HTTPException) as e:
        auth._validate_password("abc123")
    assert e.value.status_code == 400


def test_valid_password_ok():
    auth._validate_password("abcd1234")  # no exception
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_password_policy.py -v`
Expected: FAIL — `auth._validate_password` does not exist.

- [ ] **Step 3: Add the helper and constant**

In `backend/auth.py`, after the `pwd_context` definition (line 23):

```python
MIN_PASSWORD_LEN = 8


def _validate_password(pw: str) -> None:
    if not pw or len(pw) < MIN_PASSWORD_LEN:
        raise HTTPException(status_code=400, detail=f"Password must be at least {MIN_PASSWORD_LEN} characters")
```

Replace the two inline `if len(new_password) < 6:` checks in `change_password` (line 491) and `reset_password` (line 527) with:

```python
    _validate_password(new_password)
```

- [ ] **Step 4: Remove the hardcoded default in admin_create_user**

Change line 152 from:

```python
    password = payload.get("password", "") or "TempPassword123!"
```

to a random default so no shared static password is ever set:

```python
    password = payload.get("password") or secrets.token_urlsafe(12)
```

(`secrets` is already imported at the top of `auth.py`.)

- [ ] **Step 5: Run test to verify it passes**

Run: `python -m pytest tests/test_password_policy.py -v`
Expected: PASS (2 passed)

- [ ] **Step 6: Commit**

```bash
git add backend/auth.py backend/tests/test_password_policy.py
git commit -m "fix(security): raise password floor to 8, drop hardcoded default password"
```

---

### Task 8: Tighten CORS, disable API docs in production, drop the root stub

CORS currently allows all methods/headers with credentials; `/docs` + `/openapi.json` are open; `GET /` returns a `Hello World` stub. Narrow all three in production.

**Files:**
- Modify: `backend/main.py` (CORS middleware lines 133-139, `FastAPI(...)` line 128, `read_root` line 175)
- Test: `backend/tests/test_cors_and_docs.py`

**Interfaces:**
- Consumes: `IS_PRODUCTION` from `config`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_cors_and_docs.py
import importlib
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _app_for_env(env, monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", env)
    import config
    importlib.reload(config)
    import main
    importlib.reload(main)
    return main.app


def test_docs_disabled_in_production(monkeypatch):
    app = _app_for_env("production", monkeypatch)
    paths = {getattr(r, "path", None) for r in app.routes}
    assert "/docs" not in paths
    assert "/openapi.json" not in paths


def test_docs_enabled_in_development(monkeypatch):
    app = _app_for_env("development", monkeypatch)
    paths = {getattr(r, "path", None) for r in app.routes}
    assert "/docs" in paths
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_cors_and_docs.py -v`
Expected: FAIL — `/docs` present in production.

- [ ] **Step 3: Disable docs in production**

In `backend/main.py`, change line 128:

```python
app = FastAPI(
    lifespan=lifespan,
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)
```

(`IS_PRODUCTION` import is added in Task 3.)

- [ ] **Step 4: Narrow CORS**

Replace the middleware block (lines 133-139):

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
```

- [ ] **Step 5: Drop the root stub**

Remove the `read_root` handler (lines 175-177). If a health endpoint is wanted, replace with a minimal one that leaks nothing:

```python
@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `python -m pytest tests/test_cors_and_docs.py -v`
Expected: PASS (2 passed)

- [ ] **Step 7: Commit**

```bash
git add backend/main.py backend/tests/test_cors_and_docs.py
git commit -m "fix(security): tighten CORS, disable docs in prod, remove root stub"
```

---

### Task 9: Harden the candidate TOTP verify endpoint

`verify_totp` takes the code as a query parameter (leaks into logs/proxies/history). Move it to the request body.

**Files:**
- Modify: `backend/routes/candidat/twofa.py` (`verify_totp` line 40)
- Test: `backend/tests/test_totp_verify.py`

**Interfaces:**
- Produces: `POST /api/candidat/2fa/totp/verify` now reads `{"code": "..."}` from the JSON body.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_totp_verify.py
import inspect
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from routes.candidat import twofa


def test_verify_totp_does_not_use_query_param():
    sig = inspect.signature(twofa.verify_totp)
    # 'code' must no longer be a bare str query param; it comes from the body.
    assert "code" not in sig.parameters or sig.parameters["code"].annotation is not str
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_totp_verify.py -v`
Expected: FAIL — `code: str` is still a query param.

- [ ] **Step 3: Move code into the body**

In `backend/routes/candidat/twofa.py`, add `Body` to the FastAPI import (line 6):

```python
from fastapi import APIRouter, HTTPException, Header, Query, Body
```

Change `verify_totp` (line 40-41):

```python
@router.post("/2fa/totp/verify", tags=["candidat"])
async def verify_totp(payload: dict = Body(...), authorization: Optional[str] = Header(None)):
    """Verify a TOTP code and enable TOTP 2FA."""
    code = (payload.get("code") or "").strip()
    user_id = get_user_id_from_token(authorization)
```

(The rest of the body is unchanged — it already uses `code`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_totp_verify.py -v`
Expected: PASS

- [ ] **Step 5: Update the frontend caller (if present)**

Search the frontend for the TOTP verify call and change it from a query string to a JSON body:

Run: `cd frontend && git grep -n "2fa/totp/verify"`
For each hit, ensure the request sends `{ code }` in the body (POST JSON) rather than `?code=`.

- [ ] **Step 6: Commit**

```bash
git add backend/routes/candidat/twofa.py backend/tests/test_totp_verify.py frontend/
git commit -m "fix(security): accept TOTP code in request body, not query param"
```

---

## Phase 3 — Larger fix (include if scope allows)

### Task 10: Enforce 2FA at login (challenge/response)

2FA is currently decorative: `login` issues a full token on password success and never checks `totp_enabled`. Make login return a "2FA required" challenge for candidates who enabled TOTP, and add a second endpoint that verifies the code and issues the token. This is the largest task; it changes the login contract, so update the frontend login flow too.

**Files:**
- Modify: `backend/auth.py` (`login` line 26)
- Modify: `backend/routes/candidat/twofa.py` (add a login-verify endpoint that issues the JWT)
- Modify: frontend login flow (the component that calls `/api/auth/login` — find via grep)
- Test: `backend/tests/test_login_2fa.py`

**Interfaces:**
- Produces:
  - `login` returns `{"twofa_required": True, "method": "totp", "user_id": ...}` (HTTP 200, **no token**) when the user has `totp_enabled`; otherwise the existing token response is unchanged.
  - `POST /api/candidat/2fa/login-verify` body `{"user_id": ..., "code": ...}` → returns the same token payload `login` normally returns, only if the TOTP code verifies.
- Consumes: `create_access_token` (from `dependencies`), the candidate `totp_secret`/`totp_enabled` in Mongo.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_login_2fa.py
import inspect
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from routes.candidat import twofa


def test_login_verify_endpoint_exists():
    assert hasattr(twofa, "login_verify_totp")
    sig = inspect.signature(twofa.login_verify_totp)
    assert "payload" in sig.parameters
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_login_2fa.py -v`
Expected: FAIL — `login_verify_totp` does not exist.

- [ ] **Step 3: Short-circuit login when 2FA is enabled**

In `backend/auth.py` `login`, after the password/status checks pass and **before** `create_access_token` (line 52), look up 2FA state in Mongo and, if enabled, return a challenge instead of a token:

```python
    mongo_client = connect_mongodb()
    if mongo_client is not None:
        cand = mongo_client["HumatiQ"]["candidates"].find_one(
            {"user_id": user["id"]}, {"totp_enabled": 1})
        if cand and cand.get("totp_enabled"):
            return {"twofa_required": True, "method": "totp", "user_id": user["id"]}
```

(`connect_mongodb` is already imported at the top of `auth.py`.)

- [ ] **Step 4: Add the login-verify endpoint**

In `backend/routes/candidat/twofa.py`, add:

```python
import pyotp
from dependencies import create_access_token
from database.mysql import get_db, row


@router.post("/2fa/login-verify", tags=["candidat"])
async def login_verify_totp(payload: dict = Body(...)):
    """Second step of 2FA login: verify TOTP, then issue the JWT."""
    user_id = (payload.get("user_id") or "").strip()
    code = (payload.get("code") or "").strip()
    if not user_id or not code:
        raise HTTPException(status_code=400, detail="user_id and code required")

    collection = get_candidates_collection()
    doc = collection.find_one({"user_id": user_id}, {"totp_secret": 1, "totp_enabled": 1})
    if not doc or not doc.get("totp_enabled") or "totp_secret" not in doc:
        raise HTTPException(status_code=400, detail="2FA not enabled")
    if not pyotp.TOTP(doc["totp_secret"]).verify(code):
        raise HTTPException(status_code=401, detail="Invalid code")

    db_gen = get_db()
    db = next(db_gen)
    try:
        with db.cursor() as cursor:
            u = row(cursor,
                    "SELECT u.email, p.role FROM users u JOIN profiles p ON p.id = u.id WHERE u.id = %s",
                    (user_id,))
    finally:
        try: next(db_gen)
        except StopIteration: pass
    if not u:
        raise HTTPException(status_code=404, detail="Account not found")

    token = create_access_token({"id": user_id, "email": u["email"], "role": u["role"]})
    return {"access_token": token, "token_type": "bearer", "role": u["role"], "id": user_id, "email": u["email"]}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `python -m pytest tests/test_login_2fa.py -v`
Expected: PASS

- [ ] **Step 6: Update the frontend login flow**

Find the login handler:

Run: `cd frontend && git grep -n "/api/auth/login"`
When the response contains `twofa_required`, route the user to a code-entry screen and POST `{ user_id, code }` to `/api/candidat/2fa/login-verify`; store the returned token via the existing `saveAuth`/`setToken` path. Rebuild: `npm run build`.

- [ ] **Step 7: Commit**

```bash
git add backend/auth.py backend/routes/candidat/twofa.py backend/tests/test_login_2fa.py frontend/
git commit -m "feat(security): enforce candidate 2FA at login via challenge/response"
```

---

## Deliberately deferred (NOT in this plan)

Listed so nothing is silently dropped — each is either out of the requested scope or needs a design decision first:

- **Secret rotation / moving `backend/.env` out of the repo tree** — infra/config, excluded per request. (Still the single most urgent real-world action.)
- **TURN server for WebRTC** — infra, excluded per request.
- **`MONGODB_ATLAS_TLS_INSECURE` / MongoDB TLS** — infra/config, excluded per request.
- **Server-side JWT revocation on logout** — requires a persistent revocation store (new table) and a per-request check (perf/caching), more invasive than a code tweak; revisit as its own plan. Interim mitigation available via config only (shorter `ACCESS_TOKEN_EXPIRE_MINUTES`), which is out of code scope.
- **Full cross-company tenant isolation on candidate records** — needs a candidate↔company data-model decision (see note under Task 1).
- **Multi-instance scheduler safety** and **container/model sizing** — operational, not a code vulnerability.
- **Replacing ~143 `print()` calls with structured logging** — hygiene; the security-relevant OAuth debug prints in `external_auth.py` can be removed opportunistically but aren't tracked as a task here.

---

## Self-Review

- **Spec coverage:** Audit findings #2 (Task 6), #4 (Task 2), #5 (Task 3), #6 (Task 5), #7 (Task 1), #8 (Task 10), #9 (Task 4), #11 (Task 9), #12 (Task 8), #16 (Task 7), plus docs/root hardening (Task 8). Excluded-by-request: #1, #3, #10, #13. Deferred-with-rationale: #14, #15, tenant isolation, logging. All accounted for.
- **Type/name consistency:** `require_roles(list)`, `HR_SIDE_ROLES` (Task 1); `decode_ws_token`/`user_is_interview_participant` (Task 2); `validate_upload`/`IMAGE_EXTS`/`DOC_EXTS`/`MAX_*` (Task 4); `limiter` (Task 5); `_validate_password`/`MIN_PASSWORD_LEN` (Task 7); `IS_PRODUCTION` (Tasks 0/3/8); `login_verify_totp` (Task 10) — each defined once and referenced consistently.
- **Placeholder scan:** every code step shows the actual code; every run step shows the command and expected result. None outstanding.
