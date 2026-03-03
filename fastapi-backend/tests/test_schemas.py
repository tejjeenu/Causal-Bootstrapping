from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas import PredictionRequest


def test_prediction_request_rejects_duplicate_custom_thresholds(prediction_payload):
    with pytest.raises(ValidationError, match="Threshold values must be unique"):
        PredictionRequest(
            clinical_inputs=prediction_payload,
            risk_rules=[
                {"threshold": 0.2, "label": "Low"},
                {"threshold": 0.20000000001, "label": "Medium"},
            ],
        )


def test_prediction_request_requires_zero_threshold(prediction_payload):
    with pytest.raises(ValidationError, match="One threshold must be 0"):
        PredictionRequest(
            clinical_inputs=prediction_payload,
            risk_rules=[
                {"threshold": 0.2, "label": "Low"},
                {"threshold": 0.6, "label": "High"},
            ],
        )


def test_prediction_request_requires_at_least_two_rules(prediction_payload):
    with pytest.raises(ValidationError, match="At least two rules are required"):
        PredictionRequest(
            clinical_inputs=prediction_payload,
            risk_rules=[
                {"threshold": 0.0, "label": "Low"},
            ],
        )

