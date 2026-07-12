# Design: Demo-account owner-gated 2FA + monitoring

**Date:** 2026-07-12
**Branch:** `dev_feature_demo_2fa` (off `dev`)
**Author:** yassineXYSN + Claude

## Problem

The app is being shown to prospects (paid demo). We hand out demo accounts, but
a demo user could pass their credentials to someone else and leak access. We want
demo accounts that only the owner can let in: after a correct password, a demo
account must clear a second factor whose code is **emailed to the owner only**.
The demo user must contact the owner to obtain the code. We also want to *see* and
*cut off* misuse.

## Goals

- SuperAdmin can flag an account as a **demo account** when creating it (and toggle
  it on an existing account).
- A demo account can only reach the app after clearing an owner-gated 2FA.
- The 2FA code is emailed to the **owner** (not the demo user), one-time, ~10 min TTL.
- **Device-trust model:** first login on a new browser/device is gated; that device
  is then trusted until revoked. (Chosen over "every login" to avoid the owner being
  a bottleneck on every session.)
- **Single active device:** a demo account may have only one trusted device at a time;
  a new device revokes the old one.
- **Owner login alerts:** every demo login emails the owner (account, time, IP, device).
- **Demo audit + sessions panel** in SuperAdmin: login history + trusted devices +
  revoke button.
- **Demo account expiry:** optional expiry date; after it, login is blocked.

## Non-goals

- Hardware-bound device attestation (not possible from a web app).
- Changing auth for non-demo accounts or candidates.
- Any MariaDB schema migration (schema is provisioned out-of-band; see Storage).

## Storage decision

Login reads role/status from **MariaDB `profiles`**, but the SuperAdmin UI and the
existing candidate 2FA state live in **Mongo** (`hr_profiles`, `candidates`). There is
no SQL migration system in the repo. Therefore **all demo state lives in Mongo**, keyed
by `user_id` (which equals `hr_profiles._id`). Login already calls
`connect_mongodb()`, so this adds one lookup and no migration.

## Data model (Mongo DB `HumatiQ`)

### `hr_profiles` (existing) — new fields
- `is_demo: bool` (default absent/false)
- `demo_expires_at: datetime | null`

### `demo_trusted_devices` (new collection)
```
{
  _id: uuid,
  user_id: str,
  device_id: str,        # long random secret (secrets.token_urlsafe), stored in browser localStorage
  label: str,            # human label derived from User-Agent (e.g. "Chrome on Windows")
  ip: str,
  created_at: datetime,
  last_seen_at: datetime,
  revoked: bool
}
```
**Invariant:** at most one non-revoked device per `user_id` (single active device).

### `demo_access_codes` (new collection)
```
{
  _id: uuid,
  user_id: str,
  device_id: str,        # the device this code will trust on success
  code: str,             # 6 digits
  ip: str,
  user_agent: str,
  created_at: datetime,
  expires_at: datetime,  # ~10 min
  consumed: bool
}
```
One-time use. Superseded codes for the same user are invalidated when a new one issues.

### `demo_login_audit` (new collection)
```
{
  _id: uuid,
  user_id: str,
  email: str,
  event: str,            # see events below
  ip: str,
  user_agent: str,
  device_id: str | null,
  created_at: datetime
}
```
Events: `gate_challenged`, `code_verified`, `code_failed`, `device_trusted`,
`device_revoked`, `login_success`, `expired_block`.

## Config

- `OWNER_2FA_EMAIL` env var. Default: `yassinechtourou03@gmail.com`. All demo codes and
  demo login alerts are sent here.

## Backend

### Module layout
- New `backend/utils/demo_security.py` (or `backend/services/demo_security.py`):
  helpers for reading demo flag, minting/validating codes, device trust CRUD,
  audit writes, UA→label parsing, owner-email composition. Keeps `auth.py` thin.
- Mongo indexes added in `backend/scripts/create_indexes.py`: `demo_access_codes`
  (user_id, expires_at), `demo_trusted_devices` (user_id, device_id),
  `demo_login_audit` (user_id, created_at desc).

### `POST /auth/login` (modified)
Request may include `device_id` (from localStorage). After existing password +
status checks, for `is_demo` profiles only:
1. `demo_expires_at` past → `403 {detail:"Demo period ended"}`, audit `expired_block`.
2. `device_id` matches a **non-revoked** trusted device for this user → issue JWT
   (existing shape), update `last_seen_at`/`ip`, email owner login alert,
   audit `login_success`.
