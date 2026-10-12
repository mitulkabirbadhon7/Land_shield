# LandShield

Independent, tamper-evident land deed verification and explainable fraud detection platform for Bangladesh (LandTech Innovation Hackathon 2026).

## Quick Start

### Backend (FastAPI + Python 3.11+)
```bash
python -m venv .venv
.venv\Scripts\activate      # Windows
pip install -r backend/requirements.txt
pytest backend/tests -v
uvicorn app.main:app --app-dir backend --reload
```

### Frontend (Next.js + TypeScript + Tailwind CSS)
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the bilingual portal.

## Run with Docker

> ⚠️ Local Docker verification was not possible on the authors' machine (Docker Desktop unavailable). The Docker setup is provided as-is for reviewers. The primary deliverable is the live deployment link; the Docker path is optional for local reproduction.

Run the complete production-grade stack (PostgreSQL 15, FastAPI backend, Next.js frontend) with a single command:

```bash
# 1. Start all services in the background (builds images & starts containers)
docker compose up --build -d

# 2. View real-time logs
docker compose logs -f

# 3. Check backend health
curl http://localhost:8000/api/v1/health

# 4. Stop all services
docker compose down

# 5. Reset database volume & clean slate
docker compose down -v
```

Or use the provided `Makefile` shortcuts: `make up`, `make logs`, `make down`, `make reset`.

### Port & Service Mapping
| Service | Container | Host URL / Port | Healthcheck |
|---|---|---|---|
| PostgreSQL | `landshield-db` | `localhost:5432` | `pg_isready -U landshield -d landshield` |
| FastAPI Backend | `landshield-backend` | `http://localhost:8000` (Swagger: `/docs`) | `curl -f http://localhost:8000/api/v1/health` |
| Next.js Frontend | `landshield-frontend` | `http://localhost:3000` | `wget -q -O /dev/null http://localhost:3000/` |

> **API Base Contract:** The frontend connects via `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1`. Changing this URL requires rebuilding the frontend image (via `--build-arg NEXT_PUBLIC_API_URL=...`) because Next.js client-side environment variables are inlined at build time.

### Automated Seeding on Boot
With `SEED_ON_START=true` (enabled by default in `docker-compose.yml` and `.env.example`), the backend automatically checks if the database is empty on startup. If empty, it executes an idempotent seed generating 300 plots, 120 synthetic citizens, 3 demo staff accounts, and 8 benchmark fraud scenarios (S1–S8).

### LAN / Mobile Phone Demo & QR Scanning
To test the live camera QR scanner from a physical smartphone on your local Wi-Fi:
1. Find your machine's local LAN IP (e.g. `192.168.1.50` on Windows via `ipconfig`).
2. Rebuild the frontend container with your LAN IP:
   ```bash
   docker compose build --build-arg NEXT_PUBLIC_API_URL=http://<YOUR_LAN_IP>:8000/api/v1 frontend
   ```
3. Add your mobile origin to `ALLOWED_ORIGINS` in `.env`:
   ```env
   ALLOWED_ORIGINS=http://localhost:3000,http://<YOUR_LAN_IP>:3000
   ```
4. Start containers: `docker compose up -d`
5. Open `http://<YOUR_LAN_IP>:3000/verify` on your phone to scan registered deed QR codes.
> **Note:** The cryptographic keys volume (`./keys:/app/keys`) persists across container runs so Ed25519 signatures and QR tokens remain authentic and verifiable across restarts.

## Architecture & Documentation
- [docs/PRD.md](file:///c:/Land%20Project/Land_shield/docs/PRD.md): Product Requirements Document
- [docs/TRD.md](file:///c:/Land%20Project/Land_shield/docs/TRD.md): Technical Requirements & Cryptographic Architecture
- [docs/PROGRESS.md](file:///c:/Land%20Project/Land_shield/docs/PROGRESS.md): Session-by-Session Development Log
- [docs/DEMO_ACCOUNTS.md](file:///c:/Land%20Project/Land_shield/docs/DEMO_ACCOUNTS.md): Demo staff accounts (`registrar1`, `officer1`, `admin1`)
