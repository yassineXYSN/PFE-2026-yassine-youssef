# Demo-account owner-gated 2FA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Demo accounts can only enter the app after clearing an owner-emailed 2FA on each new device; the owner can monitor and revoke access.

**Architecture:** All demo state lives in MongoDB (`hr_profiles` fields + 3 new collections), keyed by `user_id`. The existing `POST /auth/login` gains a demo branch that either passes trusted devices straight through or returns a `demo_2fa_required` challenge; a new `POST /auth/demo/verify-code` completes the challenge. SuperAdmin endpoints expose audit/devices/revoke. Frontend adds a demo checkbox at user creation, a device-code screen in the HR login flow, and a "Sécurité Démo" SuperAdmin page.

**Tech Stack:** FastAPI + PyMySQL + PyMongo (backend), React + Vite (frontend), SMTP via `utils/email_utils.send_email`, pytest.

## Global Constraints

- **No MariaDB schema migration.** All new state is MongoDB only. (SQL tables are provisioned out-of-band.)
- **Owner email:** read from env `OWNER_2FA_EMAIL`, default `yassinechtourou03@gmail.com`. Never email codes to the demo user.
- **Non-demo accounts and candidates must behave exactly as today** (regression guard required).
- **Codes:** 6 numeric digits, ~10 min TTL, one-time use.
- **Single active device:** at most one non-revoked `demo_trusted_devices` doc per `user_id`.
- **Mongo DB name:** `HumatiQ`. Profiles collection: `hr_profiles` (`_id` == user_id). Email util signature: `send_email(to_email, subject, content)` (sync; call via `BackgroundTasks.add_task` or a thread — never `await`).
- **JWT issue shape** (must match existing): `create_access_token({"id": id, "email": email, "role": role})`; login/verify responses return `{access_token, token_type:"bearer", role, id, email}`.
- Frontend token/device storage: `localStorage`. Device id key: `humatiq_device_id`. Auth stored via `setAuth({access_token, role, id, email})` from `core/apiClient.js`.
- Commit frequently with conventional-commit messages, ending each with the `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer. Work only on branch `dev_feature_demo_2fa`. **Do not push.**

---

## File Structure

**Backend**
- Create `backend/utils/demo_security.py` — all demo helpers (flag lookup, code mint/verify, device trust, audit, UA→label, owner emails).
- Modify `backend/auth.py` — demo branch in `login`; new `/auth/demo/verify-code`, `/auth/demo/audit`, `/auth/demo/devices`, `/auth/demo/revoke-device`.
- Modify `backend/models/profile.py` — add `is_demo`, `demo_expires_at` to `ProfileBase`, `ProfileCreate`, `ProfileUpdate`.
- Modify `backend/routers/profiles.py` — persist the two new fields on create/update.
- Modify `backend/scripts/create_indexes.py` — indexes for the 3 new collections.
- Create `backend/tests/test_demo_security.py` — unit tests for helpers + endpoints (mock email + Mongo where practical).

**Frontend**
- Modify `frontend/src/apps/SuperAdmin/users/UsersList.jsx` (+ `.css`) — demo checkbox, expiry field, "Démo" badge.
- Modify `frontend/src/apps/HR/login/Login.jsx` — send `device_id`; handle `demo_2fa_required`.
- Create `frontend/src/apps/HR/demo/DemoVerify.jsx` (+ `.css`) — device code screen.
- Modify `frontend/src/core/routesHr.jsx` — route `/hr/demo-verify`.
- Create `frontend/src/apps/SuperAdmin/security/DemoSecurity.jsx` (+ `.css`) — audit + devices + revoke.
- Modify `frontend/src/core/routesSuperAdmin.jsx` — route `/superadmin/demo-security`.
- Modify `frontend/src/apps/SuperAdmin/components/SuperAdminSidebar.jsx` — sidebar entry.

---

## API Contract (authoritative — both agents build to this)

**`POST /api/auth/login`** — request may include `device_id` (string, optional). New responses for demo accounts:
- Trusted device or non-demo → `200 {access_token, token_type, role, id, email}` (unchanged shape).
- New/unknown device on a demo account → `200 {demo_2fa_required: true, method: "owner_email", user_id, device_id}` (no token).
- Expired demo → `403 {detail: "Demo period ended"}`.

**`POST /api/auth/demo/verify-code`** — body `{user_id, device_id, code}` →
- success `200 {access_token, token_type, role, id, email}`
- failure `400 {detail: "Invalid or expired code"}`

**`GET /api/auth/demo/audit?user_id=&limit=`** (superadmin) → `200 [{user_id, email, event, ip, user_agent, device_id, created_at}...]` newest first.

**`GET /api/auth/demo/devices`** (superadmin) → `200 [{device_id, user_id, email, label, ip, created_at, last_seen_at}...]` (non-revoked only).

**`POST /api/auth/demo/revoke-device`** (superadmin) — body `{device_id}` → `200 {message: "revoked"}`.

**Profiles** — `POST /api/profiles` and `PUT /api/profiles/{id}` accept optional `is_demo: bool` and `demo_expires_at: str|null` (ISO date/datetime).

---

# BACKEND WORKSTREAM

### Task B1: `demo_security` helper module

**Files:**
- Create: `backend/utils/demo_security.py`
- Test: `backend/tests/test_demo_security.py`

**Interfaces — Produces:**
```python
OWNER_2FA_EMAIL: str                       # env OWNER_2FA_EMAIL, default yassinechtourou03@gmail.com
def get_demo_profile(mongo_db, user_id) -> dict | None      # hr_profiles doc if is_demo truthy, else None
def is_demo_expired(profile: dict) -> bool                  # True if demo_expires_at set and in the past (UTC)
def device_label_from_ua(user_agent: str) -> str           # e.g. "Chrome on Windows"; "Unknown device" fallback
def find_trusted_device(mongo_db, user_id, device_id) -> dict | None   # non-revoked match
def issue_demo_code(mongo_db, user_id, device_id, ip, user_agent) -> str
    # invalidates prior unconsumed codes for user_id, inserts new 6-digit code (expires_at = now+10m), returns code
