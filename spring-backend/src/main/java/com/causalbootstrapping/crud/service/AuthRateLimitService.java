package com.causalbootstrapping.crud.service;

import com.causalbootstrapping.crud.config.ApplicationProperties;
import com.causalbootstrapping.crud.error.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

@Service
public class AuthRateLimitService {
    private final ApplicationProperties properties;
    private final Map<String, Deque<Instant>> attemptsByKey = new ConcurrentHashMap<>();

    public AuthRateLimitService(ApplicationProperties properties) {
        this.properties = properties;
    }

    public void checkLoginAllowed(HttpServletRequest request, String email) {
        enforceLimit("login:ip", clientIp(request), properties.getAuthLoginMaxAttempts(), "Too many login attempts.");
        enforceLimit("login:email", normalizeEmail(email), properties.getAuthLoginMaxAttempts(), "Too many login attempts.");
    }

    public void recordLoginFailure(HttpServletRequest request, String email) {
        recordAttempt("login:ip", clientIp(request));
        recordAttempt("login:email", normalizeEmail(email));
    }

    public void resetLoginFailures(HttpServletRequest request, String email) {
        clearAttempts("login:ip", clientIp(request));
        clearAttempts("login:email", normalizeEmail(email));
    }

    public void checkSignupAllowed(HttpServletRequest request, String email) {
        enforceLimit("signup:ip", clientIp(request), properties.getAuthSignupMaxAttempts(), "Too many signup attempts.");
        enforceLimit("signup:email", normalizeEmail(email), properties.getAuthSignupMaxAttempts(), "Too many signup attempts.");
    }

    public void recordSignupFailure(HttpServletRequest request, String email) {
        recordAttempt("signup:ip", clientIp(request));
        recordAttempt("signup:email", normalizeEmail(email));
    }

    public void resetSignupFailures(HttpServletRequest request, String email) {
        clearAttempts("signup:ip", clientIp(request));
        clearAttempts("signup:email", normalizeEmail(email));
    }

    private void enforceLimit(String prefix, String value, int maxAttempts, String baseMessage) {
        if (value == null || value.isBlank()) {
            return;
        }
        String key = key(prefix, value);
        Deque<Instant> attempts = attemptsByKey.computeIfAbsent(key, ignored -> new ArrayDeque<>());
        synchronized (attempts) {
            pruneOldAttempts(attempts);
            if (attempts.size() >= maxAttempts) {
                Instant oldestAttempt = attempts.peekFirst();
                long retryAfterSeconds = oldestAttempt == null
                    ? properties.getAuthRateLimitWindowSeconds()
                    : Math.max(
                        1,
                        Duration.between(Instant.now(), oldestAttempt.plusSeconds(properties.getAuthRateLimitWindowSeconds()))
                            .toSeconds()
                    );
                throw new ApiException(429, baseMessage + " Try again in " + retryAfterSeconds + " seconds.");
            }
        }
    }

    private void recordAttempt(String prefix, String value) {
        if (value == null || value.isBlank()) {
            return;
        }
        String key = key(prefix, value);
        Deque<Instant> attempts = attemptsByKey.computeIfAbsent(key, ignored -> new ArrayDeque<>());
        synchronized (attempts) {
            pruneOldAttempts(attempts);
            attempts.addLast(Instant.now());
        }
    }

    private void clearAttempts(String prefix, String value) {
        if (value == null || value.isBlank()) {
            return;
        }
        attemptsByKey.remove(key(prefix, value));
    }

    private void pruneOldAttempts(Deque<Instant> attempts) {
        Instant cutoff = Instant.now().minusSeconds(properties.getAuthRateLimitWindowSeconds());
        while (!attempts.isEmpty() && attempts.peekFirst().isBefore(cutoff)) {
            attempts.removeFirst();
        }
    }

    private String clientIp(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",", 2)[0].trim();
        }
        String remoteAddr = request.getRemoteAddr();
        return remoteAddr == null ? "" : remoteAddr.trim();
    }

    private String normalizeEmail(String email) {
        if (email == null) {
            return "";
        }
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private String key(String prefix, String value) {
        return prefix + "|" + value;
    }
}
