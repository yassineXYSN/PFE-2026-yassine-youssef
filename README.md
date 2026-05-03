# NextHire AI

AI-powered recruitment platform — Final Year Project (PFE) 2026.

## Overview

NextHire AI connects job seekers with companies through three dedicated portals:

| Portal | URL path | Roles |
|--------|----------|-------|
| **Candidat** | `/candidat/*` | Job seekers |
| **HR** | `/hr/*` | `admin`, `recruiter`, `chef_departement` |
| **SuperAdmin** | `/super-admin/*` | Platform administrators |

Authentication is handled client-side via **Supabase Auth**. The FastAPI backend handles business logic and persists additional data in **MongoDB Atlas**.

---

## Architecture

```
Internet
   │
   ▼
Traefik v2.11  (reverse proxy + TLS — shared VPS instance)
   ├── nexthire.itc4d.com      ──►  nexthire-frontend  (Nginx + React SPA)
   └── api-nexthire.itc4d.com  ──►  nexthire-backend   (FastAPI / Uvicorn)
                                           │
                                  ┌────────┴────────┐
                             MongoDB Atlas       Supabase
                             (app data)          (auth + storage)
```

---

## Tech Stack

### Frontend
- React 19, React Router 7, Vite 7
- Tailwind CSS 4, Headless UI, Framer Motion
- Recharts (analytics charts)
- Supabase JS (client-side auth)

### Backend
- FastAPI + Uvicorn, Python 3.11
- PyMongo → MongoDB Atlas
- Supabase Python client

### Infrastructure
- Docker (`docker build` + `docker run`)
- Traefik v2.11 (shared reverse proxy, automatic TLS via Let's Encrypt)
- Nginx (static asset serving for the SPA)

---

## Project Structure

```
.
├── backend/
│   ├── main.py              # FastAPI app, CORS, router registration
│   ├── auth.py              # Auth router (business logic; Supabase handles auth client-side)
│   ├── database/
│   │   ├── mongodb.py       # MongoDB Atlas connection
│   │   └── supabase.py      # Supabase client initialisation
│   ├── requirements.txt
│   └── Dockerfile           # Context = repo root
│
├── frontend/
│   ├── src/
│   │   ├── core/            # App entry, routing, auth guard, Supabase client
│   │   └── apps/
│   │       ├── Candidat/    # Job seeker portal
│   │       ├── HR/          # Recruiter portal
│   │       └── SuperAdmin/  # Platform admin portal
│   ├── nginx.conf           # SPA fallback + asset caching
│   ├── Dockerfile           # Multi-stage: Node build → Nginx
│   └── package.json
│
├── docs/
│   └── supabase_setup.sql   # Supabase schema migrations
│
├── start.sh                 # Build + run both containers (production)
├── stop.sh                  # Stop + remove both containers
├── docker-compose.yml       # Alternative to start.sh (same result)
└── .env.example             # Environment variable template
```

---

## Local Development

### Prerequisites
- Python 3.11+, Node.js 20+
- A `backend/.env` with `MONGODB_URL`, `SUPABASE_URL`, `SUPABASE_KEY`
- A `frontend/.env.local` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..
uvicorn backend.main:app --reload
```

API docs: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
# create frontend/.env.local:
# VITE_SUPABASE_URL=https://xxxx.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key
# VITE_API_URL=http://localhost:8000
npm run dev
```

App: http://localhost:5173

---

## Production Deployment

The VPS already runs **Traefik v2.11** on the `traefik` Docker network with Let's Encrypt.  
DNS must point `nexthire.itc4d.com` and `api-nexthire.itc4d.com` at the VPS IP before deploying.

### First deployment

```bash
cp .env.example .env
# fill in all values
nano .env

bash start.sh
```

### Update (rebuild and restart)

```bash
git pull
bash start.sh       # stops old containers, rebuilds images, starts new ones
```

### Stop

```bash
bash stop.sh
```

### Integrated deployment (all VPS services at once)

NextHire is wired into the central orchestration script.  
From the VPS, running the global script starts/restarts every service including NextHire:

```bash
bash /root/travail/traefik/start-all-services.sh
```

### Logs

```bash
docker logs -f nexthire-backend
docker logs -f nexthire-frontend
```

---

## Environment Variables

| Variable | Used by | Description |
|----------|---------|-------------|
| `APP_DOMAIN` | start.sh | Frontend hostname (`nexthire.itc4d.com`) |
| `API_DOMAIN` | start.sh | Backend hostname (`api-nexthire.itc4d.com`) |
| `MONGODB_URL` | backend runtime | MongoDB Atlas connection string |
| `MONGODB_ATLAS_TLS_INSECURE` | backend runtime | `true` only if Atlas TLS fails on this host |
| `SUPABASE_URL` | backend runtime | Supabase project URL |
| `SUPABASE_KEY` | backend runtime | Supabase **service-role** key (never exposed to browser) |
| `ALLOWED_ORIGINS` | backend runtime | CORS whitelist (e.g. `https://nexthire.itc4d.com`) |
| `VITE_SUPABASE_URL` | frontend build | Supabase URL — baked into the JS bundle at build time |
| `VITE_SUPABASE_ANON_KEY` | frontend build | Supabase **anon/public** key — baked into the JS bundle |

> `VITE_*` variables are embedded at **build time** by Vite. Re-run `start.sh` whenever they change.

---

## Database Setup

### Supabase
Run `docs/supabase_setup.sql` in the Supabase SQL editor to create tables, RLS policies, and initial roles.

### MongoDB Atlas
The backend connects and pings on startup. Create a dedicated Atlas user and whitelist the VPS IP (or use `0.0.0.0/0` with a strong password).

---

## Routes Reference

| Route | Portal | Access |
|-------|--------|--------|
| `/candidat/login` | Candidat | Public |
| `/candidat/dashboard` | Candidat | Authenticated |
| `/candidat/dashboard/find-jobs` | Candidat | Authenticated |
| `/candidat/dashboard/profile` | Candidat | Authenticated |
| `/hr/login` | HR | Public |
| `/hr/dashboard` | HR | `admin`, `recruiter`, `chef_departement` |
| `/hr/offres` | HR | `admin`, `recruiter`, `chef_departement` |
| `/hr/candidats` | HR | `admin`, `recruiter`, `chef_departement` |
| `/hr/departement` | HR | `admin`, `recruiter`, `chef_departement` |
| `/super-admin/dashboard` | SuperAdmin | `super_admin` |
