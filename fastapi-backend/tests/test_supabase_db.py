from __future__ import annotations

import pytest

from app.config import Settings
from app.supabase_db import (
    SupabaseDBError,
    _classify_probability,
    _normalize_rule_thresholds,
    ensure_supabase_db_config,
    insert_prediction_result,
    list_prediction_results,
    sync_prediction_result_labels,
)


def _settings() -> Settings:
    return Settings(
        supabase_url="https://example.supabase.co",
        supabase_anon_key="anon",
        supabase_results_table="prediction_results",
        supabase_risk_settings_table="risk_classification_settings",
        auth_cookie_name="cb_auth_token",
        auth_cookie_secure=False,
        auth_cookie_samesite="lax",
        cors_origins=("http://localhost:5173",),
    )


def test_ensure_supabase_db_config_requires_values():
    with pytest.raises(SupabaseDBError, match="Supabase database is not configured"):
        ensure_supabase_db_config(
            Settings(
                supabase_url="",
                supabase_anon_key="",
                supabase_results_table="prediction_results",
                supabase_risk_settings_table="risk_classification_settings",
                auth_cookie_name="cb_auth_token",
                auth_cookie_secure=False,
                auth_cookie_samesite="lax",
                cors_origins=("http://localhost:5173",),
            )
        )


def test_normalize_rule_thresholds_sorts_and_validates():
    rules = [
        {"threshold": 0.7, "label": "High"},
        {"threshold": 0.0, "label": "Low"},
    ]
    normalized = _normalize_rule_thresholds(rules)
    assert normalized == [{"threshold": 0.0, "label": "Low"}, {"threshold": 0.7, "label": "High"}]

    with pytest.raises(SupabaseDBError, match="invalid threshold"):
        _normalize_rule_thresholds([{"threshold": "not-a-number", "label": "Bad"}])

    with pytest.raises(SupabaseDBError, match="empty label"):
        _normalize_rule_thresholds([{"threshold": 0.4, "label": "   "}])


def test_classify_probability_uses_last_crossed_threshold():
    rules = [
        {"threshold": 0.0, "label": "Low"},
        {"threshold": 0.5, "label": "Medium"},
        {"threshold": 0.8, "label": "High"},
    ]
    assert _classify_probability(0.2, rules) == "Low"
    assert _classify_probability(0.7, rules) == "Medium"
    assert _classify_probability(0.95, rules) == "High"


def test_insert_prediction_result_includes_patient_name_fields(monkeypatch):
    captured = {}

    def _fake_rest_request(settings, *, method, path, access_token, payload=None, prefer=None):
        captured["payload"] = payload
        return [{"id": "row-1"}]

    monkeypatch.setattr("app.supabase_db._rest_request", _fake_rest_request)

    row = insert_prediction_result(
        _settings(),
        access_token="token",
        patient_first_name="Ada",
        patient_last_name="Lovelace",
        clinical_inputs={"age": 58},
        risk_probability=0.7,
        risk_percent=70.0,
        risk_label="High",
        uncertainty_std=0.1,
        uncertainty_percent=10.0,
        confidence_interval_95=[0.6, 0.8],
    )

    assert row == {"id": "row-1"}
    assert captured["payload"]["patient_first_name"] == "Ada"
    assert captured["payload"]["patient_last_name"] == "Lovelace"


def test_list_prediction_results_requests_patient_name_columns(monkeypatch):
    captured = {}

    def _fake_rest_request(settings, *, method, path, access_token, payload=None, prefer=None):
        captured["path"] = path
        return []

    monkeypatch.setattr("app.supabase_db._rest_request", _fake_rest_request)
    rows = list_prediction_results(_settings(), access_token="token", limit=10)

    assert rows == []
    assert "patient_first_name" in captured["path"]
    assert "patient_last_name" in captured["path"]


def test_sync_prediction_result_labels_updates_mismatched_rows(monkeypatch):
    calls = {"patched": []}

    def _fake_rest_request(settings, *, method, path, access_token, payload=None, prefer=None):
        if method == "GET":
            return [{"id": "row-1", "risk_probability": 0.9, "risk_label": "Low"}]
        if method == "PATCH":
            calls["patched"].append({"path": path, "payload": payload, "prefer": prefer})
            return {}
        raise AssertionError(f"Unexpected method: {method}")

    monkeypatch.setattr("app.supabase_db._rest_request", _fake_rest_request)

    updated_count = sync_prediction_result_labels(
        _settings(),
        access_token="token",
        rules=[{"threshold": 0.0, "label": "Low"}, {"threshold": 0.8, "label": "High"}],
    )

    assert updated_count == 1
    assert calls["patched"][0]["payload"] == {"risk_label": "High"}


def test_sync_prediction_result_labels_rejects_invalid_probability(monkeypatch):
    def _fake_rest_request(settings, *, method, path, access_token, payload=None, prefer=None):
        if method == "GET":
            return [{"id": "row-1", "risk_probability": "not-a-number", "risk_label": "Low"}]
        raise AssertionError("PATCH should not be called for invalid row")

    monkeypatch.setattr("app.supabase_db._rest_request", _fake_rest_request)

    with pytest.raises(SupabaseDBError, match="invalid 'risk_probability'"):
        sync_prediction_result_labels(
            _settings(),
            access_token="token",
            rules=[{"threshold": 0.0, "label": "Low"}],
        )

