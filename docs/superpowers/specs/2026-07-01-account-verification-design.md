# Account email verification for admin-created HR/admin accounts

## Problem

A SuperAdmin creates a user via **Utilisateurs → Nouvel Utilisateur**. The
frontend hardcodes `status: 'pending'` on both the MariaDB and MongoDB
records it creates
([UsersList.jsx:139](../../../frontend/src/apps/SuperAdmin/users/UsersList.jsx#L139),
[:154](../../../frontend/src/apps/SuperAdmin/users/UsersList.jsx#L154)).
`POST /auth/admin/create-user`
([auth.py:120-163](../../../backend/auth.py#L120-L163)) never sends any
email, so there is nothing to verify — the user is simply blocked at login
with `403 Account pending activation`
([auth.py:40-41](../../../backend/auth.py#L40-L41)) forever.

Worse, even manual recovery doesn't work: the only edit path in the
SuperAdmin UI (`PUT /profiles/{id}`) writes to MongoDB's `hr_profiles`
collection only, while `/login` reads `status` from **MySQL** `profiles`
([auth.py:29-30](../../../backend/auth.py#L29-L30)). The two are
disconnected, so there is currently no way — UI or otherwise — to move an
account out of `pending`.

The "new login detected" email the user did receive is unrelated: it only
fires after a *successful* login
([auth.py:43-50](../../../backend/auth.py#L43-L50)), which never happens for
a pending account. It confirms SMTP works; it's not evidence of a delivery
failure.

`backend/routers/team.py`'s "Inviter un membre" flow has the same shape:
when an admin supplies a temporary password, the new HR account is marked
`active` immediately (no verification at all) — inconsistent with the
"pending until verified" story SuperAdmin-created users are implicitly
promised.

## Scope

- **In scope**: SuperAdmin panel user creation (`/auth/admin/create-user` +
  `POST /profiles`), and the password-based branch of `POST /team/invite`.
- **Out of scope**: `POST /team/invite`'s passwordless branch (creates a
  Mongo-only `status: "invited"` placeholder and tells the invitee to use
  "Google login" or "passwordless login"). No such login mechanism exists
  anywhere in the codebase today — building it is a separate, larger
  project unrelated to this bug.

## Data model

New table, mirroring the existing `password_resets` table
([docs/schema.sql:22-32](../../../docs/schema.sql#L22-L32)):

```sql
CREATE TABLE IF NOT EXISTS account_verifications (
    id         CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
    email      VARCHAR(255) NOT NULL,
    token      CHAR(64)     NOT NULL UNIQUE,
    expires_at DATETIME     NOT NULL,
    used       TINYINT(1)   NOT NULL DEFAULT 0,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_av_token (token),
    INDEX idx_av_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

- Token: `secrets.token_hex(32)`, same as `forgot_password`.
- Expiry: **7 days** from issuance.
- Issuing a new token for an email invalidates (`used = 1`) previously
  unused tokens for that email — same pattern `forgot_password` already
  uses for `password_resets`.

## Fixing the status split-brain

Add one helper in `backend/auth.py`:

```python
def set_account_status(user_id: str, email: str, status: str) -> None:
    """Updates profiles.status in MySQL and the matching Mongo profile
    (hr_profiles or superadmins) so both stores stay consistent."""
```

It updates MySQL `profiles.status` for `user_id`, then updates whichever
Mongo collection (`hr_profiles` or `superadmins`) has a matching `_id`.

Every code path that changes account status — verification confirm, resend,
force-activate, and the existing generic `PUT /profiles/{id}` when its
payload includes `status` — routes through this helper instead of touching
one store and leaving the other stale.

## Backend changes

### `POST /auth/admin/create-user` (`backend/auth.py`)
Add a `background_tasks: BackgroundTasks` parameter. If the created
profile's `status == "pending"`, generate an `account_verifications` token
and send the activation email in the background. No change to what status
value the endpoint accepts/stores.

### `POST /team/invite` (`backend/routers/team.py`), password branch
Change the MariaDB profile insert and the Mongo profile's `status` field
from `"active"` to `"pending"` when `temp_password` is supplied. Fold the
activation link into the existing credentials email (one email, not two):
credentials block unchanged, plus a sentence that the account won't work
until the link is clicked, plus the link.

### `POST /auth/verify-account` (new, public)
Body: `{ "token": str }`. Looks up `account_verifications` by token, with
the same three distinct error cases `reset_password` already uses: unknown
token → `400 "Invalid or expired verification link"`; already used → `400
"Verification link already used"`; expired → `400 "Verification link has
expired"`. On success: mark token used, resolve `email → users.id`, call
`set_account_status(user_id, email, "active")`.

### `POST /auth/admin/resend-verification` (new)
`require_roles(["admin", "superadmin"])`. Body: `{ "user_id": str }`.
`400` if the target user's status isn't `"pending"`. Otherwise invalidate
old unused tokens for that email, issue a new one, resend the activation
email.

### `POST /auth/admin/force-activate` (new)
`require_roles(["admin", "superadmin"])`. Body: `{ "user_id": str }`.
Calls `set_account_status(user_id, email, "active")` directly (no token).
Marks any outstanding unused verification tokens for that email as used.

### `/auth/login`
No change — already blocks `status == "pending"` with
`403 Account pending activation`. The fix is about providing a way *out* of
pending, not changing the gate.

## Frontend changes

### `frontend/src/apps/HR/verify-email/VerifyEmail.jsx`
Repurpose from a static "check your inbox" message into a token-consuming
page, following the pattern already established by
`ResetPassword.jsx`: read `token` from `useSearchParams`, call
`POST /auth/verify-account` on mount, render loading / success (redirect to
`/hr/login` after a few seconds) / invalid-or-expired states. No `token` in
the URL renders the same "invalid link" state `ResetPassword.jsx` uses.
This also fixes the translation-key collision found during diagnosis, where
`hr-auth-verify-title` was shared with the unrelated OTP 2FA flow and
displayed "Vérifiez votre boîte mail" regardless of context — the page will
now have real, distinct states instead of one static string.

### `frontend/src/apps/SuperAdmin/users/UsersList.jsx`
Row-actions dropdown gets two new items, shown only when
`user.status === 'pending'`:
- "Renvoyer l'email de vérification" → `POST /auth/admin/resend-verification`
- "Activer manuellement" → `POST /auth/admin/force-activate`

Both refresh the list and toast on success/failure, matching the existing
`handleDeleteUser` pattern.

### `frontend/src/apps/HR/settings/team/TeamManagement.jsx`
The status pill currently only special-cases `invited` and defaults
everything else to "Actif" — add a real `pending` label/style. Add the same
two row actions as above (resend / force-activate), since the password
branch of `/team/invite` will now produce `pending` accounts instead of
immediately-active ones.

### `frontend/src/apps/HR/login/Login.jsx`
No change. The existing "Votre compte est en attente d'activation.
Contactez votre administrateur." message is accurate now that an admin has
a real way to act on it.

## Email content

**SuperAdmin-created account** (new):
```
Subject: Activez votre compte HumatiQ

Bonjour {first_name},

Un compte administrateur a été créé pour vous sur HumatiQ.

Cliquez sur ce lien pour activer votre compte (valable 7 jours) :

{link}

Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.

L'équipe HumatiQ
```

**Team invite, password branch** (extends the existing template in
`team.py`): keep the current credentials block, append the activation link
and a line stating the account won't work until it's clicked.

`{link}` = `{FRONTEND_URL}/hr/verify-email?token={token}`, using the same
`os.getenv("FRONTEND_URL", "http://localhost:5173")` pattern `team.py`
already uses for `login_url`.

## Edge cases

- Missing `token` query param on the verify page → same "invalid link"
  state as `ResetPassword.jsx`.
- Expired / used / unknown token → distinct `400` messages per case, as
  described above.
- Resend or force-activate called on a non-`pending` user → `400`, nothing
  to act on.
- SMTP not configured (dev) → `send_email` already no-ops with a console
  warning; unchanged, same as password reset today.
- The admin account already stuck in `pending` from before this change:
  once shipped, use "Activer manuellement" (or "Resend") on it from the
  SuperAdmin panel — no manual DB edit needed.

## Testing

- Backend: unit tests for `set_account_status` (both stores updated),
  `verify-account` (valid/expired/used/missing token), `resend-verification`
  and `force-activate` (role gating, non-pending rejection).
- Manual: create a SuperAdmin user → confirm login is blocked → click the
  emailed link → confirm login succeeds. Repeat via "Activer manuellement"
  and "Renvoyer l'email" instead of the emailed link. Repeat the same
  create → block → activate cycle through the HR team-invite flow.
