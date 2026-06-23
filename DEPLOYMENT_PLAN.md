# Deployment Plan — NextHire AI (`sprint1-partie-hr2`)

## Target architecture

Self-hosted on the VPS, behind the existing Traefik proxy. **No external SaaS.**

```
Internet → Traefik v2.11 (TLS / Let's Encrypt)
   ├── nexthire.itc4d.com      → frontend (Nginx + React SPA)
   └── api-nexthire.itc4d.com  → backend (FastAPI)
                                    ├── MariaDB    (identity + auth)   ← replaces Supabase
                                    ├── MongoDB    (all business data) ← local, replaces Atlas
                                    └── Ollama     (AI embeddings/LLM)
```

Decisions taken (per your instructions):
- **MariaDB replaces Supabase** as the identity store and auth backend (reusing the senior's JWT approach).
- **MongoDB stays** — it holds almost all the app data (61 backend files use it) — but moves from Atlas to a **local container**.
- **Supabase is removed completely**: client-side auth, social OAuth, the provider-linking ("double") logic, and backend token verification.

> Scope reality check: this is **not** mainly a deployment task. ~70% of the work is the Supabase → MariaDB auth migration. Mongo-heavy code barely changes (only the connection string). Plan for this as its own phase before any production deploy.

---

## Phase 0 — Pre-flight decisions

1. **Where do user profiles live?** Recommended: MariaDB owns **only identity** (`users`: id, email, password_hash; `profiles`: id, role, status, names). Keep all rich profile/business data in Mongo, keyed by the MariaDB user UUID. This minimizes the rewrite. The senior put more into MariaDB — don't follow that fully or you'll rewrite every Mongo router.
2. **Social login (Google / LinkedIn / GitHub)** currently works through Supabase OAuth. Removing Supabase **removes social login** unless you reimplement OAuth yourself (Authlib). Decision needed: drop it (email+password only) or rebuild it. Recommended for the PFE timeline: **drop social login**, keep email+password.
3. **2FA (TOTP + email OTP)** for candidates: check whether the OTP/TOTP secrets live in Mongo (app-managed) or Supabase. If app-managed, it can stay against MariaDB/Mongo. If Supabase-managed, it must be reimplemented or dropped.
4. **Ollama on the VPS** — backend needs `OLLAMA_BASE_URL` reachable. No desktop Ollama exists on a server. Run Ollama as a container on the `traefik` network (and `ollama pull` the models), or point at a remote GPU box.
5. **Mongo data migration** — existing data in Atlas must be moved to the local container with `mongodump` (Atlas) → `mongorestore` (local), or start fresh if this is a clean PFE deploy.
6. **VPS resources** — torch + Whisper + OpenCV images and HF model downloads need several GB of disk/RAM. Confirm capacity; persist models in the `backend_models` volume you already defined.

---

## Phase 1 — Backend: remove Supabase, add MariaDB + JWT auth

### Files to DELETE
- `backend/database/supabase.py`

### Files to REWRITE (template = senior's `nexthire-prod-v0.0.1` branch)
| File | Change |
|------|--------|
| `backend/dependencies.py` *(new)* | Copy the senior's: `create_access_token()` + `get_current_user()` decoding **your own** HS256 JWT with `SECRET_KEY`. No external call. |
| `backend/database/mysql.py` *(new)* | Copy the senior's PyMySQL `get_db()` / `connect_mysql()` / `row()` helpers. |
| `backend/middleware/auth.py` | Replace `get_current_user` — stop calling `supabase.auth.get_user(token)`; decode the local JWT instead. Keep the Mongo enrichment (company_id/department_id lookup), but key it on the JWT `sub` (MariaDB user id) instead of the Supabase user id. Keep `require_roles()`. |
| `backend/auth.py` | Delete `verify-provider` and Supabase `notify-login` logic. Replace with `login` / `register` / `me` / `logout` (bcrypt against MariaDB `users`+`profiles`) — senior's version is a drop-in starting point. Keep your `send_email` login-notification as a background task. |
| `backend/main.py` | Remove `connect_supabase` import + lifespan call; add `connect_mysql()`. **Remove the duplicate auth registration** (`/auth` *and* `/api/auth` — pick one, recommend `/api/auth`). Tighten CORS from `allow_origin_regex=".*"` to the real frontend origin via env. |

### Other backend files referencing Supabase (audit + fix individually)
`routers/team.py`, `routers/profiles.py`, `routes/candidat/{settings,account_setup,helpers,twofa}.py`,
`scripts/create_superadmin.py`, `models/{superadmin,profile}.py`, `utils/email.py`, `tests/*`.
For each, identify what Supabase did:
- **User creation / invitations** (admin creating recruiters) → insert into MariaDB `users`+`profiles` instead of `supabase.auth.admin.create_user`.
- **File/avatar storage** (Supabase Storage) → write to the local `/static` mount (you already have `utils/files.py` and the static mount in `main.py`).
- **Reading user email/metadata** → read from MariaDB.

### Dependencies (`backend/requirements.txt`)
- Remove: `supabase`.
- Add: `pymysql`, `passlib[bcrypt]`. (`python-jose` is already used by `middleware/auth.py`.)

### Schema (`docs/schema.sql`)
Adapt the senior's MariaDB schema, but trim to what you actually keep in SQL (at minimum `users` + `profiles` with the role/status ENUMs). Everything else stays in Mongo. Mount it into the DB container's `docker-entrypoint-initdb.d`.

---

## Phase 2 — Frontend: remove Supabase client

### Files to DELETE
- `frontend/src/core/supabaseClient.js`

### Files to REWRITE
| File | Change |
|------|--------|
| `frontend/src/core/apiClient.js` *(adopt senior's)* | Axios/fetch wrapper that stores the JWT (in memory + `localStorage`) and attaches `Authorization: Bearer <token>` to every request. |
| `frontend/src/core/auth/ProtectedRoute.jsx` | Replace `supabase.auth.getSession()` with: read stored token → call `/api/auth/me` → gate on the returned role. Keep the loading skeletons and the candidate-2FA redirect (if 2FA is retained). |
| `frontend/src/core/auth/logout.js` | Clear the stored token instead of `supabase.auth.signOut()`. |
| `frontend/src/core/api.js` | `getUserRole()` / `checkTwoFAStatus()` → use the stored JWT / `/api/auth/me` instead of a Supabase session. |
| Login/signup pages: `HR/login/Login.jsx`, `Candidat/Login/{LoginPage,ForgotPassword,ResetPassword}.jsx`, 2FA pages (`HR/otp/TwoFactor.jsx`, `Candidat/Login/TwoFA*.jsx`, `Candidat/2fapage/EmailVerification.jsx`), `HR/verify-email/VerifyEmail.jsx`, `Candidat/AccountSetup/AccountSetup.jsx` | Replace `supabase.auth.signInWithPassword/signUp/signInWithOAuth/resetPasswordForEmail` with calls to the backend `/api/auth/*` endpoints. **Remove social-login buttons** (Phase 0 decision). |
| ~20 feature pages that `import { supabase }` only to read the session/token (HR dashboard, jobs, departments, calendar, SuperAdmin users, Candidat profile, `useNotifications`, etc.) | Swap the `supabase.auth.getSession()` token read for the `apiClient` token. Most are one-line changes. |

### Dependencies (`frontend/package.json`)
Remove `@supabase/supabase-js`. Remove `VITE_SUPABASE_*` from all env files and build args.

---

## Phase 3 — Local MongoDB

- Add a `mongo` service (e.g. `mongo:7`) on the `traefik` network with an auth-enabled root user and a named volume for `/data/db`.
- Change `MONGODB_URL` to the internal service URL (`mongodb://user:pass@mongo:27017/HumatiQ?authSource=admin`). DB name in code is **`HumatiQ`**.
- Drop the Atlas-only `MONGODB_ATLAS_TLS_INSECURE` handling.
- Migrate data: `mongodump` from Atlas → `mongorestore` into the container (or seed fresh).

---

## Phase 4 — Production containerization & Traefik

Keep **your** Dockerfiles (multi-stage, non-root, CPU-only torch, model/static volumes) — they're better than the senior's. Create `docker-compose.prod.yml` (leave local-dev compose intact) wiring five services on the external `traefik` network:

- `mariadb` — root/app user, schema init, named volume.
- `mongo` — auth, named volume.
- `ollama` (if hosted here) — model volume.
- `backend` — no published ports; Traefik labels for `api-nexthire.itc4d.com` → port 8000; `websecure` + `letsencrypt`; `env_file: backend/.env`; `depends_on` db + mongo healthy; keep `backend_models` / `backend_static` volumes.
- `frontend` — Traefik labels for `nexthire.itc4d.com` → port 80; build args `VITE_API_URL=https://api-nexthire.itc4d.com`, `VITE_FRONTEND_URL=https://nexthire.itc4d.com` (+ TURN). **No `VITE_SUPABASE_*`.**

Copy the Traefik label block from the senior's `docker-compose.yml`. Adapt his `start.sh`/`stop.sh` to call `docker compose -f docker-compose.prod.yml` if you want one-command deploys.

### `.env.example` (production)
Merge into one template: domains (`APP_DOMAIN`, `API_DOMAIN`, `ALLOWED_ORIGINS`), MariaDB (`DB_HOST=mariadb`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`), `SECRET_KEY` (JWT — `python -c "import secrets;print(secrets.token_hex(32))"`), `MONGODB_URL`, `OLLAMA_BASE_URL`, SMTP/HF tokens, `VITE_API_URL`, `VITE_FRONTEND_URL`. **Remove all `SUPABASE_*` and `VITE_SUPABASE_*`.**

---

## Phase 5 — Deploy & verify

1. On the VPS: ensure the external `traefik` network exists; DNS for both subdomains points at the VPS.
2. `cp .env.example .env`, fill secrets, `docker compose -f docker-compose.prod.yml up --build -d`.
3. Verify:
   - `https://api-nexthire.itc4d.com/docs` loads with a valid cert.
   - Register + login through the new `/api/auth` flow returns a JWT; protected routes accept it.
   - `https://nexthire.itc4d.com` loads; full login → dashboard works for an HR user and a candidate.
   - Backend logs show MariaDB + Mongo connected and Ollama reachable; trigger one AI feature.
   - Grep the running frontend bundle and backend for any remaining `supabase` references (should be zero).

---

## Recommended branch strategy

Do **not** merge `nexthire-prod-v0.0.1`. Branch off `sprint1-partie-hr2` (e.g. `feature/local-db-migration`), do Phases 1–3 there with the senior's branch open as a reference, verify locally, then add Phase 4 deployment files. Cherry-pick *files/concepts* from the senior (`dependencies.py`, `mysql.py`, `apiClient.js`, Traefik labels) — not the branch.

## Suggested order of execution
1. MariaDB schema + `mysql.py` + `dependencies.py` (auth foundation).
2. Backend auth swap (`auth.py`, `middleware/auth.py`, `main.py`) — test register/login/me with curl.
3. Backend Supabase audit fixes (user creation, storage, metadata reads).
4. Frontend `apiClient` + ProtectedRoute + login pages — test end-to-end locally.
5. Local Mongo container + data migration.
6. Production compose + Traefik + `.env` → deploy → verify.
