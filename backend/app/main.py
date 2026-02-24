from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .feature_encoding import encode_single_record
from .model_store import ModelBundle, load_model_bundle, predict_with_uncertainty
from .schemas import (
    AuthCredentials,
    AuthSessionResponse,
    AuthUser,
    HealthResponse,
    MessageResponse,
    ModelInfoResponse,
    PredictionInput,
    PredictionResponse,
    RiskClassificationRulesUpsertRequest,
    RiskClassificationSettingsResponse,
    RiskRule,
    SavePredictionRequest,
    SavedPredictionListResponse,
    SavedPredictionRecord,
)
from .supabase_auth import (
    SupabaseAuthError,
    get_user_for_token,
    sign_in_with_password,
    sign_out,
    sign_up_with_password,
)
from .supabase_db import (
    SupabaseDBError,
    get_risk_settings,
    insert_prediction_result,
    list_prediction_results,
    replace_risk_settings,
    sync_prediction_result_labels,
)

settings = get_settings()

DEFAULT_RISK_RULES: list[RiskRule] = [
    RiskRule(threshold=0.0, label="Low Risk"),
    RiskRule(threshold=0.35, label="Medium Risk"),
    RiskRule(threshold=0.7, label="High Risk"),
]

app = FastAPI(
    title="Causal Heart Disease Risk API",
    description="FastAPI backend for deconfounded heart disease risk prediction with uncertainty.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
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


def _translate_auth_error(exc: SupabaseAuthError) -> HTTPException:
    status_code = exc.status_code if 400 <= exc.status_code <= 599 else 502
    return HTTPException(status_code=status_code, detail=exc.detail)


def _translate_db_error(exc: SupabaseDBError) -> HTTPException:
    status_code = exc.status_code if 400 <= exc.status_code <= 599 else 502
    return HTTPException(status_code=status_code, detail=exc.detail)


def _extract_user(data: dict[str, Any]) -> dict[str, Any]:
    if isinstance(data.get("user"), dict):
        return data["user"]
    if "id" in data:
        return data
    return {}


def _extract_access_token(data: dict[str, Any]) -> tuple[str | None, int]:
    token = data.get("access_token")
    expires_in = data.get("expires_in")

    if not token and isinstance(data.get("session"), dict):
        session = data["session"]
        token = session.get("access_token")
        expires_in = session.get("expires_in", expires_in)

    if not isinstance(expires_in, int) or expires_in <= 0:
        expires_in = 3600
    return token, expires_in


def _map_auth_user(data: dict[str, Any]) -> AuthUser:
    user_data = _extract_user(data)
    user_id = user_data.get("id")
    if not user_id:
        raise HTTPException(status_code=502, detail="Supabase response did not include user information.")
    return AuthUser(id=user_id, email=user_data.get("email"))


def _set_auth_cookie(response: Response, access_token: str, expires_in: int) -> None:
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=access_token,
        max_age=expires_in,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite,
        path="/",
    )


def _clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(key=settings.auth_cookie_name, path="/")


def _require_authenticated_user(request: Request) -> AuthUser:
    access_token = request.cookies.get(settings.auth_cookie_name)
    if not access_token:
        raise HTTPException(status_code=401, detail="Authentication required.")

    try:
        user_data = get_user_for_token(settings, access_token)
    except SupabaseAuthError as exc:
        if exc.status_code in {401, 403}:
            raise HTTPException(status_code=401, detail="Invalid or expired session.") from exc
        raise _translate_auth_error(exc) from exc

    return _map_auth_user(user_data)


def _get_session_access_token(request: Request) -> str:
    access_token = request.cookies.get(settings.auth_cookie_name)
    if not access_token:
        raise HTTPException(status_code=401, detail="Authentication required.")
    return access_token


def _normalized_origin(value: str) -> str | None:
    parsed = urlparse(value.strip())
    if not parsed.scheme or not parsed.netloc:
        return None
    return f"{parsed.scheme}://{parsed.netloc}".rstrip("/").lower()


def _enforce_trusted_origin(request: Request) -> None:
    origin_header = request.headers.get("origin")
    referer_header = request.headers.get("referer")
    allowed_origins = {origin.rstrip("/").lower() for origin in settings.cors_origins}

    if origin_header:
        normalized_origin = _normalized_origin(origin_header)
        if not normalized_origin or normalized_origin not in allowed_origins:
            raise HTTPException(status_code=403, detail="Request origin is not allowed.")
        return

    if referer_header:
        normalized_referer_origin = _normalized_origin(referer_header)
        if not normalized_referer_origin or normalized_referer_origin not in allowed_origins:
            raise HTTPException(status_code=403, detail="Request origin is not allowed.")


