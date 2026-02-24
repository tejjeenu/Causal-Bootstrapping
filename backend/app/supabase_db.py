from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

from .config import Settings


class SupabaseDBError(Exception):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def ensure_supabase_db_config(settings: Settings) -> None:
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise SupabaseDBError(
            status_code=500,
            detail="Supabase database is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.",
        )


def _rest_request(
    settings: Settings,
    *,
    method: str,
    path: str,
    access_token: str,
    payload: Any = None,
    prefer: str | None = None,
) -> Any:
    ensure_supabase_db_config(settings)
    base_url = settings.supabase_url.rstrip("/") + "/"
    target_url = urljoin(base_url, f"rest/v1/{path.lstrip('/')}")

    body = None
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")

    headers = {
        "apikey": settings.supabase_anon_key,
        "Accept": "application/json",
        "Authorization": f"Bearer {access_token}",
    }
    if payload is not None:
        headers["Content-Type"] = "application/json"
    if prefer:
        headers["Prefer"] = prefer

    request = Request(url=target_url, data=body, method=method.upper(), headers=headers)

    try:
        with urlopen(request, timeout=15) as response:
            raw = response.read().decode("utf-8").strip()
            if not raw:
                return {}
            return json.loads(raw)
    except HTTPError as exc:
        raw_error = exc.read().decode("utf-8").strip()
        detail = f"Supabase database request failed with status {exc.code}."
        if raw_error:
            try:
                error_payload = json.loads(raw_error)
                detail = (
                    error_payload.get("message")
                    or error_payload.get("hint")
                    or error_payload.get("details")
                    or error_payload.get("error")
                    or detail
                )
            except json.JSONDecodeError:
                detail = raw_error
        raise SupabaseDBError(status_code=exc.code, detail=detail) from exc
    except URLError as exc:
        raise SupabaseDBError(status_code=502, detail=f"Unable to reach Supabase: {exc.reason}") from exc


def get_risk_settings(settings: Settings, *, access_token: str) -> list[dict[str, Any]]:
    select = "threshold,label"
    path = f"{settings.supabase_risk_settings_table}?select={select}&order=threshold.asc"
    data = _rest_request(settings, method="GET", path=path, access_token=access_token)
    if isinstance(data, list):
        return data
    raise SupabaseDBError(status_code=502, detail="Unexpected response when loading risk settings.")


def replace_risk_settings(
    settings: Settings,
    *,
    access_token: str,
    rules: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    delete_path = f"{settings.supabase_risk_settings_table}?user_id=not.is.null"
    _rest_request(
        settings,
        method="DELETE",
        path=delete_path,
        access_token=access_token,
        prefer="return=minimal",
    )

    payload = [
        {
            "threshold": float(rule["threshold"]),
            "label": str(rule["label"]).strip(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        for rule in rules
    ]
    data = _rest_request(
        settings,
        method="POST",
        path=settings.supabase_risk_settings_table,
        access_token=access_token,
        payload=payload,
        prefer="return=representation",
    )
    if isinstance(data, list):
        return data
    raise SupabaseDBError(status_code=502, detail="Unexpected response when saving risk settings.")


def _normalize_rule_thresholds(rules: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for rule in rules:
        try:
            threshold = float(rule["threshold"])
        except (KeyError, TypeError, ValueError) as exc:
            raise SupabaseDBError(status_code=500, detail="Risk settings contain an invalid threshold.") from exc
        label = str(rule.get("label", "")).strip()
        if not label:
            raise SupabaseDBError(status_code=500, detail="Risk settings contain an empty label.")
        normalized.append({"threshold": threshold, "label": label})
    return sorted(normalized, key=lambda item: item["threshold"])


def _classify_probability(probability: float, rules: list[dict[str, Any]]) -> str:
    if not rules:
        raise SupabaseDBError(status_code=500, detail="No risk settings available for classification.")

    current_label = rules[0]["label"]
    for rule in rules:
        if probability >= float(rule["threshold"]):
            current_label = rule["label"]
        else:
            break
    return current_label


def sync_prediction_result_labels(
    settings: Settings,
    *,
    access_token: str,
    rules: list[dict[str, Any]],
) -> int:
    normalized_rules = _normalize_rule_thresholds(rules)
    updated_count = 0
    page_size = 200
    offset = 0

    while True:
        path = (
            f"{settings.supabase_results_table}"
            f"?select=id,risk_probability,risk_label"
            f"&order=created_at.desc&limit={page_size}&offset={offset}"
        )
        data = _rest_request(settings, method="GET", path=path, access_token=access_token)
        if not isinstance(data, list):
            raise SupabaseDBError(status_code=502, detail="Unexpected response when syncing result classifications.")
        if not data:
            break

        for row in data:
            row_id = row.get("id")
            if not isinstance(row_id, str) or not row_id:
                raise SupabaseDBError(status_code=502, detail="Saved result row is missing 'id' during sync.")

            probability_raw = row.get("risk_probability")
            try:
                probability = float(probability_raw)
            except (TypeError, ValueError) as exc:
                raise SupabaseDBError(
                    status_code=502,
                    detail="Saved result row has invalid 'risk_probability' during sync.",
                ) from exc

            expected_label = _classify_probability(probability, normalized_rules)
            current_label = str(row.get("risk_label") or "").strip()
            if current_label == expected_label:
                continue

            patch_path = f"{settings.supabase_results_table}?id=eq.{row_id}"
            _rest_request(
                settings,
                method="PATCH",
                path=patch_path,
                access_token=access_token,
                payload={"risk_label": expected_label},
                prefer="return=minimal",
            )
            updated_count += 1

        if len(data) < page_size:
            break
        offset += page_size

    return updated_count


def insert_prediction_result(
    settings: Settings,
    *,
    access_token: str,
    clinical_inputs: dict[str, Any],
    risk_probability: float,
    risk_percent: float,
    risk_label: str,
    uncertainty_std: float,
    uncertainty_percent: float,
    confidence_interval_95: list[float],
) -> dict[str, Any]:
    payload = {
        "clinical_inputs": clinical_inputs,
        "risk_probability": risk_probability,
        "risk_percent": risk_percent,
        "risk_label": risk_label,
        "uncertainty_std": uncertainty_std,
        "uncertainty_percent": uncertainty_percent,
        "confidence_interval_95": confidence_interval_95,
    }
    data = _rest_request(
        settings,
        method="POST",
        path=settings.supabase_results_table,
        access_token=access_token,
        payload=payload,
        prefer="return=representation",
    )
    if isinstance(data, list) and data:
        return data[0]
    raise SupabaseDBError(status_code=502, detail="Unexpected response when saving prediction result.")


def list_prediction_results(
    settings: Settings,
    *,
    access_token: str,
    limit: int = 50,
) -> list[dict[str, Any]]:
    safe_limit = min(max(limit, 1), 200)
    select = (
        "id,created_at,clinical_inputs,risk_probability,risk_percent,risk_label,"
        "uncertainty_std,uncertainty_percent,confidence_interval_95"
    )
    path = f"{settings.supabase_results_table}?select={select}&order=created_at.desc&limit={safe_limit}"
    data = _rest_request(settings, method="GET", path=path, access_token=access_token)
    if isinstance(data, list):
        return data
    raise SupabaseDBError(status_code=502, detail="Unexpected response when loading saved results.")
