package com.causalbootstrapping.crud.controller;

import com.causalbootstrapping.crud.dto.AuthCredentials;
import com.causalbootstrapping.crud.dto.AuthSessionResponse;
import com.causalbootstrapping.crud.dto.AuthUser;
import com.causalbootstrapping.crud.dto.MessageResponse;
import com.causalbootstrapping.crud.dto.PasswordResetConfirmRequest;
import com.causalbootstrapping.crud.dto.PasswordResetRequest;
import com.causalbootstrapping.crud.error.ApiException;
import com.causalbootstrapping.crud.service.AuthRateLimitService;
import com.causalbootstrapping.crud.service.OriginGuard;
import com.causalbootstrapping.crud.service.PasswordPolicyService;
import com.causalbootstrapping.crud.service.SessionService;
import com.causalbootstrapping.crud.service.SupabaseAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
public class AuthController {
    private final SupabaseAuthService supabaseAuthService;
    private final SessionService sessionService;
    private final OriginGuard originGuard;
    private final PasswordPolicyService passwordPolicyService;
    private final AuthRateLimitService authRateLimitService;

    public AuthController(
        SupabaseAuthService supabaseAuthService,
        SessionService sessionService,
        OriginGuard originGuard,
        PasswordPolicyService passwordPolicyService,
        AuthRateLimitService authRateLimitService
    ) {
        this.supabaseAuthService = supabaseAuthService;
        this.sessionService = sessionService;
        this.originGuard = originGuard;
        this.passwordPolicyService = passwordPolicyService;
        this.authRateLimitService = authRateLimitService;
    }

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthSessionResponse signUp(
        @Valid @RequestBody AuthCredentials credentials,
        HttpServletRequest request,
        HttpServletResponse response
    ) {
        authRateLimitService.checkSignupAllowed(request, credentials.email());
        passwordPolicyService.validateForSignup(credentials.email(), credentials.password());

        SupabaseAuthService.AuthSessionData sessionData;
        try {
            sessionData = supabaseAuthService.signUp(credentials.email(), credentials.password());
        } catch (ApiException exception) {
            if (shouldCountAuthFailure(exception)) {
                authRateLimitService.recordSignupFailure(request, credentials.email());
            }
            throw exception;
        }
        authRateLimitService.resetSignupFailures(request, credentials.email());
        if (sessionData.accessToken() != null && !sessionData.accessToken().isBlank()) {
            sessionService.setAuthCookie(response, sessionData.accessToken(), sessionData.expiresIn());
        }

        return new AuthSessionResponse(
            sessionData.accessToken() != null && !sessionData.accessToken().isBlank(),
            sessionData.user(),
            sessionData.emailConfirmationRequired()
        );
    }

    @PostMapping("/login")
    public AuthSessionResponse login(
        @Valid @RequestBody AuthCredentials credentials,
        HttpServletRequest request,
        HttpServletResponse response
    ) {
        authRateLimitService.checkLoginAllowed(request, credentials.email());

        SupabaseAuthService.AuthSessionData sessionData;
        try {
            sessionData = supabaseAuthService.signIn(credentials.email(), credentials.password());
        } catch (ApiException exception) {
            if (shouldCountAuthFailure(exception)) {
                authRateLimitService.recordLoginFailure(request, credentials.email());
            }
            throw exception;
        }
        authRateLimitService.resetLoginFailures(request, credentials.email());
        sessionService.setAuthCookie(response, sessionData.accessToken(), sessionData.expiresIn());

        return new AuthSessionResponse(true, sessionData.user(), false);
    }

    @GetMapping("/me")
    public AuthSessionResponse me(HttpServletRequest request, HttpServletResponse response) {
        String accessToken = sessionService.getAccessToken(request);
        if (accessToken == null || accessToken.isBlank()) {
            return new AuthSessionResponse(false, null, false);
        }

        try {
            AuthUser user = supabaseAuthService.getUserForToken(accessToken);
            return new AuthSessionResponse(true, user, false);
        } catch (ApiException exception) {
            if (exception.getStatusCode() == 401 || exception.getStatusCode() == 403) {
                sessionService.clearAuthCookie(response);
                return new AuthSessionResponse(false, null, false);
            }
            throw exception;
        }
    }

    @PostMapping("/logout")
    public MessageResponse logout(HttpServletRequest request, HttpServletResponse response) {
        originGuard.enforceTrustedOrigin(request);
        String accessToken = sessionService.getAccessToken(request);
        if (accessToken != null && !accessToken.isBlank()) {
            try {
                supabaseAuthService.signOut(accessToken);
            } catch (ApiException exception) {
                if (exception.getStatusCode() != 401 && exception.getStatusCode() != 403) {
                    throw exception;
                }
            }
        }
        sessionService.clearAuthCookie(response);
        return new MessageResponse("Logged out.");
    }

    @PostMapping("/password-reset/request")
    public MessageResponse requestPasswordReset(
        @Valid @RequestBody PasswordResetRequest payload,
        HttpServletRequest request
    ) {
        String redirectTo = originGuard.enforceTrustedOrigin(request);
        supabaseAuthService.requestPasswordReset(payload.email(), redirectTo);
        return new MessageResponse("If the email exists, a reset link has been sent.");
    }

    @PostMapping("/password-reset/confirm")
    public AuthSessionResponse confirmPasswordReset(
        @Valid @RequestBody PasswordResetConfirmRequest payload,
        HttpServletResponse response
    ) {
        passwordPolicyService.validateForSignup(null, payload.password());
        AuthUser user = supabaseAuthService.updatePassword(payload.accessToken(), payload.password());
        sessionService.setAuthCookie(response, payload.accessToken(), payload.expiresIn());
        return new AuthSessionResponse(true, user, false);
    }

    private boolean shouldCountAuthFailure(ApiException exception) {
        int statusCode = exception.getStatusCode();
        return statusCode == 400 || statusCode == 401 || statusCode == 403 || statusCode == 422;
    }
}
