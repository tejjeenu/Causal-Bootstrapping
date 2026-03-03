# Deployment Guide: Render + Firebase

This guide deploys:

- Frontend (`frontend/`) to Firebase Hosting
- FastAPI backend (`fastapi-backend/`) to Render (Docker Web Service)
- Spring backend (`spring-backend/`) to Render (Docker Web Service)

## 1) Prerequisites

- GitHub repo connected to Render
- Firebase project created
- Supabase project + tables/policies set up (see `spring-backend/README.md`)
- Node.js installed locally (for Firebase + frontend build)

## 2) Deploy FastAPI on Render

Create a new Render **Web Service**:

- Source: this repo
- Runtime: `Docker`
- Root Directory: `fastapi-backend`
- Dockerfile Path: `./Dockerfile`
- Health Check Path: `/health`

Set environment variables:

```text
MODEL_ARTIFACT_PATH=/app/models/xgboost_backdoor_best_artifact.joblib
NORMALIZATION_SETTINGS_PATH=/app/models/initial_eda_normalization_settings.json
INFERENCE_CACHE_SIZE=512
CORS_ORIGINS=https://<your-firebase-site>.web.app,https://<your-firebase-site>.firebaseapp.com
```

Deploy and copy the service URL, for example:

```text
https://causal-fastapi-backend.onrender.com
```

## 3) Deploy Spring on Render

Create another Render **Web Service**:

- Source: this repo
- Runtime: `Docker`
- Root Directory: `spring-backend`
- Dockerfile Path: `./Dockerfile`
- Health Check Path: `/health`

Set environment variables:

```text
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_RESULTS_TABLE=prediction_results
SUPABASE_RISK_SETTINGS_TABLE=risk_classification_settings
AUTH_COOKIE_NAME=cb_auth_token
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAMESITE=None
CORS_ORIGINS=https://<your-firebase-site>.web.app,https://<your-firebase-site>.firebaseapp.com
CRUD_API_PORT=8080
```

Deploy and copy the service URL, for example:

```text
https://causal-spring-backend.onrender.com
```

## 4) Configure Frontend Production API URLs

Create `frontend/.env.production`:

```text
VITE_ML_API_BASE_URL=https://<your-fastapi-service>.onrender.com
VITE_CRUD_API_BASE_URL=https://<your-spring-service>.onrender.com
```

Note:

- local app usage on `localhost` still routes to local `/ml-api` and `/crud-api` paths by design
- these production URLs apply to deployed frontend hosts (for example Firebase Hosting)

Optional (Firebase analytics in frontend):

```powershell
cd frontend
Copy-Item src\firebase\firebase.config.local.example.js src\firebase\firebase.config.local.js
```

Then edit `src/firebase/firebase.config.local.js` with your Firebase config.
This file is gitignored. Frontend scripts auto-generate `src/firebase/firebase.config.generated.js` before build/test/dev.

## 5) Deploy Frontend to Firebase Hosting

From repo root:

```powershell
npm install -g firebase-tools
firebase login
firebase use cad-causal-risk-predictor
```

This repo already includes:

- `firebase.json` (Hosting public dir + SPA rewrite + predeploy build)
- `.firebaserc` (default project: `cad-causal-risk-predictor`)

Deploy:

```powershell
firebase deploy --only hosting
```

## 6) Post-Deploy Checks

- Open your Firebase URL and load the app
- Check FastAPI health:
  - `https://<fastapi-service>.onrender.com/health`
- Check Spring health:
  - `https://<spring-service>.onrender.com/health`
- In UI: signup/login, run prediction, save result, load history

## 7) Troubleshooting

- CORS errors:
  - Set `CORS_ORIGINS` on both backends to the exact Firebase origin(s)
- Auth cookie not persisting:
  - Use HTTPS
  - `AUTH_COOKIE_SECURE=true`
  - `AUTH_COOKIE_SAMESITE=None`
- Slow first request on Render free services:
  - Free instances can spin down when idle and cold-start on the next request
- Cross-site cookie restrictions:
  - If browser policies block third-party cookies, use custom domains for frontend and backend

## Official Docs

- Render Docker services: https://render.com/docs/deploy-an-image
- Render free tier/spin down behavior: https://render.com/docs/free
- Firebase Hosting setup: https://firebase.google.com/docs/hosting/quickstart
- Firebase Hosting config (`firebase.json`): https://firebase.google.com/docs/hosting/full-config
- Firebase Hosting usage/limits: https://firebase.google.com/docs/hosting/usage-quotas-pricing
