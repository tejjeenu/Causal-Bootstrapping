from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .feature_encoding import encode_single_record
from .model_store import ModelBundle, load_model_bundle, predict_with_uncertainty
from .schemas import HealthResponse, ModelInfoResponse, PredictionInput, PredictionResponse

app = FastAPI(
    title="Causal Heart Disease Risk API",
    description="FastAPI backend for deconfounded heart disease risk prediction with uncertainty.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _get_bundle() -> ModelBundle:
    try:
        return load_model_bundle()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    try:
        load_model_bundle()
        return HealthResponse(status="ok", model_loaded=True)
    except FileNotFoundError:
        return HealthResponse(status="ok", model_loaded=False)


@app.get("/model-info", response_model=ModelInfoResponse)
def model_info() -> ModelInfoResponse:
    bundle = _get_bundle()
    return ModelInfoResponse(
        model_name=bundle.model_name,
        training_source=bundle.training_source,
        selection_metrics=bundle.selection_metrics,
        bootstrap_count=len(bundle.bootstrap_models),
        feature_count=len(bundle.feature_columns),
    )


@app.post("/predict", response_model=PredictionResponse)
def predict(payload: PredictionInput) -> PredictionResponse:
    bundle = _get_bundle()
    try:
        features = encode_single_record(payload.model_dump())
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    risk_probability, uncertainty_std = predict_with_uncertainty(bundle, features)

    ci_low = max(0.0, risk_probability - 1.96 * uncertainty_std)
    ci_high = min(1.0, risk_probability + 1.96 * uncertainty_std)

    return PredictionResponse(
        risk_probability=round(risk_probability, 6),
        risk_percent=round(risk_probability * 100, 2),
        risk_label="High Risk" if risk_probability >= 0.5 else "Low Risk",
        uncertainty_std=round(uncertainty_std, 6),
        uncertainty_percent=round(uncertainty_std * 100, 2),
        confidence_interval_95=[round(ci_low, 6), round(ci_high, 6)],
        model_name=bundle.model_name,
        training_source=bundle.training_source,
    )
