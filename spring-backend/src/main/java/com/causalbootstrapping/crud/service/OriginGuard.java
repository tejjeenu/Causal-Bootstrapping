package com.causalbootstrapping.crud.service;

import com.causalbootstrapping.crud.config.ApplicationProperties;
import com.causalbootstrapping.crud.error.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

@Component
public class OriginGuard {
    private final Set<String> allowedOrigins;

    public OriginGuard(ApplicationProperties properties) {
        this.allowedOrigins = properties.getAllowedOrigins().stream()
            .map(value -> value == null ? "" : value.trim().toLowerCase())
            .filter(value -> !value.isEmpty())
            .collect(Collectors.toSet());
    }

    public void enforceTrustedOrigin(HttpServletRequest request) {
        String origin = request.getHeader("Origin");
        String referer = request.getHeader("Referer");

        if (origin != null && !origin.isBlank()) {
            String normalized = normalizeOrigin(origin);
            if (normalized == null || !allowedOrigins.contains(normalized)) {
                throw new ApiException(403, "Request origin is not allowed.");
            }
            return;
        }

        if (referer != null && !referer.isBlank()) {
            String normalized = normalizeOrigin(referer);
            if (normalized == null || !allowedOrigins.contains(normalized)) {
                throw new ApiException(403, "Request origin is not allowed.");
            }
        }
    }

    private String normalizeOrigin(String raw) {
        try {
            URI uri = new URI(raw.trim());
            if (uri.getScheme() == null || uri.getHost() == null) {
                return null;
            }
            String authority = uri.getPort() > 0
                ? uri.getHost() + ":" + uri.getPort()
                : uri.getHost();
            return (uri.getScheme() + "://" + authority).toLowerCase();
        } catch (URISyntaxException exception) {
            return null;
        }
    }
}
