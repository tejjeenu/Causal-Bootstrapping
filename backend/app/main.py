from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .feature_encoding import encode_single_record
from .model_store import ModelBundle, load_model_bundle, predict_with_uncertainty
from .schemas import (
    HealthResponse,
    ModelInfoResponse,
    PredictionInput,
    PredictionRequest,
    PredictionResponse,
    RiskRule,
)

settings = get_settings()

DEFAULT_RISK_RULES: list[RiskRule] = [
    RiskRule(threshold=0.0, label="Low Risk"),
    RiskRule(threshold=0.35, label="Medium Risk"),
    RiskRule(threshold=0.7, label="High Risk"),
]

app = FastAPI(
    title="Causal Heart Disease ML Inference API",
    description="Standalone FastAPI service for deconfounded heart disease model inference.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    if settings.auth_cookie_secure:
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    return response


def _get_bundle() -> ModelBundle:
    try:
        return load_model_bundle()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


def _normalize_rules(rules: list[RiskRule]) -> list[RiskRule]:
    return sorted(rules, key=lambda item: item.threshold)


def _classify_risk(probability: float, risk_rules: list[RiskRule]) -> str:
    sorted_rules = _normalize_rules(risk_rules)
    crossed_rules = [rule for rule in sorted_rules if probability >= rule.threshold]
    if crossed_rules:
        return crossed_rules[-1].label
    return sorted_rules[0].label


def _predict_from_input(payload: PredictionInput, risk_rules: list[RiskRule]) -> PredictionResponse:
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
    normalized_rules = _normalize_rules(risk_rules)

    return PredictionResponse(
        risk_probability=round(risk_probability, 6),
        risk_percent=round(risk_probability * 100, 2),
        risk_label=_classify_risk(risk_probability, normalized_rules),
        uncertainty_std=round(uncertainty_std, 6),
        uncertainty_percent=round(uncertainty_std * 100, 2),
        confidence_interval_95=[round(ci_low, 6), round(ci_high, 6)],
        model_name=bundle.model_name,
        training_source=bundle.training_source,
        risk_rules=normalized_rules,
    )


def _resolve_prediction_request(payload: PredictionInput | PredictionRequest) -> tuple[PredictionInput, list[RiskRule]]:
    if isinstance(payload, PredictionRequest):
        risk_rules = payload.risk_rules if payload.risk_rules else DEFAULT_RISK_RULES
        return payload.clinical_inputs, _normalize_rules(risk_rules)
    return payload, DEFAULT_RISK_RULES


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
def predict(payload: PredictionInput | PredictionRequest) -> PredictionResponse:
    clinical_inputs, risk_rules = _resolve_prediction_request(payload)
    return _predict_from_input(clinical_inputs, risk_rules)
