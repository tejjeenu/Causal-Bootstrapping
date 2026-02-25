package com.causalbootstrapping.crud.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

public record RiskSettingsUpsertRequest(
    @NotEmpty @Size(min = 2, max = 20) List<@Valid RiskRule> rules
) {
}
