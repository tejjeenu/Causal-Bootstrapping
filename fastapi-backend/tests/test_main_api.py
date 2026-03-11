from __future__ import annotations

from fastapi.testclient import TestClient

from app import main as app_main
from app.model_store import ModelBundle
from app.schemas import PredictionResponse, RiskRule


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


def test_predict_rejects_custom_rules_without_zero_threshold(monkeypatch, test_settings, prediction_payload):
    monkeypatch.setattr(app_main, "settings", test_settings)
    client = TestClient(app_main.app)

    response = client.post(
        "/predict",
        json={
            "clinical_inputs": prediction_payload,
            "risk_rules": [
                {"threshold": 0.2, "label": "Low"},
                {"threshold": 0.8, "label": "High"},
            ],
        },
    )

    assert response.status_code == 422
    assert "One threshold must be 0" in response.text


def test_predict_rejects_out_of_range_numeric_value(monkeypatch, test_settings, prediction_payload):
    monkeypatch.setattr(app_main, "settings", test_settings)
    client = TestClient(app_main.app)

    payload = dict(prediction_payload)
    payload["thalach"] = 201

    response = client.post("/predict", json=payload)

    assert response.status_code == 422
    assert "thalach" in response.text


def test_predict_rejects_out_of_range_integer_value(monkeypatch, test_settings, prediction_payload):
    monkeypatch.setattr(app_main, "settings", test_settings)
    client = TestClient(app_main.app)

    payload = dict(prediction_payload)
    payload["ca"] = 4

    response = client.post("/predict", json=payload)

    assert response.status_code == 422
    assert "ca" in response.text


def test_predict_from_input_uses_cache_for_identical_requests(monkeypatch, prediction_payload):
    calls = {"count": 0}

    def _fake_uncached(_payload, _rules):
        calls["count"] += 1
        return _prediction_response("Cached")

    monkeypatch.setattr(app_main, "_predict_uncached", _fake_uncached)
    app_main.clear_inference_cache()
    payload = app_main.PredictionInput(**prediction_payload)
    rules = [RiskRule(threshold=0.0, label="Low"), RiskRule(threshold=0.7, label="High")]

    first = app_main._predict_from_input(payload, rules)
    second = app_main._predict_from_input(payload, rules)

    assert first.risk_label == "Cached"
    assert second.risk_label == "Cached"
    assert calls["count"] == 1


def test_predict_cache_key_includes_risk_rules(monkeypatch, prediction_payload):
    calls = {"count": 0}

    def _fake_uncached(_payload, _rules):
        calls["count"] += 1
        return _prediction_response("RuleSpecific")

    monkeypatch.setattr(app_main, "_predict_uncached", _fake_uncached)
    app_main.clear_inference_cache()
    payload = app_main.PredictionInput(**prediction_payload)

    app_main._predict_from_input(
        payload,
        [RiskRule(threshold=0.0, label="Low"), RiskRule(threshold=0.7, label="High")],
    )
    app_main._predict_from_input(
        payload,
        [RiskRule(threshold=0.0, label="Low"), RiskRule(threshold=0.5, label="High")],
    )

    assert calls["count"] == 2


def test_predict_batch_csv_success(monkeypatch, test_settings):
    monkeypatch.setattr(app_main, "settings", test_settings)
    monkeypatch.setattr(app_main, "_predict_from_input", lambda _payload, _rules: _prediction_response("Batch High"))
    client = TestClient(app_main.app)

    csv_content = (
        "patient_first_name,patient_last_name,age,trestbps,chol,thalach,oldpeak,ca,sex,cp,fbs,restecg,exang,slope,thal\n"
        "Ada,Lovelace,58,132,224,173,3.2,2,Male,Asymptomatic,<=120,Normal ECG,Yes Ex Angina,Flat,Reversible Defect\n"
        "Grace,Hopper,54,128,210,165,1.8,1,Female,Atypical Angina,<=120,Normal ECG,No Ex Angina,Upsloping,Normal\n"
    )

    response = client.post(
        "/predict/batch-csv",
        files={"file": ("patients.csv", csv_content, "text/csv")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total_rows"] == 2
    assert body["predictions"][0]["patient_first_name"] == "Ada"
    assert body["predictions"][1]["row_number"] == 3
    assert body["predictions"][0]["prediction"]["risk_label"] == "Batch High"


def test_predict_batch_csv_missing_column_rejected(monkeypatch, test_settings):
    monkeypatch.setattr(app_main, "settings", test_settings)
    client = TestClient(app_main.app)
    csv_content = (
        "patient_first_name,patient_last_name,age,trestbps,chol,thalach,oldpeak,ca,sex,cp,fbs,restecg,exang,slope\n"
        "Ada,Lovelace,58,132,224,173,3.2,2,Male,Asymptomatic,<=120,Normal ECG,Yes Ex Angina,Flat\n"
    )

    response = client.post(
        "/predict/batch-csv",
        files={"file": ("patients.csv", csv_content, "text/csv")},
    )

    assert response.status_code == 422
    assert "missing required column" in response.json()["detail"].lower()


def test_predict_batch_csv_rejects_rules_without_zero_threshold(monkeypatch, test_settings):
    monkeypatch.setattr(app_main, "settings", test_settings)
    client = TestClient(app_main.app)
    csv_content = (
        "patient_first_name,patient_last_name,age,trestbps,chol,thalach,oldpeak,ca,sex,cp,fbs,restecg,exang,slope,thal\n"
        "Ada,Lovelace,58,132,224,173,3.2,2,Male,Asymptomatic,<=120,Normal ECG,Yes Ex Angina,Flat,Reversible Defect\n"
    )

    response = client.post(
        "/predict/batch-csv",
        files={"file": ("patients.csv", csv_content, "text/csv")},
        data={"risk_rules_json": '[{"threshold":0.3,"label":"Low"},{"threshold":0.7,"label":"High"}]'},
    )

    assert response.status_code == 422
    assert "One threshold must be 0" in response.json()["detail"]


def test_predict_batch_csv_rejects_out_of_range_numeric_value(monkeypatch, test_settings):
    monkeypatch.setattr(app_main, "settings", test_settings)
    client = TestClient(app_main.app)
    csv_content = (
        "patient_first_name,patient_last_name,age,trestbps,chol,thalach,oldpeak,ca,sex,cp,fbs,restecg,exang,slope,thal\n"
        "Ada,Lovelace,58,132,224,201,3.2,2,Male,Asymptomatic,<=120,Normal ECG,Yes Ex Angina,Flat,Reversible Defect\n"
    )

    response = client.post(
        "/predict/batch-csv",
        files={"file": ("patients.csv", csv_content, "text/csv")},
    )

    assert response.status_code == 422
    assert "Row 2" in response.json()["detail"]
    assert "thalach" in response.json()["detail"]


def test_predict_batch_csv_rejects_non_csv_upload(monkeypatch, test_settings):
    monkeypatch.setattr(app_main, "settings", test_settings)
    client = TestClient(app_main.app)

    response = client.post(
        "/predict/batch-csv",
        files={"file": ("patients.txt", "not,csv,data", "text/plain")},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Uploaded file must be a CSV."