def verify_demo_code(mongo_db, user_id, device_id, code) -> bool
    # True iff a matching, unconsumed, unexpired code exists; marks it consumed on success
def trust_device_single(mongo_db, user_id, device_id, ip, user_agent) -> list[str]
    # revokes all other non-revoked devices for user_id (returns their device_ids), upserts this one as trusted
def revoke_device(mongo_db, device_id) -> bool
def mint_device_id() -> str                                # secrets.token_urlsafe(32)
def audit(mongo_db, user_id, email, event, ip=None, user_agent=None, device_id=None) -> None
def send_owner_code_email(background_tasks, code, account_email, ip, user_agent) -> None
def send_owner_login_alert(background_tasks, account_email, ip, user_agent, device_label) -> None
```
Collections: `demo_access_codes`, `demo_trusted_devices`, `demo_login_audit`. Use `datetime.now(timezone.utc)`; store all timestamps tz-aware. Emails go through `from utils.email_utils import send_email` added as a background task: `background_tasks.add_task(send_email, OWNER_2FA_EMAIL, subject, content)`.

- [ ] **Step 1: Write failing tests** in `backend/tests/test_demo_security.py`. Use `mongomock` if available, else a lightweight fake; check what existing tests use first (`backend/tests/`). Cover:
```python
def test_issue_code_is_six_digits_and_consumable(db):
    code = issue_demo_code(db, "u1", "dev1", "1.1.1.1", "UA")
    assert code.isdigit() and len(code) == 6
    assert verify_demo_code(db, "u1", "dev1", code) is True
    assert verify_demo_code(db, "u1", "dev1", code) is False  # one-time

def test_expired_code_rejected(db):
    code = issue_demo_code(db, "u1", "dev1", "1.1.1.1", "UA")
    db.demo_access_codes.update_one({"user_id":"u1"}, {"$set":{"expires_at": datetime.now(timezone.utc)-timedelta(minutes=1)}})
    assert verify_demo_code(db, "u1", "dev1", code) is False

def test_issue_invalidates_previous(db):
    c1 = issue_demo_code(db, "u1", "dev1", "1.1.1.1", "UA")
    c2 = issue_demo_code(db, "u1", "dev1", "1.1.1.1", "UA")
    assert verify_demo_code(db, "u1", "dev1", c1) is False
    assert verify_demo_code(db, "u1", "dev1", c2) is True

def test_trust_device_single_revokes_others(db):
    trust_device_single(db, "u1", "devA", "1.1.1.1", "UA")
    revoked = trust_device_single(db, "u1", "devB", "1.1.1.1", "UA")
    assert "devA" in revoked
    assert find_trusted_device(db, "u1", "devA") is None
    assert find_trusted_device(db, "u1", "devB") is not None

