# FastAPI Backend (ML Inference Only)

This service is now dedicated to ML inference. It does not handle auth or Supabase CRUD.

## 1. Install dependencies

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r backend\requirements.txt
```

## 2. Model artifacts

Expected files:

- `neural_network_model.joblib` (or `MODEL_ARTIFACT_PATH` override)
- `backend/models/initial_eda_normalization_settings.json` (or `NORMALIZATION_SETTINGS_PATH` override)

## 3. Configure environment (`backend/.env`)

- `CORS_ORIGINS` (optional, default localhost frontend origins)
- `MODEL_ARTIFACT_PATH` (optional)
- `NORMALIZATION_SETTINGS_PATH` (optional)

## 4. Run API

```powershell
uvicorn backend.app.main:app --reload --port 8000
```

## Endpoints

- `GET /health`
- `GET /model-info`
- `POST /predict`

`POST /predict` accepts either:

- plain clinical feature payload, or
- wrapped payload with `clinical_inputs` + optional `risk_rules`.

See [`docs/ML_API.md`](../docs/ML_API.md) for full examples.
