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


def test_predict_endpoint_supports_plain_payload(monkeypatch, test_settings, prediction_payload):
    monkeypatch.setattr(app_main, "settings", test_settings)
    monkeypatch.setattr(app_main, "_predict_from_input", lambda _payload, _rules: _prediction_response("Medium"))
    client = TestClient(app_main.app)

    response = client.post("/predict", json=prediction_payload)
    assert response.status_code == 200
    assert response.json()["risk_label"] == "Medium"


def test_predict_endpoint_supports_custom_rules_payload(monkeypatch, test_settings, prediction_payload):
    monkeypatch.setattr(app_main, "settings", test_settings)
    seen = {"rules": None}

    def _predict(_payload, rules):
        seen["rules"] = rules
        return _prediction_response("Custom")

    monkeypatch.setattr(app_main, "_predict_from_input", _predict)
    client = TestClient(app_main.app)

    response = client.post(
        "/predict",
        json={
            "clinical_inputs": prediction_payload,
            "risk_rules": [
                {"threshold": 0.0, "label": "Low"},
                {"threshold": 0.5, "label": "High"},
            ],
        },
    )

    assert response.status_code == 200
    assert response.json()["risk_label"] == "Custom"
    assert seen["rules"][0].label == "Low"
    assert seen["rules"][1].threshold == 0.5


def test_predict_rejects_duplicate_custom_thresholds(monkeypatch, test_settings, prediction_payload):
    monkeypatch.setattr(app_main, "settings", test_settings)
    client = TestClient(app_main.app)

    response = client.post(
        "/predict",
        json={
            "clinical_inputs": prediction_payload,
            "risk_rules": [
                {"threshold": 0.3, "label": "Low"},
                {"threshold": 0.30000000001, "label": "Medium"},
            ],
        },
    )

    assert response.status_code == 422
    assert "Threshold values must be unique" in response.text
