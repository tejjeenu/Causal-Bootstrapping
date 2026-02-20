# FastAPI Backend

## 1. Install dependencies

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r backend\requirements.txt
```

## 2. Train and save the best deconfounded model artifact

```powershell
python backend\train_best_deconfounded_model.py
```

This generates:

`backend/models/best_deconfounded_model.joblib`

`--bootstrap-count` is optional (default is `10`).

## 3. Run the API

```powershell
uvicorn backend.app.main:app --reload --port 8000
```

## API endpoints

- `GET /health`
- `GET /model-info`
- `POST /predict`
