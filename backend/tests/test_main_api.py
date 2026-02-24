from __future__ import annotations

from fastapi.testclient import TestClient

from backend.app import main as app_main
from backend.app.model_store import ModelBundle
from backend.app.schemas import PredictionResponse, RiskRule


def _prediction_response(risk_label: str = "High") -> PredictionResponse:
    return PredictionResponse(
        risk_probability=0.72,
        risk_percent=72.0,
        risk_label=risk_label,
        uncertainty_std=0.05,
        uncertainty_percent=5.0,
        confidence_interval_95=[0.62, 0.82],
        model_name="MockModel",
        training_source="mock-source",
        risk_rules=[RiskRule(threshold=0.0, label="Low"), RiskRule(threshold=0.7, label="High")],
    )


def _saved_row():
    return {
        "id": "row-1",
        "created_at": "2026-02-24T12:00:00Z",
        "patient_first_name": "Ada",
        "patient_last_name": "Lovelace",
        "clinical_inputs": {"age": 58},
        "risk_probability": 0.72,
        "risk_percent": 72.0,
        "risk_label": "High",
        "uncertainty_std": 0.05,
        "uncertainty_percent": 5.0,
        "confidence_interval_95": [0.62, 0.82],
    }


def _auth_cookie(test_settings):
    return {test_settings.auth_cookie_name: "session-token"}


def _allow_origin_headers():
    return {"origin": "http://localhost:5173"}


def test_health_returns_model_loaded_true(monkeypatch, test_settings):
    monkeypatch.setattr(app_main, "settings", test_settings)
    monkeypatch.setattr(app_main, "load_model_bundle", lambda: object())
    client = TestClient(app_main.app)

    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "model_loaded": True}


def test_health_returns_model_loaded_false(monkeypatch, test_settings):
    monkeypatch.setattr(app_main, "settings", test_settings)

    def _missing():
        raise FileNotFoundError("artifact missing")

    monkeypatch.setattr(app_main, "load_model_bundle", _missing)
    client = TestClient(app_main.app)

    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "model_loaded": False}


def test_model_info_returns_bundle_metadata(monkeypatch, test_settings):
    monkeypatch.setattr(app_main, "settings", test_settings)
    bundle = ModelBundle(
        model=object(),
        bootstrap_models=[object(), object()],
        model_name="NeuralNet",
        training_source="dataset.csv",
        feature_columns=["a", "b", "c"],
        selection_metrics={"auc": 0.91},
    )
    monkeypatch.setattr(app_main, "load_model_bundle", lambda: bundle)
    client = TestClient(app_main.app)

    response = client.get("/model-info")
    assert response.status_code == 200
    body = response.json()
    assert body["model_name"] == "NeuralNet"
    assert body["bootstrap_count"] == 2
    assert body["feature_count"] == 3


def test_predict_endpoint_returns_prediction(monkeypatch, test_settings, prediction_payload):
    monkeypatch.setattr(app_main, "settings", test_settings)
    monkeypatch.setattr(app_main, "_predict_from_input", lambda _payload, _rules: _prediction_response("Medium"))
    client = TestClient(app_main.app)

    response = client.post("/predict", json=prediction_payload)
    assert response.status_code == 200
    assert response.json()["risk_label"] == "Medium"


def test_auth_me_without_cookie_is_unauthenticated(monkeypatch, test_settings):
    monkeypatch.setattr(app_main, "settings", test_settings)
    client = TestClient(app_main.app)

    response = client.get("/auth/me")
    assert response.status_code == 200
    assert response.json() == {"authenticated": False, "user": None, "email_confirmation_required": False}


def test_auth_login_sets_cookie(monkeypatch, test_settings):
    monkeypatch.setattr(app_main, "settings", test_settings)
    monkeypatch.setattr(
        app_main,
        "sign_in_with_password",
        lambda _settings, _email, _password: {
            "access_token": "abc123",
            "expires_in": 600,
            "user": {"id": "user-1", "email": "user@example.com"},
        },
    )
    client = TestClient(app_main.app)

    response = client.post("/auth/login", json={"email": "user@example.com", "password": "secret123"})
    assert response.status_code == 200
    assert response.json()["authenticated"] is True
    assert test_settings.auth_cookie_name in response.headers.get("set-cookie", "")


