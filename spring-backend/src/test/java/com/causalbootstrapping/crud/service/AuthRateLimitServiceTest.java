package com.causalbootstrapping.crud.service;

import com.causalbootstrapping.crud.config.ApplicationProperties;
import com.causalbootstrapping.crud.error.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AuthRateLimitServiceTest {
    @Test
    void blocksAfterConfiguredLoginAttempts() {
        ApplicationProperties properties = new ApplicationProperties();
        properties.setAuthRateLimitWindowSeconds(60);
        properties.setAuthLoginMaxAttempts(2);
        AuthRateLimitService service = new AuthRateLimitService(properties);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("127.0.0.1");

        service.recordLoginFailure(request, "user@example.com");
        service.recordLoginFailure(request, "user@example.com");

        ApiException exception = assertThrows(
            ApiException.class,
            () -> service.checkLoginAllowed(request, "user@example.com")
        );

        assertEquals(429, exception.getStatusCode());
    }

    @Test
    void resetLoginFailuresClearsWindow() {
        ApplicationProperties properties = new ApplicationProperties();
        properties.setAuthRateLimitWindowSeconds(60);
        properties.setAuthLoginMaxAttempts(1);
        AuthRateLimitService service = new AuthRateLimitService(properties);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("127.0.0.1");

        service.recordLoginFailure(request, "user@example.com");
        service.resetLoginFailures(request, "user@example.com");
        service.checkLoginAllowed(request, "user@example.com");
    }
}
