# Causal Risk Predictor Web App Setup

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
