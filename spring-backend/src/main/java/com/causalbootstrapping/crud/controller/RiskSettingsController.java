package com.causalbootstrapping.crud.controller;

import com.causalbootstrapping.crud.dto.RiskSettingsResponse;
import com.causalbootstrapping.crud.dto.RiskSettingsUpsertRequest;
import com.causalbootstrapping.crud.dto.RiskRule;
import com.causalbootstrapping.crud.dto.AuthUser;
import com.causalbootstrapping.crud.service.AuthSessionGuard;
import com.causalbootstrapping.crud.service.OriginGuard;
import com.causalbootstrapping.crud.service.SupabaseCrudService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/risk-settings")
public class RiskSettingsController {
    private final AuthSessionGuard authSessionGuard;
    private final OriginGuard originGuard;
    private final SupabaseCrudService supabaseCrudService;

    public RiskSettingsController(
        AuthSessionGuard authSessionGuard,
        OriginGuard originGuard,
        SupabaseCrudService supabaseCrudService
    ) {
        this.authSessionGuard = authSessionGuard;
        this.originGuard = originGuard;
        this.supabaseCrudService = supabaseCrudService;
    }

    @GetMapping
    public RiskSettingsResponse getRiskSettings(HttpServletRequest request) {
        AuthUser user = authSessionGuard.requireAuthenticatedUser(request);
        String accessToken = authSessionGuard.requireAccessToken(request);
        List<RiskRule> rules = supabaseCrudService.getRiskSettings(accessToken, user.id());
        return new RiskSettingsResponse(rules);
    }

    @PutMapping
    public RiskSettingsResponse replaceRiskSettings(
        @Valid @RequestBody RiskSettingsUpsertRequest payload,
        HttpServletRequest request
    ) {
        originGuard.enforceTrustedOrigin(request);
        AuthUser user = authSessionGuard.requireAuthenticatedUser(request);
        String accessToken = authSessionGuard.requireAccessToken(request);
        List<RiskRule> savedRules = supabaseCrudService.replaceRiskSettings(accessToken, user.id(), payload.rules());
        supabaseCrudService.syncPredictionResultLabels(accessToken, user.id(), savedRules);
        return new RiskSettingsResponse(savedRules);
    }
}
