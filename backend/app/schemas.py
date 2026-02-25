from __future__ import annotations

from enum import Enum
from typing import List

from pydantic import BaseModel, Field, field_validator, model_validator


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
        seen: set[float] = set()
        for rule in self.risk_rules:
            key = round(rule.threshold, 10)
            if key in seen:
                raise ValueError("Threshold values must be unique.")
            seen.add(key)
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


class HealthResponse(APIModel):
    status: str
    model_loaded: bool


class ModelInfoResponse(APIModel):
    model_name: str
    training_source: str
    selection_metrics: dict
    bootstrap_count: int
    feature_count: int


class AuthCredentials(APIModel):
    email: str = Field(..., min_length=5, max_length=254)
    password: str = Field(..., min_length=6, max_length=128)


class AuthUser(APIModel):
    id: str
    email: str | None = None


class AuthSessionResponse(APIModel):
    authenticated: bool
    user: AuthUser | None = None
    email_confirmation_required: bool = False


class MessageResponse(APIModel):
    detail: str


class RiskClassificationRulesUpsertRequest(APIModel):
    rules: List[RiskRule] = Field(..., min_length=1, max_length=20)

    @model_validator(mode="after")
    def validate_rule_set(self) -> "RiskClassificationRulesUpsertRequest":
        seen: set[float] = set()
        for rule in self.rules:
            key = round(rule.threshold, 10)
            if key in seen:
                raise ValueError("Threshold values must be unique.")
            seen.add(key)
        return self


class RiskClassificationSettingsResponse(APIModel):
    rules: List[RiskRule]


class SavePredictionRequest(APIModel):
    patient_first_name: str = Field(..., min_length=1, max_length=80)
    patient_last_name: str = Field(..., min_length=1, max_length=80)
    clinical_inputs: PredictionInput

    @field_validator("patient_first_name", "patient_last_name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Name cannot be empty.")
        return normalized


class SavedPredictionRecord(APIModel):
    id: str
    created_at: str
    patient_first_name: str
    patient_last_name: str
    clinical_inputs: dict
    risk_probability: float
    risk_percent: float
    risk_label: str
    uncertainty_std: float
    uncertainty_percent: float
    confidence_interval_95: List[float]


class SavedPredictionListResponse(APIModel):
    results: List[SavedPredictionRecord]
