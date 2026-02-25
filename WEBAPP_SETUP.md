# Causal Risk Predictor Web App Setup

## 1) Start FastAPI ML inference service

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r backend\requirements.txt
uvicorn backend.app.main:app --reload --port 8000
```

## 2) Start Spring Boot CRUD service

```powershell
cd spring-backend
mvn spring-boot:run
```

Before running Spring Boot, set these environment variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

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

- FastAPI: inference only (`/health`, `/model-info`, `/predict`)
- Spring Boot: auth + CRUD (`/auth/*`, `/risk-settings`, `/results`)
