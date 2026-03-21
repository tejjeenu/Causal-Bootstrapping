package com.causalbootstrapping.crud.service;

import com.causalbootstrapping.crud.config.ApplicationProperties;
import com.causalbootstrapping.crud.error.ApiException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class PasswordPolicyServiceTest {
    @Test
    void rejectsShortPassword() {
        PasswordPolicyService service = new PasswordPolicyService(properties());

        ApiException exception = assertThrows(
            ApiException.class,
            () -> service.validateForSignup("user@example.com", "short123!")
        );

        assertEquals(400, exception.getStatusCode());
    }

    @Test
    void rejectsPasswordContainingEmailName() {
        PasswordPolicyService service = new PasswordPolicyService(properties());

        ApiException exception = assertThrows(
            ApiException.class,
            () -> service.validateForSignup("patient@example.com", "patient-secure-password1!")
        );

        assertEquals(400, exception.getStatusCode());
    }

    @Test
    void rejectsPasswordWithoutDigit() {
        PasswordPolicyService service = new PasswordPolicyService(properties());

        ApiException exception = assertThrows(
            ApiException.class,
            () -> service.validateForSignup("user@example.com", "Causal predictor access!")
        );

        assertEquals(400, exception.getStatusCode());
    }

    @Test
    void rejectsPasswordWithoutSymbol() {
        PasswordPolicyService service = new PasswordPolicyService(properties());

        ApiException exception = assertThrows(
            ApiException.class,
            () -> service.validateForSignup("user@example.com", "Causal predictor access1")
        );

        assertEquals(400, exception.getStatusCode());
    }

    @Test
    void acceptsLongPassphraseWithDigitAndSymbol() {
        PasswordPolicyService service = new PasswordPolicyService(properties());

        assertDoesNotThrow(() -> service.validateForSignup("user@example.com", "Causal predictor access1!"));
    }

    private ApplicationProperties properties() {
        ApplicationProperties properties = new ApplicationProperties();
        properties.setSignupPasswordMinLength(12);
        return properties;
    }
}
