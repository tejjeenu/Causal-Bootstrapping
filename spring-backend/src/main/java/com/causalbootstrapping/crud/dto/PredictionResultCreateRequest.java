package com.causalbootstrapping.crud.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;

public record PredictionResultCreateRequest(
    @JsonProperty("patient_first_name") @NotBlank @Size(max = 80) String patientFirstName,
    @JsonProperty("patient_last_name") @NotBlank @Size(max = 80) String patientLastName,
    @JsonProperty("clinical_inputs") @NotNull Map<String, Object> clinicalInputs,
    @JsonProperty("risk_probability") @NotNull Double riskProbability,
    @JsonProperty("risk_percent") @NotNull Double riskPercent,
    @JsonProperty("risk_label") @NotBlank @Size(max = 60) String riskLabel,
    @JsonProperty("uncertainty_std") @NotNull Double uncertaintyStd,
    @JsonProperty("uncertainty_percent") @NotNull Double uncertaintyPercent,
    @JsonProperty("confidence_interval_95") @NotNull List<Double> confidenceInterval95
) {
}
