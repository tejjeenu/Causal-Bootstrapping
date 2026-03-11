from __future__ import annotations

import argparse
from pathlib import Path

import joblib
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import average_precision_score, brier_score_loss, log_loss, roc_auc_score
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

TARGET_COLUMN = "heartdiseasepresence"
SEED = 42
DEFAULT_PARAMS = {
    "n_estimators": 100,
    "max_depth": 3,
    "learning_rate": 0.2,
    "subsample": 1.0,
    "colsample_bytree": 1.0,
    "objective": "binary:logistic",
    "eval_metric": "logloss",
    "random_state": SEED,
    "n_jobs": 1,
}
TUNED_PARAM_KEYS = ("colsample_bytree", "learning_rate", "max_depth", "n_estimators", "subsample")


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _artifact_paths() -> tuple[Path, Path]:
    backend_root = Path(__file__).resolve().parents[1]
    models_dir = backend_root / "models"
    return models_dir / "xgboost_backdoor_best_artifact.joblib", models_dir / "xgboost_backdoor_model.joblib"


def _build_base_estimator(params: dict) -> XGBClassifier:
    final_params = dict(DEFAULT_PARAMS)
    final_params.update(params)
    return XGBClassifier(**final_params)


def _evaluate_probabilities(y_true, probabilities) -> dict:
    return {
        "roc_auc": round(float(roc_auc_score(y_true, probabilities)), 6),
        "pr_auc": round(float(average_precision_score(y_true, probabilities)), 6),
        "brier": round(float(brier_score_loss(y_true, probabilities)), 6),
        "log_loss": round(float(log_loss(y_true, probabilities, labels=[0, 1])), 6),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a sigmoid-calibrated XGBoost inference artifact.")
    parser.add_argument(
        "--dataset",
        default=str(_repo_root() / "research" / "data" / "heart_disease_preprocessed_backdoor.csv"),
        help="Encoded training dataset with target column.",
    )
    parser.add_argument("--calibration-method", default="sigmoid", choices=("sigmoid", "isotonic"))
    parser.add_argument("--cv-folds", type=int, default=5)
    parser.add_argument("--test-size", type=float, default=0.2)
    args = parser.parse_args()

    dataset_path = Path(args.dataset)
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset not found at '{dataset_path}'.")

    artifact_path, compatibility_path = _artifact_paths()
    prior_metrics = {}
    best_params = {}
    if artifact_path.exists():
        existing = joblib.load(artifact_path)
        if isinstance(existing, dict):
            prior_metrics = dict(existing.get("selection_metrics", {}))
            best_params = dict(prior_metrics.get("best_params", {}))

    frame = pd.read_csv(dataset_path)
    if TARGET_COLUMN not in frame.columns:
        raise ValueError(f"Dataset must contain '{TARGET_COLUMN}'.")

    X_frame = frame.drop(columns=[TARGET_COLUMN])
    y = frame[TARGET_COLUMN].astype(int)
    feature_columns = list(X_frame.columns)
    X = X_frame.to_numpy(dtype=float)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=args.test_size,
        random_state=SEED,
        stratify=y,
    )

    raw_holdout_model = _build_base_estimator(best_params)
    raw_holdout_model.fit(X_train, y_train)
    raw_holdout_probs = raw_holdout_model.predict_proba(X_test)[:, 1]
    raw_holdout_metrics = _evaluate_probabilities(y_test, raw_holdout_probs)

    calibrated_holdout_model = CalibratedClassifierCV(
        estimator=_build_base_estimator(best_params),
        method=args.calibration_method,
        cv=args.cv_folds,
    )
    calibrated_holdout_model.fit(X_train, y_train)
    calibrated_holdout_probs = calibrated_holdout_model.predict_proba(X_test)[:, 1]
    calibrated_holdout_metrics = _evaluate_probabilities(y_test, calibrated_holdout_probs)

    final_model = CalibratedClassifierCV(
        estimator=_build_base_estimator(best_params),
        method=args.calibration_method,
        cv=args.cv_folds,
    )
    final_model.fit(X, y)
    raw_full_model = _build_base_estimator(best_params)
    raw_full_model.fit(X, y)

    selection_metrics = dict(prior_metrics)
    selection_metrics.update(
        {
            "model_family": "XGBoost",
            "tuning_dataset": dataset_path.name,
            "best_params": {
                key: _build_base_estimator(best_params).get_params()[key]
                for key in TUNED_PARAM_KEYS
            },
            "holdout": calibrated_holdout_metrics,
            "holdout_uncalibrated": raw_holdout_metrics,
            "probability_calibration": {
                "enabled": True,
                "method": args.calibration_method,
                "cv_folds": args.cv_folds,
                "test_size": args.test_size,
                "random_state": SEED,
            },
        }
    )

    artifact = {
        "model": final_model,
        "bootstrap_models": [],
        "model_name": f"XGBoost ({args.calibration_method}-calibrated)",
        "training_source": dataset_path.name,
        "feature_columns": feature_columns,
        "selection_metrics": selection_metrics,
    }

    artifact_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, artifact_path)
    joblib.dump(raw_full_model, compatibility_path)

    print(f"Saved calibrated FastAPI artifact: {artifact_path}")
    print(f"Saved compatibility model: {compatibility_path}")
    print(f"Raw holdout metrics: {raw_holdout_metrics}")
    print(f"Calibrated holdout metrics: {calibrated_holdout_metrics}")


if __name__ == "__main__":
    main()
