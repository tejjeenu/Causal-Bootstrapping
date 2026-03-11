from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Dict, List

import numpy as np
import pandas as pd

NUMERIC_FEATURES: List[str] = ["age", "trestbps", "chol", "thalach", "oldpeak", "ca"]
TARGET_COLUMN = "heartdiseasepresence"

CATEGORY_LEVELS: Dict[str, List[str]] = {
    "sex": ["Female", "Male"],
    "cp": ["Asymptomatic", "AtypicalAngina", "NonAnginalPain", "TypicalAngina"],
    "fbs": ["<=120", ">120"],
    "restecg": ["LVHypertrophy", "NormalECG", "STTAbnormality"],
    "exang": ["NoExAngina", "YesExAngina"],
    "slope": ["Downsloping", "Flat", "Upsloping"],
    "thal": ["FixedDefect", "Normal", "ReversibleDefect"],
}

CATEGORY_VALUE_ALIASES: Dict[str, Dict[str, str]] = {
    "cp": {
        "Typical Angina": "TypicalAngina",
        "Atypical Angina": "AtypicalAngina",
        "NonAnginal Pain": "NonAnginalPain",
    },
    "restecg": {
        "LV Hypertrophy": "LVHypertrophy",
        "Normal ECG": "NormalECG",
        "ST-T Abnormality": "STTAbnormality",
    },
    "exang": {
        "No Ex Angina": "NoExAngina",
        "Yes Ex Angina": "YesExAngina",
    },
    "thal": {
        "Fixed Defect": "FixedDefect",
        "Reversible Defect": "ReversibleDefect",
    },
}

ENCODED_FEATURE_COLUMNS: List[str] = [
    "age",
    "trestbps",
    "chol",
    "thalach",
    "oldpeak",
    "ca",
    "sex_Female",
    "sex_Male",
    "cp_Asymptomatic",
    "cp_AtypicalAngina",
    "cp_NonAnginalPain",
    "cp_TypicalAngina",
    "fbs_<=120",
    "fbs_>120",
    "restecg_LVHypertrophy",
    "restecg_NormalECG",
    "restecg_STTAbnormality",
    "exang_NoExAngina",
    "exang_YesExAngina",
    "slope_Downsloping",
    "slope_Flat",
    "slope_Upsloping",
    "thal_FixedDefect",
    "thal_Normal",
    "thal_ReversibleDefect",
]


def _resolve_normalization_settings_path() -> Path:
    repo_root = Path(__file__).resolve().parents[2]
    default_path = repo_root / "fastapi-backend" / "models" / "initial_eda_normalization_settings.json"
    configured_path = os.getenv("NORMALIZATION_SETTINGS_PATH")
    return Path(configured_path) if configured_path else default_path


@lru_cache(maxsize=1)
def load_normalization_settings() -> dict:
    path = _resolve_normalization_settings_path()
    if not path.exists():
        raise FileNotFoundError(
            f"Normalization settings file not found at '{path}'. "
            "Run the normalization export cell in `research/notebooks/initial EDA.ipynb` or provide NORMALIZATION_SETTINGS_PATH."
        )

    settings = json.loads(path.read_text(encoding="utf-8"))

    missing_mean = [feature for feature in NUMERIC_FEATURES if feature not in settings.get("mean", {})]
    missing_scale = [feature for feature in NUMERIC_FEATURES if feature not in settings.get("scale", {})]
    if missing_mean or missing_scale:
        raise ValueError(
            "Normalization settings are incomplete. Missing mean features: "
            f"{missing_mean}; missing scale features: {missing_scale}."
        )

    return settings


def _transform_numeric_features(raw_numeric: Dict[str, float], settings: dict) -> Dict[str, float]:
    transformed = dict(raw_numeric)

    # Match EDA preprocessing: oldpeak is log1p-transformed before scaling.
    transformed["oldpeak"] = float(np.log1p(transformed["oldpeak"]))

    means = settings["mean"]
    scales = settings["scale"]
    for feature in NUMERIC_FEATURES:
        scale = float(scales[feature])
        if scale == 0.0:
            raise ValueError(f"Scale for feature '{feature}' is 0. Cannot standardize this feature.")
        transformed[feature] = (float(transformed[feature]) - float(means[feature])) / scale

    return transformed


def encode_single_record(record: dict) -> pd.DataFrame:
    """Convert frontend payload to encoded + normalized model input."""
    normalization_settings = load_normalization_settings()
    encoded = {column: 0.0 for column in ENCODED_FEATURE_COLUMNS}

    raw_numeric = {feature: float(record[feature]) for feature in NUMERIC_FEATURES}
    transformed_numeric = _transform_numeric_features(raw_numeric, normalization_settings)
    for feature in NUMERIC_FEATURES:
        encoded[feature] = transformed_numeric[feature]

    for category_name, selected_value in (
        ("sex", record["sex"]),
        ("cp", record["cp"]),
        ("fbs", record["fbs"]),
        ("restecg", record["restecg"]),
        ("exang", record["exang"]),
        ("slope", record["slope"]),
        ("thal", record["thal"]),
    ):
        selected_value_str = str(getattr(selected_value, "value", selected_value))
        normalized_value = CATEGORY_VALUE_ALIASES.get(category_name, {}).get(
            selected_value_str, selected_value_str
        )
        encoded_column = f"{category_name}_{normalized_value}"
        if encoded_column not in encoded:
            raise ValueError(
                f"Unsupported category value for '{category_name}': '{selected_value_str}'. "
                f"Supported values: {CATEGORY_LEVELS[category_name]}."
            )
        encoded[encoded_column] = 1.0

    return pd.DataFrame([encoded], columns=ENCODED_FEATURE_COLUMNS)
