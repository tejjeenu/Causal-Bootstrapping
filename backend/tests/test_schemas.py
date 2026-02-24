from __future__ import annotations

import pytest
from pydantic import ValidationError

from backend.app.schemas import RiskClassificationRulesUpsertRequest, SavePredictionRequest


def test_save_prediction_request_strips_patient_names(prediction_payload):
    payload = SavePredictionRequest(
        patient_first_name="  Ada  ",
        patient_last_name="  Lovelace ",
        clinical_inputs=prediction_payload,
    )

    assert payload.patient_first_name == "Ada"
    assert payload.patient_last_name == "Lovelace"


def test_save_prediction_request_rejects_blank_names(prediction_payload):
    with pytest.raises(ValidationError, match="Name cannot be empty"):
        SavePredictionRequest(
            patient_first_name="   ",
            patient_last_name="Lovelace",
            clinical_inputs=prediction_payload,
        )


def test_risk_rule_upsert_rejects_duplicate_thresholds():
    with pytest.raises(ValidationError, match="Threshold values must be unique"):
        RiskClassificationRulesUpsertRequest(
            rules=[
                {"threshold": 0.3, "label": "Low"},
                {"threshold": 0.30000000001, "label": "Medium"},
            ]
        )
