package com.causalbootstrapping.crud.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;

public record PredictionResultUpdateRequest(
    @JsonProperty("patient_first_name") @Size(max = 80) String patientFirstName,
    @JsonProperty("patient_last_name") @Size(max = 80) String patientLastName,
    @JsonProperty("clinical_inputs") Map<String, Object> clinicalInputs,
    @JsonProperty("risk_probability") Double riskProbability,
    @JsonProperty("risk_percent") Double riskPercent,
    @JsonProperty("risk_label") @Size(max = 60) String riskLabel,
    @JsonProperty("uncertainty_std") Double uncertaintyStd,
    @JsonProperty("uncertainty_percent") Double uncertaintyPercent,
    @JsonProperty("confidence_interval_95") List<Double> confidenceInterval95
) {
}