def _build_risk_rule(rule: dict[str, Any]) -> RiskRule:
    try:
        return RiskRule(threshold=float(rule["threshold"]), label=str(rule["label"]).strip())
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="Risk settings row is malformed.") from exc


def _normalize_rules(rules: list[RiskRule]) -> list[RiskRule]:
    return sorted(rules, key=lambda item: item.threshold)


def _get_or_default_risk_rules(access_token: str, *, strict: bool) -> list[RiskRule]:
    try:
        rows = get_risk_settings(settings, access_token=access_token)
    except SupabaseDBError as exc:
        if strict:
            raise _translate_db_error(exc) from exc
        return DEFAULT_RISK_RULES

    if not rows:
        return DEFAULT_RISK_RULES
    built_rules = [_build_risk_rule(rule) for rule in rows]
    return _normalize_rules(built_rules) if built_rules else DEFAULT_RISK_RULES


def _resolve_predict_risk_rules(request: Request) -> list[RiskRule]:
    access_token = request.cookies.get(settings.auth_cookie_name)
    if not access_token:
        return DEFAULT_RISK_RULES
    return _get_or_default_risk_rules(access_token, strict=False)


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


def _to_float_or_error(value: Any, field_name: str) -> float:
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=f"Saved result row has invalid '{field_name}'.") from exc


def _map_saved_result_row(row: dict[str, Any]) -> SavedPredictionRecord:
    record_id = row.get("id")
    created_at = row.get("created_at")
    patient_first_name = str(row.get("patient_first_name") or row.get("first_name") or "").strip()
    patient_last_name = str(row.get("patient_last_name") or row.get("last_name") or "").strip()
    clinical_inputs = row.get("clinical_inputs")
    confidence_interval = row.get("confidence_interval_95")

    if not isinstance(record_id, str) or not record_id:
        raise HTTPException(status_code=502, detail="Saved result row is missing 'id'.")
    if not isinstance(created_at, str) or not created_at:
        raise HTTPException(status_code=502, detail="Saved result row is missing 'created_at'.")
    if not isinstance(clinical_inputs, dict):
        clinical_inputs = {}
    if not isinstance(confidence_interval, list):
        confidence_interval = []

    confidence_values: list[float] = []
    for value in confidence_interval:
        try:
            confidence_values.append(float(value))
        except (TypeError, ValueError):
            continue

    return SavedPredictionRecord(
        id=record_id,
        created_at=created_at,
        patient_first_name=patient_first_name,
        patient_last_name=patient_last_name,
        clinical_inputs=clinical_inputs,
        risk_probability=_to_float_or_error(row.get("risk_probability"), "risk_probability"),
        risk_percent=_to_float_or_error(row.get("risk_percent"), "risk_percent"),
        risk_label=str(row.get("risk_label") or ""),
        uncertainty_std=_to_float_or_error(row.get("uncertainty_std"), "uncertainty_std"),
        uncertainty_percent=_to_float_or_error(row.get("uncertainty_percent"), "uncertainty_percent"),
        confidence_interval_95=confidence_values,
    )


@app.post("/auth/signup", response_model=AuthSessionResponse, status_code=status.HTTP_201_CREATED)
def auth_signup(payload: AuthCredentials, response: Response) -> AuthSessionResponse:
    try:
        data = sign_up_with_password(settings, payload.email, payload.password)
    except SupabaseAuthError as exc:
        raise _translate_auth_error(exc) from exc

    user = _map_auth_user(data)
    access_token, expires_in = _extract_access_token(data)
    if access_token:
        _set_auth_cookie(response, access_token, expires_in)

    return AuthSessionResponse(
        authenticated=bool(access_token),
        user=user,
        email_confirmation_required=not bool(access_token),
    )


@app.post("/auth/login", response_model=AuthSessionResponse)
def auth_login(payload: AuthCredentials, response: Response) -> AuthSessionResponse:
    try:
        data = sign_in_with_password(settings, payload.email, payload.password)
    except SupabaseAuthError as exc:
        raise _translate_auth_error(exc) from exc

    user = _map_auth_user(data)
    access_token, expires_in = _extract_access_token(data)
    if not access_token:
        raise HTTPException(status_code=401, detail="Login failed. No access token returned.")

    _set_auth_cookie(response, access_token, expires_in)
    return AuthSessionResponse(authenticated=True, user=user)


