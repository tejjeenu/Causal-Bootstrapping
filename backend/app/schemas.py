from __future__ import annotations

from enum import Enum
from typing import List

from pydantic import BaseModel, Field


class APIModel(BaseModel):
    model_config = {"protected_namespaces": ()}


class Sex(str, Enum):
    female = "Female"
    male = "Male"


class ChestPainType(str, Enum):
    asymptomatic = "Asymptomatic"
    atypical_angina = "AtypicalAngina"
    non_anginal_pain = "NonAnginalPain"
    typical_angina = "TypicalAngina"


class FastingBloodSugar(str, Enum):
    less_or_equal_120 = "<=120"
    above_120 = ">120"


class RestingECG(str, Enum):
    lv_hypertrophy = "LVHypertrophy"
    normal_ecg = "NormalECG"
    stt_abnormality = "STTAbnormality"


class ExerciseAngina(str, Enum):
    no_ex_angina = "NoExAngina"
    yes_ex_angina = "YesExAngina"


class STSlope(str, Enum):
    downsloping = "Downsloping"
    flat = "Flat"
    upsloping = "Upsloping"


class Thalassemia(str, Enum):
    fixed_defect = "FixedDefect"
    normal = "Normal"
    reversible_defect = "ReversibleDefect"


class PredictionInput(APIModel):
    age: float = Field(..., ge=1, le=120)
    trestbps: float = Field(..., ge=50, le=250, description="Resting blood pressure")
    chol: float = Field(..., ge=50, le=700, description="Serum cholesterol")
    thalach: float = Field(..., ge=50, le=250, description="Maximum heart rate achieved")
    oldpeak: float = Field(..., ge=0, le=10, description="ST depression induced by exercise")
    ca: float = Field(..., ge=0, le=4, description="Number of major vessels")

    sex: Sex
    cp: ChestPainType
    fbs: FastingBloodSugar
    restecg: RestingECG
    exang: ExerciseAngina
    slope: STSlope
    thal: Thalassemia

    model_config = {
        "protected_namespaces": (),
        "json_schema_extra": {
            "example": {
                "age": 58,
                "trestbps": 132,
                "chol": 224,
                "thalach": 173,
                "oldpeak": 3.2,
                "ca": 2,
                "sex": "Male",
                "cp": "Asymptomatic",
                "fbs": "<=120",
                "restecg": "NormalECG",
                "exang": "YesExAngina",
                "slope": "Flat",
                "thal": "ReversibleDefect",
            }
        }
    }


class PredictionResponse(APIModel):
    risk_probability: float
    risk_percent: float
    risk_label: str
    uncertainty_std: float
    uncertainty_percent: float
    confidence_interval_95: List[float]
    model_name: str
    training_source: str


class HealthResponse(APIModel):
    status: str
    model_loaded: bool


class ModelInfoResponse(APIModel):
    model_name: str
    training_source: str
    selection_metrics: dict
    bootstrap_count: int
    feature_count: int