def test_is_demo_expired():
    assert is_demo_expired({"demo_expires_at": None}) is False
    assert is_demo_expired({"demo_expires_at": datetime.now(timezone.utc)-timedelta(days=1)}) is True
    assert is_demo_expired({"demo_expires_at": datetime.now(timezone.utc)+timedelta(days=1)}) is False
```
- [ ] **Step 2:** Run `cd backend && venv/Scripts/python -m pytest tests/test_demo_security.py -v` → FAIL (module missing).
- [ ] **Step 3:** Implement `demo_security.py` per the interface above. `is_demo_expired` must handle both tz-aware and naive stored datetimes (coerce naive → UTC). `device_label_from_ua` does simple substring detection (Chrome/Firefox/Safari/Edge × Windows/Mac/Linux/Android/iOS).
- [ ] **Step 4:** Run the tests → PASS.
- [ ] **Step 5:** Commit `feat(backend): demo_security helper module`.

### Task B2: Login demo branch + verify-code endpoint

**Files:**
- Modify: `backend/auth.py` (login ~34-78; add new endpoint)
- Test: `backend/tests/test_demo_security.py` (append endpoint tests, or a sibling using FastAPI `TestClient`)

**Interfaces — Consumes:** all of B1. **Produces:** the two `/auth/login` demo responses and `POST /auth/demo/verify-code` per the API Contract.

Login change (insert after the existing status checks, before the candidate-TOTP block; use the request to get client IP `request.client.host` and `request.headers.get("user-agent")`, and read `device_id` from `payload`):
```python
    device_id = (payload.get("device_id") or "").strip() or None
    mongo_client = connect_mongodb()
    mongo_db = mongo_client["HumatiQ"] if mongo_client is not None else None
    if mongo_db is not None:
        demo_profile = get_demo_profile(mongo_db, user["id"])
        if demo_profile is not None:
            ip = request.client.host if request.client else None
            ua = request.headers.get("user-agent", "")
            if is_demo_expired(demo_profile):
                audit(mongo_db, user["id"], user["email"], "expired_block", ip, ua, device_id)
                raise HTTPException(status_code=403, detail="Demo period ended")
            if device_id and find_trusted_device(mongo_db, user["id"], device_id):
                trust_device_single(mongo_db, user["id"], device_id, ip, ua)  # refresh last_seen
                audit(mongo_db, user["id"], user["email"], "login_success", ip, ua, device_id)
                send_owner_login_alert(background_tasks, user["email"], ip, ua, device_label_from_ua(ua))
                token = create_access_token({"id": user["id"], "email": user["email"], "role": user["role"]})
                return {"access_token": token, "token_type": "bearer", "role": user["role"], "id": user["id"], "email": user["email"]}
            new_device_id = mint_device_id()
            code = issue_demo_code(mongo_db, user["id"], new_device_id, ip, ua)
            audit(mongo_db, user["id"], user["email"], "gate_challenged", ip, ua, new_device_id)
            send_owner_code_email(background_tasks, code, user["email"], ip, ua)
            return {"demo_2fa_required": True, "method": "owner_email", "user_id": user["id"], "device_id": new_device_id}
```
(The existing candidate-TOTP block and normal token return stay below, unchanged, for non-demo users.)

New endpoint (place near login; rate-limit like other auth endpoints):
```python
@router.post("/demo/verify-code", tags=["auth"])
@limiter.limit("10/minute")
async def demo_verify_code(request: Request, background_tasks: BackgroundTasks, payload: dict = Body(...)):
    user_id = (payload.get("user_id") or "").strip()
    device_id = (payload.get("device_id") or "").strip()
    code = (payload.get("code") or "").strip()
    if not user_id or not device_id or not code:
        raise HTTPException(status_code=400, detail="user_id, device_id and code required")
    mongo_client = connect_mongodb()
    mongo_db = mongo_client["HumatiQ"]
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent", "")
    # look up account email/role from MariaDB
    db_gen = get_db(); db = next(db_gen)
    try:
        with db.cursor() as cursor:
            u = row(cursor, "SELECT u.email, p.role FROM users u JOIN profiles p ON p.id = u.id WHERE u.id = %s", (user_id,))
    finally:
        try: next(db_gen)
        except StopIteration: pass
    if not u:
        raise HTTPException(status_code=404, detail="Account not found")
    if not verify_demo_code(mongo_db, user_id, device_id, code):
        audit(mongo_db, user_id, u["email"], "code_failed", ip, ua, device_id)
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    trust_device_single(mongo_db, user_id, device_id, ip, ua)
    audit(mongo_db, user_id, u["email"], "code_verified", ip, ua, device_id)
    audit(mongo_db, user_id, u["email"], "device_trusted", ip, ua, device_id)
    audit(mongo_db, user_id, u["email"], "login_success", ip, ua, device_id)
    send_owner_login_alert(background_tasks, u["email"], ip, ua, device_label_from_ua(ua))
    token = create_access_token({"id": user_id, "email": u["email"], "role": u["role"]})
    return {"access_token": token, "token_type": "bearer", "role": u["role"], "id": user_id, "email": u["email"]}
