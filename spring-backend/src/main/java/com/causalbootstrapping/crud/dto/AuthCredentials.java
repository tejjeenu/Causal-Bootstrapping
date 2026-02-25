package com.causalbootstrapping.crud.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AuthCredentials(
    @NotBlank @Email @Size(max = 254) String email,
    @NotBlank @Size(min = 6, max = 128) String password
) {
}
