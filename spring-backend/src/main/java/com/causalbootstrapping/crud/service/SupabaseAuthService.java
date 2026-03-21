package com.causalbootstrapping.crud.service;

import com.causalbootstrapping.crud.dto.AuthUser;
import com.causalbootstrapping.crud.error.ApiException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;

@Service
public class SupabaseAuthService {
    private final SupabaseClientService supabaseClientService;

    public SupabaseAuthService(SupabaseClientService supabaseClientService) {
        this.supabaseClientService = supabaseClientService;
    }

    public AuthSessionData signUp(String email, String password) {
        ObjectNode payload = supabaseClientService.objectNode();
        payload.put("email", email);
        payload.put("password", password);
        JsonNode data = supabaseClientService.authRequest("POST", "signup", payload, null);

        AuthUser user = mapAuthUser(data);
        TokenData tokenData = extractTokenData(data);
        boolean authenticated = tokenData.accessToken() != null && !tokenData.accessToken().isBlank();
        return new AuthSessionData(user, tokenData.accessToken(), tokenData.expiresIn(), !authenticated);
    }

    public AuthSessionData signIn(String email, String password) {
        ObjectNode payload = supabaseClientService.objectNode();
        payload.put("email", email);
        payload.put("password", password);
        JsonNode data = supabaseClientService.authRequest("POST", "token?grant_type=password", payload, null);

        AuthUser user = mapAuthUser(data);
        TokenData tokenData = extractTokenData(data);
        if (tokenData.accessToken() == null || tokenData.accessToken().isBlank()) {
            throw new ApiException(401, "Login failed. No access token returned.");
        }
        return new AuthSessionData(user, tokenData.accessToken(), tokenData.expiresIn(), false);
    }

    public AuthUser getUserForToken(String accessToken) {
        JsonNode data = supabaseClientService.authRequest("GET", "user", null, accessToken);
        return mapAuthUser(data);
    }

    public void signOut(String accessToken) {
        supabaseClientService.authRequest("POST", "logout", supabaseClientService.objectNode(), accessToken);
    }

    public void requestPasswordReset(String email, String redirectTo) {
        ObjectNode payload = supabaseClientService.objectNode();
        payload.put("email", email);
        if (redirectTo != null && !redirectTo.isBlank()) {
            payload.put("redirect_to", redirectTo);
        }
        supabaseClientService.authRequest("POST", "recover", payload, null);
    }

    public AuthUser updatePassword(String accessToken, String password) {
        ObjectNode payload = supabaseClientService.objectNode();
        payload.put("password", password);
        JsonNode data = supabaseClientService.authRequest("PUT", "user", payload, accessToken);
        return mapAuthUser(data);
    }

    private AuthUser mapAuthUser(JsonNode data) {
        JsonNode userNode = data.path("user");
        if (!userNode.isObject()) {
            userNode = data;
        }
        String userId = textValue(userNode, "id");
        if (userId == null || userId.isBlank()) {
            throw new ApiException(502, "Supabase response did not include user information.");
        }
        return new AuthUser(userId, textValue(userNode, "email"));
    }

    private TokenData extractTokenData(JsonNode data) {
        String accessToken = textValue(data, "access_token");
        int expiresIn = intValue(data, "expires_in", 3600);

        JsonNode sessionNode = data.path("session");
        if ((accessToken == null || accessToken.isBlank()) && sessionNode.isObject()) {
            accessToken = textValue(sessionNode, "access_token");
            expiresIn = intValue(sessionNode, "expires_in", expiresIn);
        }
        if (expiresIn <= 0) {
            expiresIn = 3600;
        }
        return new TokenData(accessToken, expiresIn);
    }

    private String textValue(JsonNode node, String key) {
        JsonNode value = node.get(key);
        if (value == null || value.isNull() || !value.isTextual()) {
            return null;
        }
        return value.asText();
    }

    private int intValue(JsonNode node, String key, int defaultValue) {
        JsonNode value = node.get(key);
        if (value == null || !value.canConvertToInt()) {
            return defaultValue;
        }
        return value.asInt(defaultValue);
    }

    public record AuthSessionData(AuthUser user, String accessToken, int expiresIn, boolean emailConfirmationRequired) {
    }

    private record TokenData(String accessToken, int expiresIn) {
    }
}
