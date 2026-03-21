package com.causalbootstrapping.crud.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PasswordResetConfirmRequest(
    @NotBlank String accessToken,
    @Min(1) @Max(604800) int expiresIn,
    @NotBlank @Size(max = 128) String password
) {
}
