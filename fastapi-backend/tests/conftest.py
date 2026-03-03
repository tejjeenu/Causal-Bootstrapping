from __future__ import annotations

import pytest

from app import config, feature_encoding, model_store
from app.config import Settings


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
        cors_origins=("http://localhost:5173",),
        inference_cache_size=512,
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

