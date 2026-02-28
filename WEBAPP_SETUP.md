# Causal Risk Predictor Web App Setup

## 0) Run as a Docker multi-container app (deployment style)

From repo root:

### First-time setup

```powershell
Copy-Item .env.compose.example .env
# edit .env and set:
# SUPABASE_URL
# SUPABASE_ANON_KEY
```

### Start all services

```powershell
docker compose up --build -d
```

Services:

- Frontend: `http://localhost` (or `http://localhost:$FRONTEND_PORT`)
- FastAPI: `http://localhost:8000` (or `:$FASTAPI_PORT`)
- Spring Boot: `http://localhost:8080` (or `:$SPRING_PORT`)

Compose stack behavior:

- Frontend container serves the React production build via Nginx.
- Nginx proxies `/ml-api/*` to FastAPI and `/crud-api/*` to Spring Boot.
- FastAPI loads:
  - model artifact: `/app/models/best_deconfounded_model.joblib`
  - normalization settings: `/app/models/initial_eda_normalization_settings.json`

### Verify stack status

```powershell
docker compose ps
Invoke-WebRequest -UseBasicParsing http://localhost/ml-api/health | Select-Object -ExpandProperty Content
Invoke-WebRequest -UseBasicParsing http://localhost/crud-api/health | Select-Object -ExpandProperty Content
```

### View logs

```powershell
docker compose logs -f
```

### Stop stack

```powershell
docker compose down
```

## 1) Start FastAPI ML inference service

```powershell
cd fastapi-backend
python -m venv .venv
.venv\Scripts\activate
python -m pip install -r requirements.txt
# optional: tune inference cache size per process (default 512)
# $env:INFERENCE_CACHE_SIZE=1024
python -m uvicorn app.main:app --reload --port 8000
```

If you see `Form data requires "python-multipart" to be installed`, your terminal is usually using mixed Python environments. Re-run:

```powershell
cd fastapi-backend
.venv\Scripts\activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

## 2) Start Spring Boot CRUD service

In another terminal:

```powershell
cd spring-backend
# one-time setup (optional if values already exist in ../fastapi-backend/.env)
Copy-Item .env.example .env
# edit .env with your Supabase values
.\mvnw.cmd spring-boot:run
```

Optional:

- `SUPABASE_RESULTS_TABLE`
- `SUPABASE_RISK_SETTINGS_TABLE`
- `AUTH_COOKIE_NAME`
- `AUTH_COOKIE_SECURE`
- `AUTH_COOKIE_SAMESITE`
- `CORS_ORIGINS`

## 3) Start frontend

```powershell
cd frontend
npm install
npm run dev
```

Default frontend URL: `http://localhost:5173`

The Vite dev proxy routes:

- `/ml-api/*` -> `http://localhost:8000/*`
- `/crud-api/*` -> `http://localhost:8080/*`

## Frontend env overrides

- `VITE_ML_API_BASE_URL`
- `VITE_CRUD_API_BASE_URL`

## Supabase SQL

Run the table/RLS SQL from [`spring-backend/README.md`](spring-backend/README.md).

## API ownership summary

- FastAPI: inference only (`/health`, `/model-info`, `/predict`, `/predict/batch-csv`)
- Spring Boot: auth + CRUD (`/auth/*`, `/risk-settings`, `/results`)

For standalone/third-party ML API integrations (Python, Node.js, batch jobs), see [`docs/ML_API.md`](docs/ML_API.md).

The frontend includes a **Batch Prediction (CSV)** panel with a downloadable CSV template for multi-patient inference.

## Run all 3 layers in separate windows

From repo root:

```powershell
.\run-all-layers.ps1
```

This launches three PowerShell windows:

- FastAPI backend (`http://localhost:8000`)
- Spring backend (`http://localhost:8080`)
- Frontend (`http://localhost:5173`)