def test_results_requires_auth(monkeypatch, test_settings, save_payload):
    monkeypatch.setattr(app_main, "settings", test_settings)
    client = TestClient(app_main.app)

    response = client.post("/results", json=save_payload, headers=_allow_origin_headers())
    assert response.status_code == 401


def test_save_result_success(monkeypatch, test_settings, save_payload):
    monkeypatch.setattr(app_main, "settings", test_settings)
    monkeypatch.setattr(app_main, "get_user_for_token", lambda _settings, _token: {"id": "user-1", "email": "u@e.com"})
    monkeypatch.setattr(
        app_main,
        "get_risk_settings",
        lambda _settings, access_token: [
            {"threshold": 0.0, "label": "Low"},
            {"threshold": 0.7, "label": "High"},
        ],
    )
    monkeypatch.setattr(app_main, "_predict_from_input", lambda _payload, _rules: _prediction_response("High"))
    monkeypatch.setattr(app_main, "insert_prediction_result", lambda *args, **kwargs: _saved_row())
    client = TestClient(app_main.app)

    response = client.post(
        "/results",
        json=save_payload,
        cookies=_auth_cookie(test_settings),
        headers=_allow_origin_headers(),
    )
    assert response.status_code == 201
    body = response.json()
    assert body["patient_first_name"] == "Ada"
    assert body["patient_last_name"] == "Lovelace"
    assert body["risk_label"] == "High"


def test_save_result_rejects_untrusted_origin(monkeypatch, test_settings, save_payload):
    monkeypatch.setattr(app_main, "settings", test_settings)
    monkeypatch.setattr(app_main, "get_user_for_token", lambda _settings, _token: {"id": "user-1", "email": "u@e.com"})
    client = TestClient(app_main.app)

    response = client.post(
        "/results",
        json=save_payload,
        cookies=_auth_cookie(test_settings),
        headers={"origin": "https://malicious.example.com"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Request origin is not allowed."


def test_get_results_success(monkeypatch, test_settings):
    monkeypatch.setattr(app_main, "settings", test_settings)
    monkeypatch.setattr(app_main, "get_user_for_token", lambda _settings, _token: {"id": "user-1", "email": "u@e.com"})
    monkeypatch.setattr(app_main, "list_prediction_results", lambda _settings, access_token, limit=50: [_saved_row()])
    client = TestClient(app_main.app)

    response = client.get("/results", cookies=_auth_cookie(test_settings))
    assert response.status_code == 200
    body = response.json()
    assert len(body["results"]) == 1
    assert body["results"][0]["patient_first_name"] == "Ada"


def test_get_results_returns_502_for_malformed_row(monkeypatch, test_settings):
    monkeypatch.setattr(app_main, "settings", test_settings)
    monkeypatch.setattr(app_main, "get_user_for_token", lambda _settings, _token: {"id": "user-1", "email": "u@e.com"})
    bad_row = _saved_row()
    bad_row["risk_probability"] = "not-a-number"
    monkeypatch.setattr(app_main, "list_prediction_results", lambda _settings, access_token, limit=50: [bad_row])
    client = TestClient(app_main.app)

    response = client.get("/results", cookies=_auth_cookie(test_settings))
    assert response.status_code == 502
    assert "invalid 'risk_probability'" in response.json()["detail"]


def test_put_risk_settings_success(monkeypatch, test_settings):
    monkeypatch.setattr(app_main, "settings", test_settings)
    monkeypatch.setattr(app_main, "get_user_for_token", lambda _settings, _token: {"id": "user-1", "email": "u@e.com"})
    monkeypatch.setattr(app_main, "replace_risk_settings", lambda _settings, access_token, rules: rules)
    seen = {"called": False}

    def _sync(_settings, access_token, rules):
        seen["called"] = True
        return 0

    monkeypatch.setattr(app_main, "sync_prediction_result_labels", _sync)
    client = TestClient(app_main.app)

    response = client.put(
        "/risk-settings",
        json={"rules": [{"threshold": 0.0, "label": "Low"}, {"threshold": 0.8, "label": "High"}]},
        cookies=_auth_cookie(test_settings),
        headers=_allow_origin_headers(),
    )
    assert response.status_code == 200
    assert response.json()["rules"][1]["label"] == "High"
    assert seen["called"] is True
