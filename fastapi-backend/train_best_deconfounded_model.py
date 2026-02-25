from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    brier_score_loss,
    log_loss,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPClassifier
from sklearn.svm import SVC

from app.feature_encoding import ENCODED_FEATURE_COLUMNS, TARGET_COLUMN

RANDOM_SEED = 42
TEST_SIZE = 0.2


def _make_candidate_models() -> Dict[str, Any]:
    return {
        "LogisticRegression": LogisticRegression(max_iter=4000, random_state=RANDOM_SEED),
        "RandomForestClassifier": RandomForestClassifier(
            n_estimators=150,
            random_state=RANDOM_SEED,
            n_jobs=-1,
            class_weight="balanced_subsample",
        ),
        "SVC": SVC(probability=True, random_state=RANDOM_SEED, C=2.0, gamma="scale"),
        "MLPClassifier": MLPClassifier(
            hidden_layer_sizes=(32, 16),
            max_iter=1200,
            random_state=RANDOM_SEED,
            early_stopping=True,
        ),
    }


def _safe_predict_proba(model: Any, x_eval: pd.DataFrame) -> np.ndarray:
    if hasattr(model, "predict_proba"):
        return model.predict_proba(x_eval)[:, 1]

    if hasattr(model, "decision_function"):
        scores = model.decision_function(x_eval)
        return 1.0 / (1.0 + np.exp(-scores))

    return model.predict(x_eval).astype(float)


def _evaluate_model(
    model: Any,
    x_train: pd.DataFrame,
    y_train: pd.Series,
    x_eval: pd.DataFrame,
    y_eval: pd.Series,
) -> Dict[str, float]:
    fitted = clone(model).fit(x_train, y_train)
    y_prob = _safe_predict_proba(fitted, x_eval)
    y_pred = (y_prob >= 0.5).astype(int)

    return {
        "accuracy": float(accuracy_score(y_eval, y_pred)),
        "roc_auc": float(roc_auc_score(y_eval, y_prob)),
        "pr_auc": float(average_precision_score(y_eval, y_prob)),
        "brier": float(brier_score_loss(y_eval, y_prob)),
        "log_loss": float(log_loss(y_eval, y_prob, labels=[0, 1])),
    }


def _select_best_result(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    return sorted(
        results,
        key=lambda row: (
            -row["accuracy"],
            -row["roc_auc"],
            -row["pr_auc"],
            row["brier"],
            row["log_loss"],
        ),
    )[0]


def _train_bootstrap_ensemble(
    model_template: Any, x_train: pd.DataFrame, y_train: pd.Series, n_bootstrap: int
) -> List[Any]:
    if n_bootstrap <= 0:
        return []

    rng = np.random.default_rng(RANDOM_SEED)
    n_rows = len(x_train)
    models: List[Any] = []

    for _ in range(n_bootstrap):
        sampled_idx = rng.choice(n_rows, size=n_rows, replace=True)
        x_sample = x_train.iloc[sampled_idx]
        y_sample = y_train.iloc[sampled_idx]
        model = clone(model_template)
        model.fit(x_sample, y_sample)
        models.append(model)

    return models


def run_training(n_bootstrap: int) -> Tuple[Path, Dict[str, Any]]:
    repo_root = Path(__file__).resolve().parents[1]
    confounded_path = repo_root / "heart_disease_preprocessed.csv"
    deconfounded_paths = [
        repo_root / "heart_disease_preprocessed_backdoor.csv",
        repo_root / "heart_disease_preprocessed_tf.csv",
    ]

    if not confounded_path.exists():
        raise FileNotFoundError(f"Missing confounded dataset: {confounded_path}")

    missing_deconf = [path for path in deconfounded_paths if not path.exists()]
    if missing_deconf:
        raise FileNotFoundError(
            "Missing deconfounded datasets: " + ", ".join(str(path) for path in missing_deconf)
        )

    conf_df = pd.read_csv(confounded_path)[ENCODED_FEATURE_COLUMNS + [TARGET_COLUMN]]
    _, conf_test = train_test_split(
        conf_df,
        test_size=TEST_SIZE,
        random_state=RANDOM_SEED,
        stratify=conf_df[TARGET_COLUMN],
    )
    x_conf_test = conf_test[ENCODED_FEATURE_COLUMNS]
    y_conf_test = conf_test[TARGET_COLUMN]

    candidate_models = _make_candidate_models()
    evaluation_rows: List[Dict[str, Any]] = []

    for deconf_path in deconfounded_paths:
        deconf_df = pd.read_csv(deconf_path)[ENCODED_FEATURE_COLUMNS + [TARGET_COLUMN]]
        deconf_train, _ = train_test_split(
            deconf_df,
            test_size=TEST_SIZE,
            random_state=RANDOM_SEED,
            stratify=deconf_df[TARGET_COLUMN],
        )
        x_train = deconf_train[ENCODED_FEATURE_COLUMNS]
        y_train = deconf_train[TARGET_COLUMN]

        for model_name, model in candidate_models.items():
            metrics = _evaluate_model(model, x_train, y_train, x_conf_test, y_conf_test)
            evaluation_rows.append(
                {
                    "model_name": model_name,
                    "training_source": deconf_path.name,
                    **metrics,
                }
            )

    best = _select_best_result(evaluation_rows)
    best_model_template = candidate_models[best["model_name"]]
    best_training_path = repo_root / best["training_source"]
    full_train_df = pd.read_csv(best_training_path)[ENCODED_FEATURE_COLUMNS + [TARGET_COLUMN]]
    x_full = full_train_df[ENCODED_FEATURE_COLUMNS]
    y_full = full_train_df[TARGET_COLUMN]

    final_model = clone(best_model_template).fit(x_full, y_full)
    bootstrap_models = _train_bootstrap_ensemble(best_model_template, x_full, y_full, n_bootstrap)

    artifact = {
        "model": final_model,
        "bootstrap_models": bootstrap_models,
        "feature_columns": ENCODED_FEATURE_COLUMNS,
        "target_column": TARGET_COLUMN,
        "model_name": best["model_name"],
        "training_source": best["training_source"],
        "selection_metrics": {
            "accuracy": round(best["accuracy"], 6),
            "roc_auc": round(best["roc_auc"], 6),
            "pr_auc": round(best["pr_auc"], 6),
            "brier": round(best["brier"], 6),
            "log_loss": round(best["log_loss"], 6),
        },
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "bootstrap_count": n_bootstrap,
        "selection_table": evaluation_rows,
    }

    model_dir = repo_root / "fastapi-backend" / "models"
    model_dir.mkdir(parents=True, exist_ok=True)
    model_path = model_dir / "best_deconfounded_model.joblib"
    joblib.dump(artifact, model_path)
    return model_path, artifact


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Train candidate models on deconfounded data, choose the most accurate one "
            "against confounded holdout, and save the model artifact for FastAPI."
        )
    )
    parser.add_argument(
        "--bootstrap-count",
        type=int,
        default=10,
        help="Number of bootstrap models used for uncertainty estimation.",
    )
    args = parser.parse_args()

    path, artifact = run_training(n_bootstrap=args.bootstrap_count)

    print(f"Saved model artifact: {path}")
    print("Best model summary:")
    print(
        json.dumps(
            {
                "model_name": artifact["model_name"],
                "training_source": artifact["training_source"],
                "selection_metrics": artifact["selection_metrics"],
                "bootstrap_count": artifact["bootstrap_count"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
