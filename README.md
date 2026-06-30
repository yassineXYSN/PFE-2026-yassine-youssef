# NextHire AI

AI-powered recruitment platform — Final Year Project (PFE) 2026.

## Overview

NextHire AI connects job seekers with companies through three dedicated portals:

| Portal | URL path | Roles |
|--------|----------|-------|
| **Candidat** | `/candidat/*` | Job seekers |
| **HR** | `/hr/*` | `admin`, `recruiter`, `chef_departement` |
| **SuperAdmin** | `/super-admin/*` | Platform administrators |

Authentication is handled via **JWT** (issued and verified by the FastAPI backend). The backend persists all data in a **local MariaDB** instance.

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
                                     MariaDB (local container)
```

---

## Tech Stack

### Frontend
- React 19, React Router 7, Vite 7
- Tailwind CSS 4, Headless UI, Framer Motion
- Recharts (analytics charts)
- JWT stored in `localStorage` — auth via `apiClient.js`

### Backend
- FastAPI + Uvicorn, Python 3.11
- PyMySQL → local MariaDB
- `python-jose` + `passlib[bcrypt]` — JWT issuance and verification

### Infrastructure
- Docker Compose
- Traefik v2.11 (shared reverse proxy, automatic TLS via Let's Encrypt)
- Nginx (static asset serving for the SPA)

---

## Project Structure

```
.
├── backend/
│   ├── main.py              # FastAPI app, CORS, router registration
│   ├── auth.py              # /auth router — login, register, JWT
│   ├── dependencies.py      # get_current_user dependency
│   ├── database/
│   │   └── mysql.py         # MariaDB connection helpers (pymysql)
│   ├── routers/
│   │   └── settings.py      # User settings router
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── core/            # App entry, routing, auth guard, API client
│   │   │   ├── apiClient.js # JWT token helpers + apiFetch wrapper
│   │   │   └── auth/        # ProtectedRoute, logout
│   │   └── apps/
│   │       ├── Candidat/    # Job seeker portal
│   │       ├── HR/          # Recruiter portal
│   │       └── SuperAdmin/  # Platform admin portal
│   ├── nginx.conf           # SPA fallback + asset caching
│   ├── Dockerfile           # Multi-stage: Node build → Nginx
│   └── package.json
│
├── docs/
│   └── schema.sql           # MariaDB schema (auto-loaded on first run)
│
├── start.sh                 # Build + run all containers (production)
├── stop.sh                  # Stop + remove all containers
├── docker-compose.yml       # Alternative to start.sh
└── .env.example             # Environment variable template
```

---

## Local Development

### Prerequisites
- Python 3.11+, Node.js 20+
- A running MariaDB instance (local or Docker)

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` at the project root:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=nexthire
DB_PASSWORD=your-password
DB_NAME=nexthire
SECRET_KEY=your-secret-key
ALLOWED_ORIGINS=http://localhost:5173
```

```bash
cd ..
uvicorn backend.main:app --reload
```

API docs: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:
```env
VITE_API_URL=http://localhost:8000
```

```bash
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
nano .env          # fill in all values

bash start.sh
```

### Update (rebuild and restart)

```bash
git pull
bash start.sh      # stops old containers, rebuilds images, starts new ones
```

### Stop

```bash
bash stop.sh
```

### Logs

```bash
docker logs -f nexthire-db
docker logs -f nexthire-backend
docker logs -f nexthire-frontend
```

---

## Environment Variables

| Variable | Used by | Description |
|----------|---------|-------------|
| `APP_DOMAIN` | start.sh | Frontend hostname (`nexthire.itc4d.com`) |
| `API_DOMAIN` | start.sh | Backend hostname (`api-nexthire.itc4d.com`) |
| `DB_HOST` | backend runtime | MariaDB hostname (`nexthire-db` in Docker) |
| `DB_PORT` | backend runtime | MariaDB port (default `3306`) |
| `DB_USER` | backend + db container | Database user |
| `DB_PASSWORD` | backend + db container | Database password |
| `DB_NAME` | backend + db container | Database name |
| `SECRET_KEY` | backend runtime | JWT signing key — generate with `python3 -c "import secrets; print(secrets.token_hex(32))"` |
| `ALLOWED_ORIGINS` | backend runtime | CORS whitelist (e.g. `https://nexthire.itc4d.com`) |
| `VITE_API_URL` | frontend build | Backend URL — baked into the JS bundle at build time |

> `VITE_*` variables are embedded at **build time** by Vite. Re-run `start.sh` whenever they change.

---

## Database Setup

The MariaDB schema lives in `docs/schema.sql` and is mounted as an init script — it runs automatically on first container start. No manual step required.

For local development, apply it manually:

```bash
mysql -u nexthire -p nexthire < docs/schema.sql
```

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
