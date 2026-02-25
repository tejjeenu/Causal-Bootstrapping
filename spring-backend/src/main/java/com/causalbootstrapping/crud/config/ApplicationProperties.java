package com.causalbootstrapping.crud.config;

import jakarta.validation.constraints.NotBlank;
import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "app")
public class ApplicationProperties {
    @NotBlank
    private String supabaseUrl = "";

    @NotBlank
    private String supabaseAnonKey = "";

    private String supabaseResultsTable = "prediction_results";
    private String supabaseRiskSettingsTable = "risk_classification_settings";
    private String authCookieName = "cb_auth_token";
    private boolean authCookieSecure = false;
    private String authCookieSameSite = "Lax";
    private List<String> allowedOrigins = new ArrayList<>(List.of("http://localhost:5173", "http://127.0.0.1:5173"));

    public String getSupabaseUrl() {
        return supabaseUrl;
    }

    public void setSupabaseUrl(String supabaseUrl) {
        this.supabaseUrl = supabaseUrl;
    }

    public String getSupabaseAnonKey() {
        return supabaseAnonKey;
    }

    public void setSupabaseAnonKey(String supabaseAnonKey) {
        this.supabaseAnonKey = supabaseAnonKey;
    }

    public String getSupabaseResultsTable() {
        return supabaseResultsTable;
    }

    public void setSupabaseResultsTable(String supabaseResultsTable) {
        this.supabaseResultsTable = supabaseResultsTable;
    }

    public String getSupabaseRiskSettingsTable() {
        return supabaseRiskSettingsTable;
    }

    public void setSupabaseRiskSettingsTable(String supabaseRiskSettingsTable) {
        this.supabaseRiskSettingsTable = supabaseRiskSettingsTable;
    }

    public String getAuthCookieName() {
        return authCookieName;
    }

    public void setAuthCookieName(String authCookieName) {
        this.authCookieName = authCookieName;
    }

    public boolean isAuthCookieSecure() {
        return authCookieSecure;
    }

    public void setAuthCookieSecure(boolean authCookieSecure) {
        this.authCookieSecure = authCookieSecure;
    }

    public String getAuthCookieSameSite() {
        return authCookieSameSite;
    }

    public void setAuthCookieSameSite(String authCookieSameSite) {
        this.authCookieSameSite = authCookieSameSite;
    }

    public List<String> getAllowedOrigins() {
        return allowedOrigins;
    }

    public void setAllowedOrigins(List<String> allowedOrigins) {
        this.allowedOrigins = allowedOrigins;
    }
}
