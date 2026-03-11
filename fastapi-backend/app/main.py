from __future__ import annotations

import csv
import io
import json
from functools import lru_cache

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from .config import get_settings
from .feature_encoding import encode_single_record
from .model_store import ModelBundle, load_model_bundle, predict_with_uncertainty
from .schemas import (
    BatchPredictionRecord,
    BatchPredictionResponse,
    HealthResponse,
    ModelInfoResponse,
    PredictionInput,
    PredictionRequest,
    PredictionResponse,
    RiskRule,
)

settings = get_settings()
MAX_BATCH_PREDICTION_ROWS = 1000
ZERO_THRESHOLD_TOLERANCE = 1e-10

CSV_REQUIRED_COLUMNS = (
    "age",
    "trestbps",
    "chol",
    "thalach",
    "oldpeak",
    "ca",
    "sex",
    "cp",
    "fbs",
    "restecg",
    "exang",
    "slope",
    "thal",
)

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


def _align_features_for_bundle(bundle: ModelBundle, features):
    if not bundle.feature_columns:
        return features
    return features.reindex(columns=bundle.feature_columns, fill_value=0.0)


def _predict_uncached(payload: PredictionInput, risk_rules: list[RiskRule]) -> PredictionResponse:
    bundle = _get_bundle()
    try:
        features = encode_single_record(payload.model_dump())
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    features = _align_features_for_bundle(bundle, features)
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


def _build_rules_cache_key(risk_rules: list[RiskRule]) -> str:
    normalized_rules = _normalize_rules(risk_rules)
    data = [{"threshold": rule.threshold, "label": rule.label} for rule in normalized_rules]
    return json.dumps(data, separators=(",", ":"), sort_keys=True)


def _predict_from_cache_key(payload_json: str, rules_json: str) -> dict:
    payload = PredictionInput.model_validate_json(payload_json)
    rules = [RiskRule.model_validate(item) for item in json.loads(rules_json)]
    return _predict_uncached(payload, rules).model_dump()


if settings.inference_cache_size > 0:

    @lru_cache(maxsize=settings.inference_cache_size)
    def _predict_cached(payload_json: str, rules_json: str) -> dict:
        return _predict_from_cache_key(payload_json, rules_json)

else:

    def _predict_cached(payload_json: str, rules_json: str) -> dict:
        return _predict_from_cache_key(payload_json, rules_json)


def clear_inference_cache() -> None:
    cache_clear = getattr(_predict_cached, "cache_clear", None)
    if callable(cache_clear):
        cache_clear()


def _predict_from_input(payload: PredictionInput, risk_rules: list[RiskRule]) -> PredictionResponse:
    payload_key = payload.model_dump_json()
    rules_key = _build_rules_cache_key(risk_rules)
    cached = _predict_cached(payload_key, rules_key)
    return PredictionResponse.model_validate(cached)


def _resolve_prediction_request(payload: PredictionInput | PredictionRequest) -> tuple[PredictionInput, list[RiskRule]]:
    if isinstance(payload, PredictionRequest):
        risk_rules = payload.risk_rules if payload.risk_rules else DEFAULT_RISK_RULES
        return payload.clinical_inputs, _normalize_rules(risk_rules)
    return payload, DEFAULT_RISK_RULES


def _parse_csv_risk_rules(risk_rules_json: str | None) -> list[RiskRule]:
    if not risk_rules_json:
        return DEFAULT_RISK_RULES

    try:
        payload = json.loads(risk_rules_json)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail="risk_rules_json must be valid JSON.") from exc

    if not isinstance(payload, list) or len(payload) < 2:
        raise HTTPException(status_code=422, detail="risk_rules_json must be a JSON array with at least two rules.")

    try:
        rules = [RiskRule.model_validate(item) for item in payload]
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=f"Invalid risk rule payload: {exc}") from exc

    seen: set[float] = set()
    has_zero_threshold = False
    for rule in rules:
        key = round(rule.threshold, 10)
        if key in seen:
            raise HTTPException(status_code=422, detail="Threshold values must be unique.")
        seen.add(key)
        if abs(rule.threshold) <= ZERO_THRESHOLD_TOLERANCE:
            has_zero_threshold = True
    if not has_zero_threshold:
        raise HTTPException(status_code=422, detail="One threshold must be 0.")

    return _normalize_rules(rules)


def _parse_csv_file(content: str) -> list[tuple[int, dict[str, str], str | None, str | None]]:
    reader = csv.DictReader(io.StringIO(content))
    if not reader.fieldnames:
        raise HTTPException(status_code=422, detail="CSV file must include a header row.")

    normalized_headers = [str(header).strip() for header in reader.fieldnames]
    missing_columns = [column for column in CSV_REQUIRED_COLUMNS if column not in normalized_headers]
    if missing_columns:
        raise HTTPException(
            status_code=422,
            detail=f"CSV is missing required column(s): {', '.join(missing_columns)}.",
        )

    parsed_rows: list[tuple[int, dict[str, str], str | None, str | None]] = []
    for row_index, raw_row in enumerate(reader, start=2):
        if len(parsed_rows) >= MAX_BATCH_PREDICTION_ROWS:
            raise HTTPException(
                status_code=422,
                detail=f"CSV supports at most {MAX_BATCH_PREDICTION_ROWS} data rows per request.",
            )

        row = {str(key).strip(): "" if value is None else str(value).strip() for key, value in raw_row.items()}
        if not any(value for value in row.values()):
            continue

        record: dict[str, str] = {}
        for column in CSV_REQUIRED_COLUMNS:
            value = row.get(column, "")
            if not value:
                raise HTTPException(status_code=422, detail=f"Row {row_index}: Missing value for '{column}'.")
            record[column] = value

        first_name = row.get("patient_first_name") or None
        last_name = row.get("patient_last_name") or None
        parsed_rows.append((row_index, record, first_name, last_name))

    if not parsed_rows:
        raise HTTPException(status_code=422, detail="CSV did not include any non-empty data rows.")

    return parsed_rows


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


@app.post("/predict/batch-csv", response_model=BatchPredictionResponse)
async def predict_batch_csv(
    file: UploadFile = File(...),
    risk_rules_json: str | None = Form(default=None),
) -> BatchPredictionResponse:
    filename = str(file.filename or "").lower()
    content_type = str(file.content_type or "").lower()
    if not filename.endswith(".csv") and (content_type and "csv" not in content_type):
        raise HTTPException(status_code=422, detail="Uploaded file must be a CSV.")

    raw_bytes = await file.read()
    try:
        decoded_content = raw_bytes.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=422, detail="CSV must be UTF-8 encoded.") from exc

    parsed_rows = _parse_csv_file(decoded_content)
    risk_rules = _parse_csv_risk_rules(risk_rules_json)

    predictions: list[BatchPredictionRecord] = []
    for row_number, row_values, first_name, last_name in parsed_rows:
        try:
            clinical_inputs = PredictionInput.model_validate(row_values)
        except ValidationError as exc:
            raise HTTPException(status_code=422, detail=f"Row {row_number}: {exc}") from exc

        prediction = _predict_from_input(clinical_inputs, risk_rules)
        predictions.append(
            BatchPredictionRecord(
                row_number=row_number,
                patient_first_name=first_name,
                patient_last_name=last_name,
                clinical_inputs=clinical_inputs,
                prediction=prediction,
            )
        )

    return BatchPredictionResponse(total_rows=len(predictions), predictions=predictions)
