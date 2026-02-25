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

- `neural_network_model.joblib` (or `MODEL_ARTIFACT_PATH` override)
- `fastapi-backend/models/initial_eda_normalization_settings.json` (or `NORMALIZATION_SETTINGS_PATH` override)

## 3. Configure environment (`.env`)

- `CORS_ORIGINS` (optional, default localhost frontend origins)
- `MODEL_ARTIFACT_PATH` (optional)
- `NORMALIZATION_SETTINGS_PATH` (optional)
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
