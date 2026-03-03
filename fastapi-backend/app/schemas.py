from __future__ import annotations

from enum import Enum
from typing import List

from pydantic import BaseModel, Field, model_validator


class APIModel(BaseModel):
    model_config = {"protected_namespaces": ()}


class Sex(str, Enum):
    female = "Female"
    male = "Male"


class ChestPainType(str, Enum):
    asymptomatic = "Asymptomatic"
    atypical_angina = "AtypicalAngina"
    atypical_angina_spaced = "Atypical Angina"
    non_anginal_pain = "NonAnginalPain"
    non_anginal_pain_spaced = "NonAnginal Pain"
    typical_angina = "TypicalAngina"
    typical_angina_spaced = "Typical Angina"


class FastingBloodSugar(str, Enum):
    less_or_equal_120 = "<=120"
    above_120 = ">120"


class RestingECG(str, Enum):
    lv_hypertrophy = "LVHypertrophy"
    lv_hypertrophy_spaced = "LV Hypertrophy"
    normal_ecg = "NormalECG"
    normal_ecg_spaced = "Normal ECG"
    stt_abnormality = "STTAbnormality"
    stt_abnormality_spaced = "ST-T Abnormality"


class ExerciseAngina(str, Enum):
    no_ex_angina = "NoExAngina"
    no_ex_angina_spaced = "No Ex Angina"
    yes_ex_angina = "YesExAngina"
    yes_ex_angina_spaced = "Yes Ex Angina"


class STSlope(str, Enum):
    downsloping = "Downsloping"
    flat = "Flat"
    upsloping = "Upsloping"


class Thalassemia(str, Enum):
    fixed_defect = "FixedDefect"
    fixed_defect_spaced = "Fixed Defect"
    normal = "Normal"
    reversible_defect = "ReversibleDefect"
    reversible_defect_spaced = "Reversible Defect"


class PredictionInput(APIModel):
    age: float = Field(..., ge=1, le=120)
    trestbps: float = Field(..., ge=50, le=250, description="Resting blood pressure")
    chol: float = Field(..., ge=50, le=700, description="Serum cholesterol")
    thalach: float = Field(..., ge=120, le=200, description="Maximum heart rate achieved")
    oldpeak: float = Field(..., ge=0, le=10, description="ST depression induced by exercise")
    ca: int = Field(..., ge=0, le=3, description="Number of major vessels")

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


class RiskRule(APIModel):
    threshold: float = Field(..., ge=0.0, le=1.0)
    label: str = Field(..., min_length=1, max_length=60)


class PredictionRequest(APIModel):
    clinical_inputs: PredictionInput
    risk_rules: List[RiskRule] | None = None

    @model_validator(mode="after")
    def validate_rule_set(self) -> "PredictionRequest":
        if not self.risk_rules:
            return self
        if len(self.risk_rules) < 2:
            raise ValueError("At least two rules are required.")
        seen: set[float] = set()
        has_zero_threshold = False
        for rule in self.risk_rules:
            key = round(rule.threshold, 10)
            if key in seen:
                raise ValueError("Threshold values must be unique.")
            seen.add(key)
            if abs(rule.threshold) <= 1e-10:
                has_zero_threshold = True
        if not has_zero_threshold:
            raise ValueError("One threshold must be 0.")
        return self


class PredictionResponse(APIModel):
    risk_probability: float
    risk_percent: float
    risk_label: str
    uncertainty_std: float
    uncertainty_percent: float
    confidence_interval_95: List[float]
    model_name: str
    training_source: str
    risk_rules: List[RiskRule]


class BatchPredictionRecord(APIModel):
    row_number: int
    patient_first_name: str | None = None
    patient_last_name: str | None = None
    clinical_inputs: PredictionInput
    prediction: PredictionResponse


class BatchPredictionResponse(APIModel):
    total_rows: int
    predictions: List[BatchPredictionRecord]


class HealthResponse(APIModel):
    status: str
    model_loaded: bool


class ModelInfoResponse(APIModel):
    model_name: str
    training_source: str
    selection_metrics: dict
    bootstrap_count: int
    feature_count: int
