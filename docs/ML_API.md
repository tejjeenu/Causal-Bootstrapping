# ML Inference API Guide (FastAPI)

## Purpose

This API is dedicated to model inference only. It does not perform auth, persistence, or Supabase CRUD.

Base URL (local): `http://localhost:8000`

## Run Locally

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r fastapi-backend\requirements.txt
cd fastapi-backend
uvicorn app.main:app --reload --port 8000
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

Custom `risk_rules` constraints:

- at least 2 rules
- thresholds must be unique
- one rule must have `threshold` exactly `0`

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

### `POST /predict/batch-csv`

Accepts a `multipart/form-data` CSV file for multi-patient inference in one request.

Form fields:

- `file` (required): `.csv` file
- `risk_rules_json` (optional): JSON array of custom thresholds/labels

`risk_rules_json` uses the same constraints as `risk_rules` above.

CSV required columns:

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

CSV optional columns:

- `patient_first_name`
- `patient_last_name`

Example CSV:

```csv
patient_first_name,patient_last_name,age,trestbps,chol,thalach,oldpeak,ca,sex,cp,fbs,restecg,exang,slope,thal
Ada,Lovelace,58,132,224,173,3.2,2,Male,Asymptomatic,<=120,Normal ECG,Yes Ex Angina,Flat,Reversible Defect
Grace,Hopper,54,128,210,165,1.8,1,Female,Atypical Angina,<=120,Normal ECG,No Ex Angina,Upsloping,Normal
```

Example response shape:

```json
{
  "total_rows": 2,
  "predictions": [
    {
      "row_number": 2,
      "patient_first_name": "Ada",
      "patient_last_name": "Lovelace",
      "clinical_inputs": { "...": "..." },
      "prediction": { "...": "PredictionResponse fields" }
    }
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

Batch CSV cURL example:

```bash
curl -X POST "http://localhost:8000/predict/batch-csv" \
  -F "file=@patients.csv;type=text/csv" \
  -F 'risk_rules_json=[{"threshold":0.0,"label":"Low Risk"},{"threshold":0.35,"label":"Medium Risk"},{"threshold":0.7,"label":"High Risk"}]'
```

## OpenAPI Docs

- Swagger UI: `http://localhost:8000/docs`
- OpenAPI JSON: `http://localhost:8000/openapi.json`

## Integration Notes

- Use this API from any client (web/mobile/batch service).
- If your app has user-specific thresholds, pass them in `risk_rules` per request.
- Persist output with your own service (in this repo: Spring CRUD API).
- Identical inference requests are cached in-memory per process. Tune with `INFERENCE_CACHE_SIZE` (`0` disables cache).

## Other Use Cases

You can use this API without the React app or Spring CRUD service.

- Clinical decision support service-to-service call
- Batch scoring jobs over CSV data
- Scheduled nightly risk recalculation
- Mobile app backend integration
- Notebook / research automation pipelines

## Python Integration Example

```python
import requests

BASE_URL = "http://localhost:8000"

payload = {
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
        "thal": "Reversible Defect",
    },
    "risk_rules": [
        {"threshold": 0.0, "label": "Low Risk"},
        {"threshold": 0.35, "label": "Medium Risk"},
        {"threshold": 0.7, "label": "High Risk"},
    ],
}

response = requests.post(f"{BASE_URL}/predict", json=payload, timeout=20)
response.raise_for_status()
result = response.json()
print(result["risk_percent"], result["risk_label"])
```

## Node.js Integration Example

```js
const baseUrl = 'http://localhost:8000'

const payload = {
  clinical_inputs: {
    age: 58,
    trestbps: 132,
    chol: 224,
    thalach: 173,
    oldpeak: 3.2,
    ca: 2,
    sex: 'Male',
    cp: 'Asymptomatic',
    fbs: '<=120',
    restecg: 'Normal ECG',
    exang: 'Yes Ex Angina',
    slope: 'Flat',
    thal: 'Reversible Defect',
  },
}

const response = await fetch(`${baseUrl}/predict`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
})
if (!response.ok) {
  throw new Error(await response.text())
}
const result = await response.json()
console.log(result.risk_percent, result.risk_label)
```

## Batch CSV Scoring Pattern

1. Read your CSV rows.
2. Map each row to the `clinical_inputs` payload.
3. Call `POST /predict` per row.
4. Write response metrics (`risk_probability`, `risk_label`, uncertainty, confidence interval) back to your output file.

Recommended:
- Retry on transient `5xx` errors.
- Use bounded concurrency (for example 5-20 workers) instead of unbounded parallel requests.
- Keep payload categories exactly as defined in this document.

## Error Handling

- `422`: Invalid input schema or unsupported categorical value.
- `500`: Model artifact or normalization settings missing.
- `503/5xx`: Infrastructure/runtime issue (retry with backoff).

## Contract Stability

For external consumers, treat these fields as the stable output contract:

- `risk_probability`
- `risk_percent`
- `risk_label`
- `uncertainty_std`
- `uncertainty_percent`
- `confidence_interval_95`
- `model_name`
- `training_source`
