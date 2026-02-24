from __future__ import annotations

import json

import numpy as np
import pytest

from backend.app.feature_encoding import (
    ENCODED_FEATURE_COLUMNS,
    _transform_numeric_features,
    encode_single_record,
    load_normalization_settings,
)


def _write_normalization_json(path, *, mean=None, scale=None):
    payload = {
        "mean": mean
        or {"age": 0, "trestbps": 0, "chol": 0, "thalach": 0, "oldpeak": 0, "ca": 0},
        "scale": scale
        or {"age": 1, "trestbps": 1, "chol": 1, "thalach": 1, "oldpeak": 1, "ca": 1},
    }
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_load_normalization_settings_missing_file(monkeypatch, tmp_path):
    missing_path = tmp_path / "missing.json"
    monkeypatch.setenv("NORMALIZATION_SETTINGS_PATH", str(missing_path))
    load_normalization_settings.cache_clear()

    with pytest.raises(FileNotFoundError):
        load_normalization_settings()


def test_load_normalization_settings_incomplete(monkeypatch, tmp_path):
    path = tmp_path / "norm.json"
    path.write_text(json.dumps({"mean": {"age": 0}, "scale": {"age": 1}}), encoding="utf-8")
    monkeypatch.setenv("NORMALIZATION_SETTINGS_PATH", str(path))
    load_normalization_settings.cache_clear()

    with pytest.raises(ValueError, match="Normalization settings are incomplete"):
        load_normalization_settings()


def test_encode_single_record_supports_alias_values(monkeypatch, tmp_path):
    path = tmp_path / "norm.json"
    _write_normalization_json(path)
    monkeypatch.setenv("NORMALIZATION_SETTINGS_PATH", str(path))
    load_normalization_settings.cache_clear()

    record = {
        "age": 58,
        "trestbps": 132,
        "chol": 224,
        "thalach": 173,
        "oldpeak": 3.2,
        "ca": 2,
        "sex": "Male",
        "cp": "Atypical Angina",
        "fbs": "<=120",
        "restecg": "Normal ECG",
        "exang": "Yes Ex Angina",
        "slope": "Flat",
        "thal": "Reversible Defect",
    }

    encoded_df = encode_single_record(record)
    row = encoded_df.iloc[0]

    assert list(encoded_df.columns) == ENCODED_FEATURE_COLUMNS
    assert row["cp_AtypicalAngina"] == 1.0
    assert row["restecg_NormalECG"] == 1.0
    assert row["exang_YesExAngina"] == 1.0
    assert row["thal_ReversibleDefect"] == 1.0
    assert row["oldpeak"] == pytest.approx(np.log1p(3.2))


def test_encode_single_record_rejects_unknown_category(monkeypatch, tmp_path):
    path = tmp_path / "norm.json"
    _write_normalization_json(path)
    monkeypatch.setenv("NORMALIZATION_SETTINGS_PATH", str(path))
    load_normalization_settings.cache_clear()

    record = {
        "age": 58,
        "trestbps": 132,
        "chol": 224,
        "thalach": 173,
        "oldpeak": 3.2,
        "ca": 2,
        "sex": "Male",
        "cp": "UnsupportedValue",
        "fbs": "<=120",
        "restecg": "NormalECG",
        "exang": "YesExAngina",
        "slope": "Flat",
        "thal": "ReversibleDefect",
    }

    with pytest.raises(ValueError, match="Unsupported category value for 'cp'"):
        encode_single_record(record)


def test_transform_numeric_features_rejects_zero_scale():
    settings = {
        "mean": {"age": 0, "trestbps": 0, "chol": 0, "thalach": 0, "oldpeak": 0, "ca": 0},
        "scale": {"age": 1, "trestbps": 1, "chol": 0, "thalach": 1, "oldpeak": 1, "ca": 1},
    }
    numeric = {"age": 10, "trestbps": 100, "chol": 200, "thalach": 150, "oldpeak": 1.0, "ca": 1}

    with pytest.raises(ValueError, match="Scale for feature 'chol' is 0"):
        _transform_numeric_features(numeric, settings)
