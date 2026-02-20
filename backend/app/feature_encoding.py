from __future__ import annotations

from typing import Dict, List

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


def encode_single_record(record: dict) -> pd.DataFrame:
    """Convert user-friendly categorical input to one-hot encoded model input."""
    encoded = {column: 0.0 for column in ENCODED_FEATURE_COLUMNS}

    for feature in NUMERIC_FEATURES:
        encoded[feature] = float(record[feature])

    for category_name, selected_value in (
        ("sex", record["sex"]),
        ("cp", record["cp"]),
        ("fbs", record["fbs"]),
        ("restecg", record["restecg"]),
        ("exang", record["exang"]),
        ("slope", record["slope"]),
        ("thal", record["thal"]),
    ):
        encoded[f"{category_name}_{selected_value}"] = 1.0

    return pd.DataFrame([encoded], columns=ENCODED_FEATURE_COLUMNS)

