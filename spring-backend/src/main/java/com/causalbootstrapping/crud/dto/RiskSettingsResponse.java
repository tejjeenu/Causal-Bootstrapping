package com.causalbootstrapping.crud.dto;

import java.util.List;

public record RiskSettingsResponse(List<RiskRule> rules) {
}