```
Add imports at top of `auth.py`, combining with existing import lines (Python edit hook strips unused imports — add each new import already used in this task):
```python
from utils.demo_security import (
    get_demo_profile, is_demo_expired, find_trusted_device, trust_device_single,
    mint_device_id, issue_demo_code, verify_demo_code, audit, device_label_from_ua,
    send_owner_code_email, send_owner_login_alert,
)
```

- [ ] **Step 1:** Write failing `TestClient` tests: (a) demo profile + no device → response has `demo_2fa_required` and no `access_token`, and a code row exists; (b) demo profile + trusted device → `access_token` present; (c) expired demo → 403; (d) verify-code valid → token; invalid → 400; (e) **non-demo login unchanged** → token, no `demo_2fa_required`. Seed Mongo `hr_profiles` with `{_id:user_id, is_demo:true}` and stub MariaDB lookups as the existing auth tests do. Mock `send_email`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Apply the `auth.py` changes above.
- [ ] **Step 4:** Run → PASS. Also run the full `backend/tests` to confirm no auth regressions.
- [ ] **Step 5:** Commit `feat(backend): owner-gated demo 2FA in login + verify-code`.

### Task B3: SuperAdmin audit/devices/revoke endpoints

**Files:** Modify `backend/auth.py`; Test append to `backend/tests/test_demo_security.py`.

**Interfaces — Consumes:** B1 (`revoke_device`, collections), `require_roles` from `middleware.auth`. **Produces:** the 3 superadmin endpoints per contract.

```python
@router.get("/demo/audit", tags=["auth"])
async def demo_audit(user_id: str | None = None, limit: int = 100,
                     current_user: dict = Depends(require_roles(["superadmin"]))):
    mongo_db = connect_mongodb()["HumatiQ"]
    q = {"user_id": user_id} if user_id else {}
    rows = list(mongo_db.demo_login_audit.find(q, {"_id": 0}).sort("created_at", -1).limit(min(limit, 500)))
    for r in rows:
        if isinstance(r.get("created_at"), datetime): r["created_at"] = r["created_at"].isoformat()
    return rows

@router.get("/demo/devices", tags=["auth"])
async def demo_devices(current_user: dict = Depends(require_roles(["superadmin"]))):
    mongo_db = connect_mongodb()["HumatiQ"]
    devices = list(mongo_db.demo_trusted_devices.find({"revoked": {"$ne": True}}, {"_id": 0}))
    # annotate email from hr_profiles
    for d in devices:
        prof = mongo_db.hr_profiles.find_one({"_id": d["user_id"]}, {"email": 1})
        d["email"] = prof.get("email") if prof else None
        for k in ("created_at", "last_seen_at"):
            if isinstance(d.get(k), datetime): d[k] = d[k].isoformat()
    return devices

@router.post("/demo/revoke-device", tags=["auth"])
async def demo_revoke_device(payload: dict = Body(...),
                             current_user: dict = Depends(require_roles(["superadmin"]))):
    device_id = (payload.get("device_id") or "").strip()
    if not device_id:
        raise HTTPException(status_code=400, detail="device_id required")
    mongo_db = connect_mongodb()["HumatiQ"]
    dev = mongo_db.demo_trusted_devices.find_one({"device_id": device_id})
    revoke_device(mongo_db, device_id)
    if dev:
        audit(mongo_db, dev["user_id"], None, "device_revoked", device_id=device_id)
    return {"message": "revoked"}
```
Add `revoke_device`, `audit`, `datetime` to the demo-security/import lines as needed.

- [ ] **Step 1:** Tests: seed a trusted device + audit rows; assert `/demo/devices` returns it with `email`; `/demo/revoke-device` flips `revoked` and next `find_trusted_device` is None; non-superadmin token → 403.
- [ ] **Step 2:** Run → FAIL.  - [ ] **Step 3:** Implement.  - [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(backend): superadmin demo audit/devices/revoke endpoints`.

