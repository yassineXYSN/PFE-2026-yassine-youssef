> ───────────────────────────────────────────────────────────────────────────
> STATUS UPDATE — 2026-07-04 — code-only fixes implemented on branch `dev_feature_4`
> (branched from `dev_feature_3`). Each finding below now carries a status line.
> ✅ DONE = fixed in code on dev_feature_4 (task + commit noted).
> ⏸️ PENDING = deliberately NOT fixed in this pass (infra / TLS / env-secrets /
>    operational items, per request — handle separately).
> Nothing below was deleted; only the status lines were added.
> ───────────────────────────────────────────────────────────────────────────

🔴 Critical — will block or endanger a production deploy
1. Live secrets are sitting in backend/.env and several are real/active.
⏸️ PENDING — excluded (env/secrets management). Rotate & inject via vault/platform env; not a code change.
backend/.env contains a real Gmail app password (SMTP_PASSWORD=uqcq ibro xanw lhor), a Google OAuth client secret (GOCSPX-...), two HuggingFace tokens (hf_...), a Cohere API key, and the JWT SECRET_KEY. The file is correctly gitignored (not in git history), but:

These are the credentials your app will run with. If this repo/machine leaks, every one of these is compromised.
All of these should be rotated before go-live and injected as real secrets (vault / platform env), not a checked-out file. Treat them as already-exposed since they've lived on disk in plaintext.
2. Hardcoded localhost URLs will break the interview flow and emails in production.
✅ DONE — Task 6, commit 460b9e1. interviews.py & schedulers.py now read FRONTEND_URL; profile image URL is now a relative /static path.
Several places ignore env config and hardcode dev URLs:

interviews.py:182 — interview invitation link → http://localhost:5173/candidat/interviews/room/...
schedulers.py:79 — reminder email link → same localhost
candidat/profile.py:302 — uploaded profile image URL → http://localhost:8000/static/uploads/... stored in DB
In production, candidates will receive interview/reminder emails pointing at localhost (dead links), and profile image URLs saved to Mongo will be permanently wrong. These need to read FRONTEND_URL / VITE_API_URL like the rest of the code does.

3. The interview WebRTC relies on a free public TURN server.
⏸️ PENDING — excluded (infrastructure). Needs a real TURN server (coturn / paid) configured via env; not a code change.
useWebRTC.js:17-23 falls back to openrelay.metered.ca with the public openrelayproject credentials when VITE_TURN_URL isn't set. That relay is rate-limited/best-effort and not for production — interviews between users behind symmetric NAT/corporate firewalls will silently fail to connect. You need a real TURN server (coturn or a paid provider) configured via the build args before the interview feature is reliable.

4. Interview signaling WebSocket has no authentication.
✅ DONE — Task 2, commit b644dd2. All 3 WebSockets now require a valid JWT (?token=); signaling socket also verifies the caller is a participant of that interview. Frontend hooks updated to send the token.
interviews.py:876 — /interviews/ws/{room_id}/{client_id} accepts any connection with no token check. Anyone who knows (or guesses/enumerates) a room_id can join the signaling channel, relay SDP, and eavesdrop on / disrupt an interview. The AI analysis sockets (interviews.py:913, :955) are also fully unauthenticated. Room IDs are Mongo ObjectIds (not secret). WebSockets bypass the CORS config, so this is internet-reachable.