3. Otherwise → mint new `device_id`, create 6-digit code (invalidate prior unconsumed
   codes for this user), email the **owner** the code, audit `gate_challenged`, and
   return `{ demo_2fa_required: true, method: "owner_email", user_id, device_id }`.
   **No token issued.**

Non-demo / candidate paths are unchanged.

### `POST /auth/demo/verify-code` (new, rate-limited)
Body `{ user_id, device_id, code }`.
- Validate: code exists for (user_id, device_id), not consumed, not expired, matches.
  Fail → `400 {detail:"Invalid or expired code"}`, audit `code_failed`.
- On success:
  1. Revoke all other non-revoked devices for `user_id` (audit `device_revoked` each).
  2. Upsert this `device_id` as trusted (audit `device_trusted`).
  3. Mark code consumed.
  4. Email owner login alert.
  5. Issue JWT (same shape as `/auth/login` success), audit `code_verified` +
     `login_success`.
- Returns `{ access_token, token_type, role, id, email }`.

### `GET /auth/demo/audit` (superadmin only)
Query: optional `user_id`, `limit`. Returns recent `demo_login_audit` rows (newest first).

### `GET /auth/demo/devices` (superadmin only)
Returns trusted (non-revoked) devices grouped/annotated per demo user.

### `POST /auth/demo/revoke-device` (superadmin only)
Body `{ device_id }`. Sets `revoked: true`, audit `device_revoked`. Next login on that
device re-triggers the gate.

### Profiles router (`/profiles` POST + PUT)
Extend `ProfileCreate`/`ProfileUpdate` and handlers to accept and persist `is_demo`
and `demo_expires_at` on the `hr_profiles` doc. No other role/status behavior changes.

## Frontend

### SuperAdmin `UsersList.jsx` (create/edit modal)
- Add a **"Compte démo"** checkbox. When checked, reveal an optional **expiry date**
  input. Include `is_demo` + `demo_expires_at` in the `/profiles` POST (create) and
  PUT (edit).
- Add a **"Démo"** badge in the users table for `is_demo` rows.

### HR `Login.jsx`
- Send `device_id` from `localStorage` (key `humatiq_device_id`) in the login body.
- On `demo_2fa_required` response, navigate to the new demo-code screen with
  `user_id` + `device_id` in route state.

### New demo-code screen (adapt existing OTP UI)
- 6-digit input. Copy: *"This is a demo account. Contact the owner to receive your
  access code."*
- Calls `POST /auth/demo/verify-code`. On success: store `device_id` in `localStorage`,
  `setAuth(...)`, route by role (superadmin/admin/hr as in current Login).
- Invalid/expired → inline error; allow retry (a new attempt can re-issue via a
  "request a new code" action that re-hits login, optional v1).

### New SuperAdmin "Sécurité Démo" page
- Sidebar entry. Two sections:
  - **Login history**: table from `GET /auth/demo/audit` (time, email, event, IP, device).
  - **Trusted devices**: list from `GET /auth/demo/devices` with a **Revoke** button
    → `POST /auth/demo/revoke-device`.
- This gives the dead-stub `SuperAdminMfa.jsx` a real purpose (repurpose or replace).

## Testing

Backend `pytest` under `backend/tests/` (follow existing auth test patterns; mock the
owner email send):
- Demo new device → `demo_2fa_required`, no token, code row created, owner emailed.
- Trusted device → token issued directly, login alert sent.
- Expired demo → `403 "Demo period ended"`.
- `verify-code`: valid → token + device trusted + code consumed; invalid/expired/
  already-consumed → 400.
- Single active device: verifying a second device revokes the first.
- Superadmin `revoke-device` → device revoked, next login re-gated.
- Non-demo account login → unchanged (regression guard).

Then **manual test on the branch** by the owner before any push.

## Rollout / branch

- Branch `dev_feature_demo_2fa` off `dev`. All work committed there.
- **Nothing pushed until the owner approves after manual testing.**

## Agentic execution plan

Implementation orchestrated by the lead session across parallel **Sonnet-5** agents
against the API contract above:
- **Backend agent:** `demo_security` module, login change, new endpoints, profiles
  fields, indexes.
- **Frontend agent:** SuperAdmin modal + badge, "Sécurité Démo" page, Login change +
  demo-code screen.
- **Tests agent:** backend pytest suite.
Lead integrates, resolves contract mismatches, and runs verification.

## Known limitation

`device_id` is a bearer trust token: copying a browser's entire localStorage to another
machine inherits trust. Mitigations are single-active-device + owner login-alert emails
(the owner sees a new IP and can revoke). Hardware-bound trust is out of scope for a web
app. This matches the "notice and cut off leaks" goal.
