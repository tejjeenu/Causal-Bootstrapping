package com.causalbootstrapping.crud.service;

import com.causalbootstrapping.crud.config.ApplicationProperties;
import com.causalbootstrapping.crud.error.ApiException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.springframework.stereotype.Service;

@Service
public class SupabaseClientService {
    private final ApplicationProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public SupabaseClientService(ApplicationProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    }

    public JsonNode authRequest(String method, String path, JsonNode payload, String accessToken) {
        String normalizedPath = path.startsWith("/") ? path.substring(1) : path;
        String url = stripTrailingSlash(properties.getSupabaseUrl()) + "/auth/v1/" + normalizedPath;
        return request(method, url, payload, accessToken, null);
    }

    public JsonNode restRequest(String method, String path, JsonNode payload, String accessToken, String prefer) {
        String normalizedPath = path.startsWith("/") ? path.substring(1) : path;
        String url = stripTrailingSlash(properties.getSupabaseUrl()) + "/rest/v1/" + normalizedPath;
        return request(method, url, payload, accessToken, prefer);
    }

    public ObjectNode objectNode() {
        return objectMapper.createObjectNode();
    }

    private JsonNode request(String method, String url, JsonNode payload, String accessToken, String prefer) {
        String body = null;
        if (payload != null) {
            try {
                body = objectMapper.writeValueAsString(payload);
            } catch (IOException exception) {
                throw new ApiException(500, "Unable to serialize request payload.");
            }
        }

        HttpRequest.Builder requestBuilder = HttpRequest.newBuilder(URI.create(url))
            .timeout(Duration.ofSeconds(20))
            .header("apikey", properties.getSupabaseAnonKey())
            .header("Accept", "application/json");

        if (accessToken != null && !accessToken.isBlank()) {
            requestBuilder.header("Authorization", "Bearer " + accessToken);
        }
        if (payload != null) {
            requestBuilder.header("Content-Type", "application/json");
        }
        if (prefer != null && !prefer.isBlank()) {
            requestBuilder.header("Prefer", prefer);
        }

        String normalizedMethod = method == null ? "GET" : method.toUpperCase();
        if (body == null) {
            requestBuilder.method(normalizedMethod, HttpRequest.BodyPublishers.noBody());
        } else {
            requestBuilder.method(normalizedMethod, HttpRequest.BodyPublishers.ofString(body));
        }

        HttpResponse<String> response;
        try {
            response = httpClient.send(requestBuilder.build(), HttpResponse.BodyHandlers.ofString());
        } catch (IOException exception) {
            throw new ApiException(502, "Unable to reach Supabase.");
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new ApiException(502, "Supabase request interrupted.");
        }

        JsonNode responseBody = parseJson(response.body());
        int statusCode = response.statusCode();
        if (statusCode >= 400) {
            throw new ApiException(statusCode, extractErrorDetail(statusCode, responseBody, response.body()));
        }
        return responseBody;
    }

    private JsonNode parseJson(String body) {
        if (body == null || body.isBlank()) {
            return objectMapper.createObjectNode();
        }
        try {
            return objectMapper.readTree(body);
        } catch (IOException exception) {
            throw new ApiException(502, "Supabase returned invalid JSON.");
        }
    }

    private String extractErrorDetail(int statusCode, JsonNode node, String rawBody) {
        if (node != null && node.isObject()) {
            String[] keys = {"message", "hint", "details", "error"};
            for (String key : keys) {
                JsonNode value = node.get(key);
                if (value != null && value.isTextual() && !value.asText().isBlank()) {
                    return value.asText();
                }
            }
        }
        if (rawBody != null && !rawBody.isBlank()) {
            return rawBody;
        }
        return "Supabase request failed with status " + statusCode + ".";
    }

    private String stripTrailingSlash(String value) {
        if (value == null) {
            return "";
        }
        String stripped = value.trim();
        while (stripped.endsWith("/")) {
            stripped = stripped.substring(0, stripped.length() - 1);
        }
        return stripped;
    }
}
