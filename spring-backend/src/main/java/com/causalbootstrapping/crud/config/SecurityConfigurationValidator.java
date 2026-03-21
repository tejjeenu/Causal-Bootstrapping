package com.causalbootstrapping.crud.config;

import jakarta.annotation.PostConstruct;
import java.net.URI;
import java.net.URISyntaxException;
import org.springframework.stereotype.Component;

@Component
public class SecurityConfigurationValidator {
    private final ApplicationProperties properties;

    public SecurityConfigurationValidator(ApplicationProperties properties) {
        this.properties = properties;
    }

    @PostConstruct
    public void validate() {
        boolean secureCookie = properties.isAuthCookieSecure();
        String sameSite = properties.getAuthCookieSameSite();

        if ("none".equalsIgnoreCase(sameSite) && !secureCookie) {
            throw new IllegalStateException("AUTH_COOKIE_SAMESITE=None requires AUTH_COOKIE_SECURE=true.");
        }

        boolean hasNonLocalOrigin = properties.getAllowedOrigins().stream()
            .filter(origin -> origin != null && !origin.isBlank())
            .map(this::parseHost)
            .anyMatch(host -> host != null && !isLocalHost(host));

        if (hasNonLocalOrigin && !secureCookie) {
            throw new IllegalStateException(
                "AUTH_COOKIE_SECURE must be true when CORS_ORIGINS includes non-local origins."
            );
        }
    }

    private String parseHost(String rawOrigin) {
        try {
            return new URI(rawOrigin.trim()).getHost();
        } catch (URISyntaxException exception) {
            return null;
        }
    }

    private boolean isLocalHost(String host) {
        return "localhost".equalsIgnoreCase(host)
            || "127.0.0.1".equals(host)
            || "::1".equals(host)
            || "[::1]".equals(host);
    }
}
