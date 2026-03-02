package com.causalbootstrapping.crud.controller;

import com.causalbootstrapping.crud.dto.PredictionResultCreateRequest;
import com.causalbootstrapping.crud.dto.PredictionResultUpdateRequest;
import com.causalbootstrapping.crud.dto.SavedPredictionListResponse;
import com.causalbootstrapping.crud.dto.SavedPredictionRecord;
import com.causalbootstrapping.crud.service.AuthSessionGuard;
import com.causalbootstrapping.crud.service.OriginGuard;
import com.causalbootstrapping.crud.service.SupabaseCrudService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/results")
public class ResultsController {
    private final AuthSessionGuard authSessionGuard;
    private final OriginGuard originGuard;
    private final SupabaseCrudService supabaseCrudService;

    public ResultsController(
        AuthSessionGuard authSessionGuard,
        OriginGuard originGuard,
        SupabaseCrudService supabaseCrudService
    ) {
        this.authSessionGuard = authSessionGuard;
        this.originGuard = originGuard;
        this.supabaseCrudService = supabaseCrudService;
    }

    @GetMapping
    public SavedPredictionListResponse getResults(
        HttpServletRequest request,
        @RequestParam(name = "limit", required = false) Integer limit
    ) {
        authSessionGuard.requireAuthenticatedUser(request);
        String accessToken = authSessionGuard.requireAccessToken(request);
        List<SavedPredictionRecord> results = supabaseCrudService.listPredictionResults(accessToken, limit);
        return new SavedPredictionListResponse(results);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SavedPredictionRecord saveResult(
        @Valid @RequestBody PredictionResultCreateRequest payload,
        HttpServletRequest request
    ) {
        originGuard.enforceTrustedOrigin(request);
        authSessionGuard.requireAuthenticatedUser(request);
        String accessToken = authSessionGuard.requireAccessToken(request);
        return supabaseCrudService.insertPredictionResult(accessToken, payload);
    }

    @PatchMapping("/{resultId}")
    public SavedPredictionRecord updateResult(
        @PathVariable String resultId,
        @Valid @RequestBody PredictionResultUpdateRequest payload,
        HttpServletRequest request
    ) {
        originGuard.enforceTrustedOrigin(request);
        authSessionGuard.requireAuthenticatedUser(request);
        String accessToken = authSessionGuard.requireAccessToken(request);
        return supabaseCrudService.updatePredictionResult(accessToken, resultId, payload);
    }

    @DeleteMapping("/{resultId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteResult(@PathVariable String resultId, HttpServletRequest request) {
        originGuard.enforceTrustedOrigin(request);
        authSessionGuard.requireAuthenticatedUser(request);
        String accessToken = authSessionGuard.requireAccessToken(request);
        supabaseCrudService.deletePredictionResult(accessToken, resultId);
    }
}
