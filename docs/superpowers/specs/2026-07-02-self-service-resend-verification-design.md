# Self-service resend of account verification email

## Problem

The account-verification feature (see
[2026-07-01-account-verification-design.md](2026-07-01-account-verification-design.md))
gave admins a way to resend a stuck user's activation email from the
SuperAdmin and Team Management panels. It did not give the blocked user
themselves any recourse: today, a `pending` account that fails to log in
sees only "Votre compte est en attente d'activation. Contactez votre
administrateur." — the only way out is finding an admin who then has to
locate that user in a list and click "Renvoyer l'email de vérification"
on their behalf.

This adds a self-service path: the user gets a "Resend verification
email" action right on the login error, without needing an admin.

## Design

### `POST /api/auth/resend-verification` (new, public)

Distinct from the existing admin-only `POST /auth/admin/resend-verification`
(which takes a `user_id` and requires `admin`/`superadmin`). This one:

- Body: `{ "email": str }`. No authentication required — mirrors
  `forgot_password`'s shape exactly (`backend/auth.py`'s existing
  `forgot_password` endpoint).
- Looks up the user by email in MySQL. If found and `status == "pending"`,
  issues a fresh token via the existing `issue_verification_token` and
  sends the activation email via `background_tasks`.
- In every other case — email not found, or found but not `pending` — do
  nothing.
- **Always** returns `200` with the same generic message, regardless of
  which case occurred: `"Si ce compte est en attente d'activation, un
  nouveau lien a été envoyé."` No response difference is observable
  between "no such email," "already active," and "sent" — matching
  `forgot_password`'s existing email-enumeration protection, confirmed as
  the desired behavior.
- No rate-limiting, matching `forgot_password`'s current (unprotected)
  behavior. This is a pre-existing gap in the codebase, not something
  introduced or fixed here — out of scope for this change.

### `frontend/src/apps/HR/login/Login.jsx`

The pending-account error branch (currently just `setError('Votre compte
est en attente d'activation. Contactez votre administrateur.')`) gains a
"Renvoyer l'email de vérification" button rendered beneath that message.
Clicking it calls the new endpoint with the email already typed into the
login form (the user does not retype it), then replaces the button with
the same generic confirmation text the backend returns.

## Testing

- Backend: integration tests mirroring `test_auth_verification_endpoints.py`'s
  style — resend on a genuinely pending user issues a token and does not
  leak via the response; resend on a non-existent email, an active user,
  and an invited-but-not-yet-real user all return the identical 200
  message with no observable difference.
- Manual: trigger a blocked login on a pending account, click the new
  button, confirm a fresh email arrives and the link activates the
  account.
