# ML Inference API Guide (FastAPI)

## Purpose

This API is dedicated to model inference only. It does not perform auth, persistence, or Supabase CRUD.

Base URL (local): `http://localhost:8000`

## Run Locally

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r backend\requirements.txt
uvicorn backend.app.main:app --reload --port 8000
```

## Endpoints

### `GET /health`

Checks API status and whether the model artifact loaded.

Example response:

```json
{
  "status": "ok",
  "model_loaded": true
}
```

### `GET /model-info`

Returns metadata about the active model bundle.

### `POST /predict`

Supports two payload shapes.

1) Plain clinical input (default risk rules used)

```json
{
  "age": 58,
  "trestbps": 132,
  "chol": 224,
  "thalach": 173,
  "oldpeak": 3.2,
  "ca": 2,
  "sex": "Male",
  "cp": "Asymptomatic",
  "fbs": "<=120",
  "restecg": "Normal ECG",
  "exang": "Yes Ex Angina",
  "slope": "Flat",
  "thal": "Reversible Defect"
}
```

2) Wrapped request with custom risk rules (recommended for integration)

```json
{
  "clinical_inputs": {
    "age": 58,
    "trestbps": 132,
    "chol": 224,
    "thalach": 173,
    "oldpeak": 3.2,
    "ca": 2,
    "sex": "Male",
    "cp": "Asymptomatic",
    "fbs": "<=120",
    "restecg": "Normal ECG",
    "exang": "Yes Ex Angina",
    "slope": "Flat",
    "thal": "Reversible Defect"
  },
  "risk_rules": [
    { "threshold": 0.0, "label": "Low Risk" },
    { "threshold": 0.35, "label": "Medium Risk" },
    { "threshold": 0.7, "label": "High Risk" }
  ]
}
```

Example response:

```json
{
  "risk_probability": 0.721437,
  "risk_percent": 72.14,
  "risk_label": "High Risk",
  "uncertainty_std": 0.048221,
  "uncertainty_percent": 4.82,
  "confidence_interval_95": [0.626924, 0.81595],
  "model_name": "NeuralNetwork",
  "training_source": "heart_disease_preprocessed_backdoor.csv",
  "risk_rules": [
    { "threshold": 0.0, "label": "Low Risk" },
    { "threshold": 0.35, "label": "Medium Risk" },
    { "threshold": 0.7, "label": "High Risk" }
  ]
}
```

## cURL Example

```bash
curl -X POST "http://localhost:8000/predict" \
  -H "Content-Type: application/json" \
  -d '{
    "clinical_inputs": {
      "age": 58,
      "trestbps": 132,
      "chol": 224,
      "thalach": 173,
      "oldpeak": 3.2,
      "ca": 2,
      "sex": "Male",
      "cp": "Asymptomatic",
      "fbs": "<=120",
      "restecg": "Normal ECG",
      "exang": "Yes Ex Angina",
      "slope": "Flat",
      "thal": "Reversible Defect"
    },
    "risk_rules": [
      {"threshold": 0.0, "label": "Low Risk"},
      {"threshold": 0.35, "label": "Medium Risk"},
      {"threshold": 0.7, "label": "High Risk"}
    ]
  }'
```

## OpenAPI Docs

- Swagger UI: `http://localhost:8000/docs`
- OpenAPI JSON: `http://localhost:8000/openapi.json`

## Integration Notes

- Use this API from any client (web/mobile/batch service).
- If your app has user-specific thresholds, pass them in `risk_rules` per request.
- Persist output with your own service (in this repo: Spring CRUD API).
