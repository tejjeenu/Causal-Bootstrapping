from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
import pytest

from backend.app.model_store import (
    ModelBundle,
    _estimate_input_jitter_uncertainty,
    _predict_proba,
    load_model_bundle,
    predict_with_uncertainty,
)


def _features():
    return pd.DataFrame(
        [
            {
                "age": 58.0,
                "trestbps": 132.0,
                "chol": 224.0,
                "thalach": 173.0,
                "oldpeak": 1.2,
                "ca": 2.0,
            }
        ]
    )


@dataclass
class DummyProbaModel:
    probability: float

    def predict_proba(self, _input):
        return np.array([[1.0 - self.probability, self.probability]], dtype=float)


class DummyDecisionModel:
    def decision_function(self, _input):
        return np.array([0.0], dtype=float)


class DummyPredictOnlyModel:
    def predict(self, _input):
        return np.array([0.7], dtype=float)


def test_predict_proba_uses_predict_proba():
    model = DummyProbaModel(0.8)
    assert _predict_proba(model, _features()) == pytest.approx(0.8)


def test_predict_proba_uses_decision_function_when_needed():
    model = DummyDecisionModel()
    assert _predict_proba(model, _features()) == pytest.approx(0.5)


def test_predict_proba_falls_back_to_predict():
    model = DummyPredictOnlyModel()
    assert _predict_proba(model, _features()) == pytest.approx(0.7)


def test_predict_with_uncertainty_uses_bootstrap_models():
    bundle = ModelBundle(
        model=DummyProbaModel(0.1),
        bootstrap_models=[DummyProbaModel(0.2), DummyProbaModel(0.4)],
        model_name="x",
        training_source="y",
        feature_columns=[],
        selection_metrics={},
    )

    mean_probability, uncertainty_std = predict_with_uncertainty(bundle, _features())
    assert mean_probability == pytest.approx(0.3)
    assert uncertainty_std == pytest.approx(0.1)


def test_predict_with_uncertainty_uses_estimators_for_forests():
    class DummyForest:
        def __init__(self):
            self.estimators_ = [DummyProbaModel(0.2), DummyProbaModel(0.6)]

        def predict_proba(self, _input):
            return np.array([[0.6, 0.4]], dtype=float)

    bundle = ModelBundle(
        model=DummyForest(),
        bootstrap_models=[],
        model_name="forest",
        training_source="artifact",
        feature_columns=[],
        selection_metrics={},
    )

    mean_probability, uncertainty_std = predict_with_uncertainty(bundle, _features())
    assert mean_probability == pytest.approx(0.4)
    assert uncertainty_std == pytest.approx(0.2)


def test_estimate_input_jitter_uncertainty_returns_zero_without_numeric_columns():
    features = pd.DataFrame([{"only_category": 1.0}])
    assert _estimate_input_jitter_uncertainty(DummyProbaModel(0.5), features) == pytest.approx(0.0)


def test_predict_with_uncertainty_uses_binomial_fallback_when_jitter_zero(monkeypatch):
    bundle = ModelBundle(
        model=DummyProbaModel(0.8),
        bootstrap_models=[],
        model_name="x",
        training_source="y",
        feature_columns=[],
        selection_metrics={},
    )
    monkeypatch.setattr("backend.app.model_store._estimate_input_jitter_uncertainty", lambda *_args, **_kwargs: 0.0)

    mean_probability, uncertainty_std = predict_with_uncertainty(bundle, _features())
    assert mean_probability == pytest.approx(0.8)
    assert uncertainty_std == pytest.approx(np.sqrt(0.8 * 0.2))


def test_load_model_bundle_raises_when_artifact_missing(monkeypatch, tmp_path):
    missing_path = tmp_path / "missing.joblib"
    monkeypatch.setenv("MODEL_ARTIFACT_PATH", str(missing_path))
    load_model_bundle.cache_clear()

    with pytest.raises(FileNotFoundError):
        load_model_bundle()


def test_load_model_bundle_supports_dict_artifact(monkeypatch, tmp_path):
    path = tmp_path / "artifact.joblib"
    path.write_text("placeholder", encoding="utf-8")
    monkeypatch.setenv("MODEL_ARTIFACT_PATH", str(path))

    artifact = {
        "model": DummyProbaModel(0.9),
        "bootstrap_models": [DummyProbaModel(0.8)],
        "model_name": "MockModel",
        "training_source": "train.csv",
        "feature_columns": ["f1", "f2"],
        "selection_metrics": {"auc": 0.9},
    }
    monkeypatch.setattr("backend.app.model_store.joblib.load", lambda _path: artifact)
    load_model_bundle.cache_clear()

    bundle = load_model_bundle()
    assert bundle.model_name == "MockModel"
    assert bundle.training_source == "train.csv"
    assert bundle.feature_columns == ["f1", "f2"]
    assert bundle.selection_metrics == {"auc": 0.9}
    assert len(bundle.bootstrap_models) == 1
