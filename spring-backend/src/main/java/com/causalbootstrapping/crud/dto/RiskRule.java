package com.causalbootstrapping.crud.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RiskRule(
    @DecimalMin(value = "0.0") @DecimalMax(value = "1.0") double threshold,
    @NotBlank @Size(max = 60) String label
) {
}