@app.get("/auth/me", response_model=AuthSessionResponse)
def auth_me(request: Request, response: Response) -> AuthSessionResponse:
    access_token = request.cookies.get(settings.auth_cookie_name)
    if not access_token:
        return AuthSessionResponse(authenticated=False, user=None)

    try:
        data = get_user_for_token(settings, access_token)
    except SupabaseAuthError as exc:
        if exc.status_code in {401, 403}:
            _clear_auth_cookie(response)
            return AuthSessionResponse(authenticated=False, user=None)
        raise _translate_auth_error(exc) from exc

    return AuthSessionResponse(authenticated=True, user=_map_auth_user(data))


@app.post("/auth/logout", response_model=MessageResponse)
def auth_logout(request: Request, response: Response) -> MessageResponse:
    _enforce_trusted_origin(request)
    access_token = request.cookies.get(settings.auth_cookie_name)
    if access_token:
        try:
            sign_out(settings, access_token)
        except SupabaseAuthError as exc:
            if exc.status_code not in {401, 403}:
                raise _translate_auth_error(exc) from exc

    _clear_auth_cookie(response)
    return MessageResponse(detail="Logged out.")


@app.get("/risk-settings", response_model=RiskClassificationSettingsResponse)
def get_user_risk_settings(request: Request, _: AuthUser = Depends(_require_authenticated_user)) -> RiskClassificationSettingsResponse:
    access_token = _get_session_access_token(request)
    risk_rules = _get_or_default_risk_rules(access_token, strict=True)
    return RiskClassificationSettingsResponse(rules=risk_rules)


@app.put("/risk-settings", response_model=RiskClassificationSettingsResponse)
def replace_user_risk_settings(
    payload: RiskClassificationRulesUpsertRequest,
    request: Request,
    _: AuthUser = Depends(_require_authenticated_user),
) -> RiskClassificationSettingsResponse:
    _enforce_trusted_origin(request)
    access_token = _get_session_access_token(request)
    normalized_rules = _normalize_rules(payload.rules)
    rule_payload = [{"threshold": rule.threshold, "label": rule.label} for rule in normalized_rules]
    try:
        rows = replace_risk_settings(settings, access_token=access_token, rules=rule_payload)
        sync_prediction_result_labels(settings, access_token=access_token, rules=rule_payload)
    except SupabaseDBError as exc:
        raise _translate_db_error(exc) from exc

    saved_rules = [_build_risk_rule(row) for row in rows]
    return RiskClassificationSettingsResponse(rules=_normalize_rules(saved_rules))


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
def predict(payload: PredictionInput, request: Request) -> PredictionResponse:
    risk_rules = _resolve_predict_risk_rules(request)
    return _predict_from_input(payload, risk_rules)


@app.post("/results", response_model=SavedPredictionRecord, status_code=status.HTTP_201_CREATED)
def save_result(
    payload: SavePredictionRequest,
    request: Request,
    _: AuthUser = Depends(_require_authenticated_user),
) -> SavedPredictionRecord:
    _enforce_trusted_origin(request)
    access_token = _get_session_access_token(request)
    risk_rules = _get_or_default_risk_rules(access_token, strict=True)
    prediction = _predict_from_input(payload.clinical_inputs, risk_rules)

    try:
        row = insert_prediction_result(
            settings,
            access_token=access_token,
            patient_first_name=payload.patient_first_name,
            patient_last_name=payload.patient_last_name,
            clinical_inputs=payload.clinical_inputs.model_dump(),
            risk_probability=prediction.risk_probability,
            risk_percent=prediction.risk_percent,
            risk_label=prediction.risk_label,
            uncertainty_std=prediction.uncertainty_std,
            uncertainty_percent=prediction.uncertainty_percent,
            confidence_interval_95=prediction.confidence_interval_95,
        )
    except SupabaseDBError as exc:
        raise _translate_db_error(exc) from exc

    return _map_saved_result_row(row)


@app.get("/results", response_model=SavedPredictionListResponse)
def get_saved_results(
    request: Request,
    _: AuthUser = Depends(_require_authenticated_user),
) -> SavedPredictionListResponse:
    access_token = _get_session_access_token(request)
    try:
        rows = list_prediction_results(settings, access_token=access_token, limit=50)
    except SupabaseDBError as exc:
        raise _translate_db_error(exc) from exc

    return SavedPredictionListResponse(results=[_map_saved_result_row(row) for row in rows])
