package com.causalbootstrapping.crud.service;

import com.causalbootstrapping.crud.config.ApplicationProperties;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

@Component
public class SessionService {
    private final ApplicationProperties properties;

    public SessionService(ApplicationProperties properties) {
        this.properties = properties;
    }

    public String getAccessToken(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (properties.getAuthCookieName().equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }

    public void setAuthCookie(HttpServletResponse response, String accessToken, int expiresInSeconds) {
        ResponseCookie cookie = ResponseCookie.from(properties.getAuthCookieName(), accessToken)
            .httpOnly(true)
            .secure(properties.isAuthCookieSecure())
            .sameSite(properties.getAuthCookieSameSite())
            .path("/")
            .maxAge(expiresInSeconds)
            .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    public void clearAuthCookie(HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from(properties.getAuthCookieName(), "")
            .httpOnly(true)
            .secure(properties.isAuthCookieSecure())
            .sameSite(properties.getAuthCookieSameSite())
            .path("/")
            .maxAge(0)
            .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}
