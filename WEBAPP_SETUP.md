# Causal Risk Predictor Web App

## Backend (FastAPI)

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r backend\requirements.txt
uvicorn backend.app.main:app --reload --port 8000
```

Required backend artifacts:

- `neural_network_model.joblib`
- `backend/models/initial_eda_normalization_settings.json`

## Frontend (React + Vite)

```powershell
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173` and proxies `/api/*` to the backend on port `8000`.
