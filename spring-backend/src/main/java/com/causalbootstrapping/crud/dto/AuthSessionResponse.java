package com.causalbootstrapping.crud.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record AuthSessionResponse(
    boolean authenticated,
    AuthUser user,
    @JsonProperty("email_confirmation_required") boolean emailConfirmationRequired
) {
}