### Task B4: Profile fields + Mongo indexes

**Files:** Modify `backend/models/profile.py`, `backend/routers/profiles.py`, `backend/scripts/create_indexes.py`.

- [ ] **Step 1:** Add to `ProfileBase`: `is_demo: bool = False`, `demo_expires_at: Optional[datetime] = None`. Add to `ProfileCreate`: `is_demo: bool = False`, `demo_expires_at: Optional[datetime] = None`. Add to `ProfileUpdate`: `is_demo: Optional[bool] = None`, `demo_expires_at: Optional[datetime] = None`.
- [ ] **Step 2:** `profiles.py` create handler already does `profile_in.model_dump()` → the two fields flow through automatically; confirm no allowlist filtering drops them (it doesn't). For the update handler note: it filters `v is not None`, so `is_demo=false` persists (not None) but `demo_expires_at=null` cannot be cleared via PUT — acceptable v1; document it in a code comment.
- [ ] **Step 3:** `create_indexes.py`: add
```python
        db.demo_access_codes.create_index([("user_id", ASCENDING)])
        db.demo_access_codes.create_index([("expires_at", ASCENDING)])
        db.demo_trusted_devices.create_index([("user_id", ASCENDING)])
        db.demo_trusted_devices.create_index([("device_id", ASCENDING)])
        db.demo_login_audit.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
```
- [ ] **Step 4:** Sanity: `venv/Scripts/python -c "import models.profile"` imports clean; run `backend/tests` once more.
- [ ] **Step 5:** Commit `feat(backend): persist demo flags on profiles + indexes`.

---

# FRONTEND WORKSTREAM

### Task F1: Demo checkbox + expiry + badge in UsersList

**Files:** Modify `frontend/src/apps/SuperAdmin/users/UsersList.jsx` (+ `UsersList.css`).

- [ ] **Step 1:** Extend `formData` initial + all reset sites (`openAddModal`, close buttons, after submit) with `isDemo: false, demoExpiresAt: ''`. In `openEditModal`, seed from `user.is_demo`, `user.demo_expires_at` (slice to `YYYY-MM-DD`).
- [ ] **Step 2:** In the modal body, after the Rôle group, add:
```jsx
<div className="form-group form-group--demo">
  <label className="demo-checkbox">
    <input type="checkbox" checked={formData.isDemo}
      onChange={(e) => setFormData({ ...formData, isDemo: e.target.checked })} />
    <span className="material-symbols-outlined">visibility_lock</span>
    Compte démo (accès protégé par code propriétaire)
  </label>
  {formData.isDemo && (
    <div className="form-group">
      <label><span className="material-symbols-outlined">event</span> Expiration (optionnel)</label>
      <input type="date" value={formData.demoExpiresAt}
        onChange={(e) => setFormData({ ...formData, demoExpiresAt: e.target.value })} />
    </div>
  )}
</div>
```
- [ ] **Step 3:** In `handleAddUser`, add to the `/profiles` POST body: `is_demo: formData.isDemo, demo_expires_at: formData.demoExpiresAt || null`. In `handleUpdateUser`, add the same two fields to the PUT body.
- [ ] **Step 4:** In the users table role cell, render a badge when `user.is_demo`:
```jsx
{user.is_demo && <span className="role-badge role-demo" title="Compte démo">Démo</span>}
```
Add `.role-demo` styles to `UsersList.css` (reuse existing badge look; a distinct accent color).
- [ ] **Step 5:** Manual: `cd frontend && npm run build` succeeds. Commit `feat(frontend): demo account toggle + expiry + badge in SuperAdmin users`.

### Task F2: Login sends device_id + demo code screen

**Files:** Modify `frontend/src/apps/HR/login/Login.jsx`, `frontend/src/core/routesHr.jsx`; Create `frontend/src/apps/HR/demo/DemoVerify.jsx` (+ `.css`).

- [ ] **Step 1:** In `Login.jsx` `handleSubmit`, include the stored device id:
```js
const deviceId = localStorage.getItem('humatiq_device_id') || undefined
const data = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password, device_id: deviceId }) })
if (data.demo_2fa_required) {
  navigate('/hr/demo-verify', { state: { userId: data.user_id, deviceId: data.device_id } })
  return
}
```
(Keep the rest of the success path unchanged.)
- [ ] **Step 2:** Create `DemoVerify.jsx`: a 6-digit code screen (adapt the input UX from `SuperAdmin/security/SuperAdminMfa.jsx`). Read `userId`/`deviceId` from `location.state`; if missing, redirect to `/hr/login`. Copy: heading "Accès démo protégé", subtext "Ce compte est un compte démo. Contactez le propriétaire pour obtenir votre code d'accès." On submit:
```js
const data = await apiFetch('/auth/demo/verify-code', { method: 'POST',
  body: JSON.stringify({ user_id: userId, device_id: deviceId, code }) })
localStorage.setItem('humatiq_device_id', deviceId)
setAuth({ access_token: data.access_token, role: data.role, id: data.id, email: data.email })
if (data.role === 'superadmin') navigate('/superadmin/dashboard')
else navigate('/hr/dashboard')
```
Handle 400 with an inline error ("Code invalide ou expiré") and let the user retry. Import `apiFetch` from `../../../core/api` and `setAuth` from `../../../core/apiClient`.
- [ ] **Step 3:** Add route to `routesHr.jsx` (lazy import + object like the others):
```jsx
{ path: '/hr/demo-verify', element: <ThemeProvider><DemoVerify /></ThemeProvider> }
```
Match the file's existing wrapping (check whether HR routes wrap in a ThemeProvider; mirror the `/hr/login` entry exactly, minus ProtectedRoute — this screen is pre-auth).
- [ ] **Step 4:** `npm run build` succeeds. Manual smoke in dev if backend is up.
- [ ] **Step 5:** Commit `feat(frontend): demo device 2FA screen in HR login flow`.

### Task F3: SuperAdmin "Sécurité Démo" page

**Files:** Create `frontend/src/apps/SuperAdmin/security/DemoSecurity.jsx` (+ `.css`); Modify `frontend/src/core/routesSuperAdmin.jsx`, `frontend/src/apps/SuperAdmin/components/SuperAdminSidebar.jsx`.

- [ ] **Step 1:** Create `DemoSecurity.jsx` using the `UsersList.jsx` page shell (SuperAdminSidebar + `useTheme` + Toast + `SuperAdminLoading`). On mount, `Promise.all([apiFetch('/auth/demo/audit'), apiFetch('/auth/demo/devices')])`. Render two cards: **Appareils de confiance** (table: email, label, ip, created_at, last_seen_at, [Révoquer] button → `apiFetch('/auth/demo/revoke-device', {method:'POST', body: JSON.stringify({device_id})})` then refetch) and **Historique de connexion** (table: created_at, email, event, ip, user_agent). Empty states for both.
- [ ] **Step 2:** Add route in `routesSuperAdmin.jsx` (lazy import + ProtectedRoute `['superadmin']` + ThemeProvider), path `/superadmin/demo-security`.
- [ ] **Step 3:** Add sidebar item to `SuperAdminSidebar.jsx` navItems: `{ path: '/superadmin/demo-security', icon: 'security', label: 'Sécurité Démo' }`.
- [ ] **Step 4:** `npm run build` succeeds. Commit `feat(frontend): SuperAdmin demo security monitoring page`.

---

## Integration & Verification (lead session, after both workstreams)

- [ ] Backend: `cd backend && venv/Scripts/python -m pytest tests -v` → all pass.
- [ ] Frontend: `cd frontend && npm run build` → succeeds.
- [ ] End-to-end manual (owner): create a demo user in SuperAdmin → log in as them in a fresh browser → confirm `demo_2fa_required` screen, code arrives at `OWNER_2FA_EMAIL`, entering it grants access and stores `humatiq_device_id` → second login on same browser skips the gate → SuperAdmin "Sécurité Démo" lists the device + audit → Revoke → next login re-gated. Verify non-demo admin login is unchanged.
- [ ] Report results to the owner for manual acceptance. **Do not push** until the owner approves.

## Self-Review (done)

- Spec coverage: demo flag (F1/B4), owner-gated 2FA per device (B1/B2/F2), owner-only code + alerts (B1), single active device (B1 `trust_device_single`), audit+devices+revoke panel (B3/F3), demo expiry (B2/B4/F1), `OWNER_2FA_EMAIL` config (B1). All covered.
- Placeholder scan: none.
- Type consistency: helper names match between B1 definitions and B2/B3 usage; response shapes match the API Contract used by F2/F3.
