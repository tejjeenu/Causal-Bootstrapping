package com.causalbootstrapping.crud.service;

import com.causalbootstrapping.crud.dto.AuthUser;
import com.causalbootstrapping.crud.error.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

@Component
public class AuthSessionGuard {
    private final SessionService sessionService;
    private final SupabaseAuthService supabaseAuthService;

    public AuthSessionGuard(SessionService sessionService, SupabaseAuthService supabaseAuthService) {
        this.sessionService = sessionService;
        this.supabaseAuthService = supabaseAuthService;
    }

    public AuthUser requireAuthenticatedUser(HttpServletRequest request) {
        String accessToken = requireAccessToken(request);
        try {
            return supabaseAuthService.getUserForToken(accessToken);
        } catch (ApiException exception) {
            if (exception.getStatusCode() == 401 || exception.getStatusCode() == 403) {
                throw new ApiException(401, "Invalid or expired session.");
            }
            throw exception;
        }
    }

    public String requireAccessToken(HttpServletRequest request) {
        String accessToken = sessionService.getAccessToken(request);
        if (accessToken == null || accessToken.isBlank()) {
            throw new ApiException(401, "Authentication required.");
        }
        return accessToken;
    }
}