🟠 High — security gaps to close
5. Unauthenticated test/demo routes are mounted in the app.
✅ DONE — Task 3, commit 716a2e2. /test/quiz and /api/test-pipeline/* are no longer mounted when ENVIRONMENT=production, plus an in-route 404 guard.

quiz.py:1193 — GET /test/quiz explicitly says "No authentication required… Remove or protect before production" and triggers real LLM/embedding work (cost + DoS vector).
test_pipeline.py — /api/test-pipeline/run and /cleanup create and delete fake candidates/applications in the real DB. These are auth'd but write junk into production data and shouldn't ship.
6. No rate limiting anywhere.
✅ DONE — Task 5, commit 5a3c2bc. slowapi limiter added; login/register/forgot-password/verify-account-code/resend-verification-code capped (e.g. login 10/min). (Verified the 429 fires; the plan's DB-backed test can only fully pass against a live DB.)
No slowapi/limiter is present. /api/auth/login, /register, /forgot-password, /verify-account-code, and the 2FA endpoints are all brute-forceable. The email verification code path (auth.py:353) is especially exposed — a numeric code with no attempt throttling is guessable.

7. Broken object-level authorization (IDOR) on candidate data.
✅ DONE (partial) — Task 1, commit 8522d31. All 6 /api/candidates/* endpoints now require HR-side roles via require_roles, so a candidat can no longer read others' PII. NOTE: full cross-company tenant isolation (company A's HR not seeing company B's candidates) is a bigger data-model change and remains a follow-up.
candidates.py:435 — GET /api/candidates/{candidate_id} requires only get_current_user (any logged-in user, including a candidat), with no company/tenant check. Any authenticated user can enumerate ObjectIds and pull any candidate's full profile, email, phone, applications, and CV. The list endpoint scopes by company_id, but the detail/CV/document endpoints (:605, :648) don't appear to. This is worth auditing across all /{id} routes.

8. 2FA is not enforced at login.
✅ DONE — Task 10, commit 9f57d10. login now returns a 2FA challenge (no token) when totp_enabled; new /api/candidat/2fa/login-verify verifies the TOTP and issues the JWT. Candidate login page updated with the code-entry step.
The login flow (auth.py:26) issues a full JWT on password success and never consults totp_enabled / email-2FA. The 2FA setup endpoints (twofa.py) exist and users can "enable" it, but it's decorative — login ignores it entirely. Users who believe they're protected are not.

9. File uploads have no type/size validation.
✅ DONE — Task 4, commit 92c3ea5. New utils/uploads.validate_upload enforces an extension allow-list + size cap (images 5MB, docs 15MB) across the profile-image, document, and account-setup upload paths.
profile.py:270, :315, and account_setup.py:65 take the client-supplied extension, write bytes straight to static/uploads/, and serve them back via the static mount. No content-type allowlist, no size cap, no extension validation. Combined with the static mount this is an upload-and-serve surface (stored XSS via SVG/HTML, disk-fill DoS). Files are stored on a container volume, so they also vanish if the volume isn't persisted.

🟡 Medium — operational / correctness risks
10. MONGODB_ATLAS_TLS_INSECURE=1 in the Docker backend env.
⏸️ PENDING — excluded (TLS/config). Ensure prod compose/env never sets this against a real Atlas cluster; not a code change.
docker-compose.yml sets this, and mongodb.py:42 honors it to disable TLS cert validation. Fine for the local Atlas container, but if the same compose file is reused pointing at a real mongodb+srv:// Atlas cluster, you'd be running with cert validation off (MITM risk). Make sure prod never inherits this flag.

11. verify_totp uses default TOTP window with no replay protection.
✅ DONE (partial) — Task 9, commit 034accb. The TOTP code is now read from the request body instead of a query param (no more leakage into logs/proxies). NOTE: within-window replay hardening was not added; low priority.
twofa.py:41 — code: str is a query parameter (ends up in logs/proxies), and totp.verify(code) allows reuse of a code within its window. Minor, but worth noting since #8 makes 2FA moot anyway.

12. CORS uses allow_headers=["*"] + allow_methods=["*"] + allow_credentials=True.
✅ DONE — Task 8, commit 32b4454. CORS now uses an explicit method list and explicit headers (Authorization, Content-Type) instead of wildcards.
main.py:133. Origins are correctly env-restricted (good), but the wildcard headers/methods with credentials is broad. Lower priority since origin is pinned.

13. Heavy startup / eager model loads make the container slow and fragile to boot.
⏸️ PENDING — excluded (infra/ops). Sizing + lazy-load/healthcheck tuning; not a code-security fix in this pass.
main.py:90 eagerly loads faster-whisper at startup, plus the CNN/emotion/mediapipe stack. The Docker healthcheck has a 60s start_period — if model load exceeds that or OOMs (these are multi-GB on CPU), the container flaps. Confirm the prod host has the RAM/CPU headroom, and that model weights are baked in or cached (the HF cache is a named volume, so a cold deploy re-downloads).

14. Interview scheduler runs every 60s inside the web process.
⏸️ PENDING — excluded (architecture/ops). Single-instance assumption; needs a leader-lock or external scheduler for multi-replica. Not a code fix in this pass.
Three asyncio schedulers (main.py:43-51) run in-process. If you scale the backend to more than one replica, each replica runs them independently → duplicate reminder emails, duplicate no-show marking, duplicate weekly reports. This design assumes a single backend instance.

15. /api/auth/logout is a no-op and tokens can't be revoked.
⏸️ PENDING — deferred (needs a persistent revocation store + per-request check; more than a code tweak). Interim mitigation is config-only (shorter ACCESS_TOKEN_EXPIRE_MINUTES).
auth.py:426 just returns a message; the JWT stays valid for its full 24h lifetime (client just drops it from localStorage). No server-side revocation exists, so a stolen token can't be killed. Tokens live in localStorage (apiClient.js:11), which is XSS-readable — see #9.

16. Weak password policy.
✅ DONE — Task 7, commit d637e59. Minimum length raised to 8 via _validate_password; the hardcoded TempPassword123! default in admin_create_user was replaced with a random secrets.token_urlsafe(12). (Complexity/breach-check not added.)
Minimum 6 characters (auth.py:491, :527), no complexity/breach check. admin_create_user also has a hardcoded default TempPassword123! (auth.py:152) used when no password is supplied.

🟢 Low / hygiene
~143 print() statements across routers/services, several logging DEBUG detail including OAuth client-id prefixes and user emails (external_auth.py:152-154). No structured logging; these go to stdout in prod. Switch to the logging module and drop the debug prints.
⏸️ PENDING — hygiene, not addressed in this pass (large mechanical change to structured logging).
GET / returns {"Hello": "World"} (main.py:175) — leftover, and /docs (Swagger) is open with no auth, exposing your full API surface. Consider disabling docs or gating them in prod.
✅ DONE — Task 8, commit 32b4454. GET / stub replaced with a minimal /health; /docs, /redoc, /openapi.json disabled when ENVIRONMENT=production. (Supporting change: Task 0, commit eb31c58 added the ENVIRONMENT/IS_PRODUCTION flag used by this and the test-route gating.)
FAKE_ANALYSIS=0, QUIZ_METHOD=0, mock AI providers exist (aiproxy/providers/mock.py) — make sure prod env vars don't accidentally select mock/fake modes.
AI features depend on external services (HuggingFace inference, Cohere, Ollama). If HF/Cohere rate-limit or the key is invalid, quiz generation, CV parsing, and candidate matching degrade. Ollama defaults to host.docker.internal:11434 — that host must actually run Ollama in prod or embedding/LLM-local paths fail. There's a startup status check but no runtime fallback.
ACCESS_TOKEN_EXPIRE_MINUTES defaults to 24h — long-lived given no revocation (#15).
⏸️ PENDING — config-only (tune the env value); tied to #15.

> ───────────────────────────────────────────────────────────────────────────
> SUMMARY — dev_feature_4 (11 commits, eb31c58..9f57d10)
> ✅ FIXED IN CODE: #2, #4, #5, #6, #7, #8, #9, #11, #12, #16, and the GET//docs
>    hygiene item (+ supporting ENVIRONMENT flag). 10 unit/authz test files added,
>    21 tests passing (rate-limit mechanism verified; its DB-backed test needs a
>    live DB).
> ⏸️ NOT FIXED (excluded/deferred by request): #1 (secrets), #3 (TURN), #10 (Mongo
>    TLS), #13 (startup/ops), #14 (scheduler/ops), #15 (token revocation), print()
>    logging cleanup, token-expiry tuning.
> Full plan: docs/superpowers/plans/2026-07-04-security-code-fixes.md
> ───────────────────────────────────────────────────────────────────────────

todo : almost all done should make the interview api based next
