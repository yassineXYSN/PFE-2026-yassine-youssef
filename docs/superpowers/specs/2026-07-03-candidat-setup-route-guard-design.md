# Candidat account-setup route guard

## Problem
`ProtectedRoute` (`frontend/src/core/auth/ProtectedRoute.jsx`) only checks auth token + role.
It never checks whether the candidate finished account setup. Login already redirects
correctly based on `/candidat/account-setup/status`, but a candidate who types
`/candidat/dashboard` (or any other candidat URL) directly into the address bar bypasses
that check and lands on pages meant to be gated.

## Fix
Add an optional `requireSetup` boolean prop to `ProtectedRoute`. When true, after the
existing token/role checks pass, it calls `GET /candidat/account-setup/status`
(already implemented in `backend/routes/candidat/account_setup.py`). If
`is_setup_completed` is `false`, redirect to `/candidat/account-setup` instead of
rendering `children`. On fetch failure, treat as not-completed (redirect) — same
fail-closed posture as the existing auth check.

## Scope
Apply `requireSetup` to every gated candidat route in `frontend/src/core/routesCandidat.jsx`
except `/candidat/account-setup` itself:
- `/candidat/dashboard` (and its children render through the same guard)
- `/candidat/quiz/:quizId`
- `/candidat/interviews/select/:applicationId`
- `/candidat/interviews/room/:interviewId`

Not in scope: login/terms/2fa/forgot-password/reset-password/test-parse-cv routes
(unauthenticated or setup-flow-adjacent, unaffected).

## Testing
Manual check: create an account, verify email, skip account setup, navigate directly to
`/candidat/dashboard` — expect redirect to `/candidat/account-setup`.
