# FastAPI Backend

## 1. Install dependencies

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r backend\requirements.txt
```

## 2. Ensure model and normalization artifacts exist

```powershell
# expected model artifact (already present in this repo by default)
neural_network_model.joblib

# normalization settings exported from initial EDA
backend\models\initial_eda_normalization_settings.json
```

If the normalization JSON is missing, run the normalization export cell in
`initial EDA.ipynb` (the cell that applies `log1p` to `oldpeak` and `StandardScaler`).

You can also override paths with environment variables:

- `MODEL_ARTIFACT_PATH`
- `NORMALIZATION_SETTINGS_PATH`

## 3. Run the API

```powershell
uvicorn backend.app.main:app --reload --port 8000
```

## API endpoints

- `GET /health`
- `GET /model-info`
- `POST /predict`
