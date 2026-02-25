package com.causalbootstrapping.crud.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;

public record SavedPredictionRecord(
    String id,
    @JsonProperty("created_at") String createdAt,
    @JsonProperty("patient_first_name") String patientFirstName,
    @JsonProperty("patient_last_name") String patientLastName,
    @JsonProperty("clinical_inputs") Map<String, Object> clinicalInputs,
    @JsonProperty("risk_probability") double riskProbability,
    @JsonProperty("risk_percent") double riskPercent,
    @JsonProperty("risk_label") String riskLabel,
    @JsonProperty("uncertainty_std") double uncertaintyStd,
    @JsonProperty("uncertainty_percent") double uncertaintyPercent,
    @JsonProperty("confidence_interval_95") List<Double> confidenceInterval95
) {
}
