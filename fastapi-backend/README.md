# FastAPI Backend (ML Inference Only)

This service is now dedicated to ML inference. It does not handle auth or Supabase CRUD.

## 1. Install dependencies

```powershell
cd fastapi-backend
python -m venv .venv
.venv\Scripts\activate
python -m pip install -r requirements.txt
```

## 2. Model artifacts

Expected files:

- `fastapi-backend/models/xgboost_backdoor_best_artifact.joblib`
- `fastapi-backend/models/initial_eda_normalization_settings.json`

## 3. Configure environment (`.env`)

```powershell
Copy-Item .env.example .env
```

- `CORS_ORIGINS` (optional, default localhost frontend origins)
- `MODEL_ARTIFACT_PATH` (required)
- `NORMALIZATION_SETTINGS_PATH` (required)
- `INFERENCE_CACHE_SIZE` (optional, default `512`; set `0` to disable caching)

## 4. Run API

```powershell
python -m uvicorn app.main:app --reload --port 8000
```

If you get `Form data requires "python-multipart" to be installed`, it usually means a different Python interpreter is running Uvicorn than the one where dependencies were installed. Activate `.venv` and run the API with `python -m uvicorn` as shown above.

## Endpoints

- `GET /health`
- `GET /model-info`
- `POST /predict`
- `POST /predict/batch-csv`

`POST /predict` accepts either:

- plain clinical feature payload, or
- wrapped payload with `clinical_inputs` + optional `risk_rules`.

`POST /predict/batch-csv` accepts a CSV upload (`multipart/form-data`) with required columns:

- `age`
- `trestbps`
- `chol`
- `thalach`
- `oldpeak`
- `ca`
- `sex`
- `cp`
- `fbs`
- `restecg`
- `exang`
- `slope`
- `thal`

Optional CSV columns:

- `patient_first_name`
- `patient_last_name`

See [`docs/ML_API.md`](../docs/ML_API.md) for full examples.
