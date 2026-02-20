from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, List

import joblib
import numpy as np
import pandas as pd


@dataclass
class ModelBundle:
    model: Any
    bootstrap_models: List[Any]
    model_name: str
    training_source: str
    feature_columns: List[str]
    selection_metrics: dict


def _resolve_artifact_path() -> Path:
    repo_root = Path(__file__).resolve().parents[2]
    default_path = repo_root / "backend" / "models" / "best_deconfounded_model.joblib"
    configured_path = os.getenv("MODEL_ARTIFACT_PATH")
    return Path(configured_path) if configured_path else default_path


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
            f"Model artifact not found at '{artifact_path}'. "
            "Run `python backend/train_best_deconfounded_model.py` first."
        )

    artifact = joblib.load(artifact_path)

    return ModelBundle(
        model=artifact["model"],
        bootstrap_models=list(artifact.get("bootstrap_models", [])),
        model_name=artifact.get("model_name", artifact["model"].__class__.__name__),
        training_source=artifact.get("training_source", "unknown"),
        feature_columns=list(artifact.get("feature_columns", [])),
        selection_metrics=dict(artifact.get("selection_metrics", {})),
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
    return float(base_probability), 0.0
