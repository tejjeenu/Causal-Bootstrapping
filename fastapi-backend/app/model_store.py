from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, List

import joblib
import numpy as np
import pandas as pd
from dotenv import load_dotenv

from .feature_encoding import NUMERIC_FEATURES

JITTER_STD = 0.05
JITTER_SAMPLES = 40
JITTER_SEED = 42
_BACKEND_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(_BACKEND_ROOT / ".env")


@dataclass
class ModelBundle:
    model: Any
    bootstrap_models: List[Any]
    model_name: str
    training_source: str
    feature_columns: List[str]
    selection_metrics: dict


def _resolve_artifact_path() -> Path:
    configured_path = os.getenv("MODEL_ARTIFACT_PATH")
    if not configured_path:
        raise ValueError("MODEL_ARTIFACT_PATH is required and must point to a single model artifact file.")
    return Path(configured_path)


def _predict_proba(model: Any, features: pd.DataFrame) -> float:
    input_data: Any = features if hasattr(model, "feature_names_in_") else features.to_numpy()

    if hasattr(model, "predict_proba"):
        return float(model.predict_proba(input_data)[0, 1])

    if hasattr(model, "decision_function"):
        score = float(model.decision_function(input_data)[0])
        return float(1.0 / (1.0 + np.exp(-score)))

    prediction = float(model.predict(input_data)[0])
    return prediction


@lru_cache(maxsize=1)
def load_model_bundle() -> ModelBundle:
    artifact_path = _resolve_artifact_path()
    if not artifact_path.exists():
        raise FileNotFoundError(
            f"Model artifact not found at '{artifact_path}'. Set MODEL_ARTIFACT_PATH to a valid model file."
        )

    artifact = joblib.load(artifact_path)
    if isinstance(artifact, dict) and "model" in artifact:
        model = artifact["model"]
        bootstrap_models = list(artifact.get("bootstrap_models", []))
        model_name = artifact.get("model_name", model.__class__.__name__)
        training_source = artifact.get("training_source", artifact_path.name)
        feature_columns = list(artifact.get("feature_columns", []))
        selection_metrics = dict(artifact.get("selection_metrics", {}))
    else:
        model = artifact
        bootstrap_models = []
        model_name = model.__class__.__name__
        training_source = artifact_path.name
        feature_columns = list(getattr(model, "feature_names_in_", []))
        selection_metrics = {}

    return ModelBundle(
        model=model,
        bootstrap_models=bootstrap_models,
        model_name=model_name,
        training_source=training_source,
        feature_columns=feature_columns,
        selection_metrics=selection_metrics,
    )


def predict_with_uncertainty(bundle: ModelBundle, features: pd.DataFrame) -> tuple[float, float]:
    if bundle.bootstrap_models:
        samples = np.array([_predict_proba(model, features) for model in bundle.bootstrap_models], dtype=float)
        mean_probability = float(np.mean(samples))
        uncertainty_std = float(np.std(samples, ddof=0))
        return mean_probability, uncertainty_std

    if hasattr(bundle.model, "estimators_") and hasattr(bundle.model, "predict_proba"):
        tree_probs = []
        for estimator in bundle.model.estimators_:
            prob = _predict_proba(estimator, features)
            tree_probs.append(prob)

        if tree_probs:
            tree_probs_np = np.array(tree_probs, dtype=float)
            return float(np.mean(tree_probs_np)), float(np.std(tree_probs_np, ddof=0))

    base_probability = _predict_proba(bundle.model, features)
    jitter_std = _estimate_input_jitter_uncertainty(bundle.model, features)
    if jitter_std > 0.0:
        return float(base_probability), float(jitter_std)

    return float(base_probability), float(np.sqrt(max(base_probability * (1.0 - base_probability), 0.0)))


def _estimate_input_jitter_uncertainty(model: Any, features: pd.DataFrame) -> float:
    """Approximate uncertainty for single deterministic models via local input perturbation."""
    numeric_cols_present = [col for col in NUMERIC_FEATURES if col in features.columns]
    if not numeric_cols_present:
        return 0.0

    rng = np.random.default_rng(JITTER_SEED)
    sample_probs = []

    for _ in range(JITTER_SAMPLES):
        perturbed = features.copy()
        current = perturbed.loc[:, numeric_cols_present].to_numpy(dtype=float, copy=True)
        noise = rng.normal(0.0, JITTER_STD, size=current.shape)
        perturbed.loc[:, numeric_cols_present] = current + noise
        sample_probs.append(_predict_proba(model, perturbed))

    if not sample_probs:
        return 0.0

    return float(np.std(np.array(sample_probs, dtype=float), ddof=0))
