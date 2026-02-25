package com.causalbootstrapping.crud.controller;

import com.causalbootstrapping.crud.dto.AuthCredentials;
import com.causalbootstrapping.crud.dto.AuthSessionResponse;
import com.causalbootstrapping.crud.dto.AuthUser;
import com.causalbootstrapping.crud.dto.MessageResponse;
import com.causalbootstrapping.crud.error.ApiException;
import com.causalbootstrapping.crud.service.OriginGuard;
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

    public AuthController(
        SupabaseAuthService supabaseAuthService,
        SessionService sessionService,
        OriginGuard originGuard
    ) {
        this.supabaseAuthService = supabaseAuthService;
        this.sessionService = sessionService;
        this.originGuard = originGuard;
    }

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthSessionResponse signUp(
        @Valid @RequestBody AuthCredentials credentials,
        HttpServletResponse response
    ) {
        SupabaseAuthService.AuthSessionData sessionData = supabaseAuthService.signUp(
            credentials.email(),
            credentials.password()
        );
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
    public AuthSessionResponse login(@Valid @RequestBody AuthCredentials credentials, HttpServletResponse response) {
        SupabaseAuthService.AuthSessionData sessionData = supabaseAuthService.signIn(
            credentials.email(),
            credentials.password()
        );
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
}
