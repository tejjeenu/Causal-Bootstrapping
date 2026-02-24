from __future__ import annotations

import pytest

from backend.app import config, feature_encoding, model_store
from backend.app.config import Settings


@pytest.fixture(autouse=True)
def clear_module_caches():
    config.get_settings.cache_clear()
    feature_encoding.load_normalization_settings.cache_clear()
    model_store.load_model_bundle.cache_clear()
    yield
    config.get_settings.cache_clear()
    feature_encoding.load_normalization_settings.cache_clear()
    model_store.load_model_bundle.cache_clear()


@pytest.fixture
def test_settings() -> Settings:
    return Settings(
        supabase_url="https://example.supabase.co",
        supabase_anon_key="anon-key",
        supabase_results_table="prediction_results",
        supabase_risk_settings_table="risk_classification_settings",
        auth_cookie_name="cb_auth_token",
        auth_cookie_secure=False,
        auth_cookie_samesite="lax",
        cors_origins=("http://localhost:5173",),
    )


@pytest.fixture
def prediction_payload() -> dict:
    return {
        "age": 58,
        "trestbps": 132,
        "chol": 224,
        "thalach": 173,
        "oldpeak": 3.2,
        "ca": 2,
        "sex": "Male",
        "cp": "Asymptomatic",
        "fbs": "<=120",
        "restecg": "Normal ECG",
        "exang": "Yes Ex Angina",
        "slope": "Flat",
        "thal": "Reversible Defect",
    }


@pytest.fixture
def save_payload(prediction_payload: dict) -> dict:
    return {
        "patient_first_name": "Ada",
        "patient_last_name": "Lovelace",
        "clinical_inputs": prediction_payload,
    }
