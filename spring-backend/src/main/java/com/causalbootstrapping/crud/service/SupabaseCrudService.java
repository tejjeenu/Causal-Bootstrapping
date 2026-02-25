package com.causalbootstrapping.crud.service;

import com.causalbootstrapping.crud.config.ApplicationProperties;
import com.causalbootstrapping.crud.dto.PredictionResultCreateRequest;
import com.causalbootstrapping.crud.dto.PredictionResultUpdateRequest;
import com.causalbootstrapping.crud.dto.RiskRule;
import com.causalbootstrapping.crud.dto.SavedPredictionRecord;
import com.causalbootstrapping.crud.error.ApiException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class SupabaseCrudService {
    private static final int DEFAULT_LIMIT = 50;

    private final ApplicationProperties properties;
    private final SupabaseClientService supabaseClientService;
    private final ObjectMapper objectMapper;

    public SupabaseCrudService(
        ApplicationProperties properties,
        SupabaseClientService supabaseClientService,
        ObjectMapper objectMapper
    ) {
        this.properties = properties;
        this.supabaseClientService = supabaseClientService;
        this.objectMapper = objectMapper;
    }

    public List<RiskRule> getRiskSettings(String accessToken) {
        String path = properties.getSupabaseRiskSettingsTable() + "?select=threshold,label&order=threshold.asc";
        JsonNode data = supabaseClientService.restRequest("GET", path, null, accessToken, null);
        if (!data.isArray()) {
            throw new ApiException(502, "Unexpected response when loading risk settings.");
        }

        List<RiskRule> rules = new ArrayList<>();
        for (JsonNode node : data) {
            rules.add(mapRiskRule(node));
        }
        if (rules.isEmpty()) {
            return List.of(defaultLowRisk(), defaultMediumRisk(), defaultHighRisk());
        }
        return normalizeRules(rules);
    }

    public List<RiskRule> replaceRiskSettings(String accessToken, List<RiskRule> inputRules) {
        List<RiskRule> rules = normalizeRules(inputRules);
        validateRuleSet(rules);

        String deletePath = properties.getSupabaseRiskSettingsTable() + "?user_id=not.is.null";
        supabaseClientService.restRequest("DELETE", deletePath, null, accessToken, "return=minimal");

        ArrayNode payload = objectMapper.createArrayNode();
        for (RiskRule rule : rules) {
            ObjectNode node = objectMapper.createObjectNode();
            node.put("threshold", rule.threshold());
            node.put("label", rule.label().trim());
            node.put("updated_at", Instant.now().toString());
            payload.add(node);
        }

        JsonNode data = supabaseClientService.restRequest(
            "POST",
            properties.getSupabaseRiskSettingsTable(),
            payload,
            accessToken,
            "return=representation"
        );
        if (!data.isArray()) {
            throw new ApiException(502, "Unexpected response when saving risk settings.");
        }

        List<RiskRule> savedRules = new ArrayList<>();
        for (JsonNode node : data) {
            savedRules.add(mapRiskRule(node));
        }
        return normalizeRules(savedRules);
    }

    public int syncPredictionResultLabels(String accessToken, List<RiskRule> inputRules) {
        List<RiskRule> rules = normalizeRules(inputRules);
        validateRuleSet(rules);

        int updatedCount = 0;
        int pageSize = 200;
        int offset = 0;

        while (true) {
            String path = properties.getSupabaseResultsTable()
                + "?select=id,risk_probability,risk_label"
                + "&order=created_at.desc"
                + "&limit=" + pageSize
                + "&offset=" + offset;

            JsonNode data = supabaseClientService.restRequest("GET", path, null, accessToken, null);
            if (!data.isArray()) {
                throw new ApiException(502, "Unexpected response when syncing result classifications.");
            }
            if (data.isEmpty()) {
                break;
            }

            for (JsonNode row : data) {
                String id = requiredText(row, "id", "Saved result row is missing 'id' during sync.");
                double probability = requiredDouble(
                    row,
                    "risk_probability",
                    "Saved result row has invalid 'risk_probability' during sync."
                );

                String expected = classifyProbability(probability, rules);
                String current = optionalText(row, "risk_label");
                if (expected.equals(current == null ? "" : current.trim())) {
                    continue;
                }

                ObjectNode patch = objectMapper.createObjectNode();
                patch.put("risk_label", expected);
                String patchPath = properties.getSupabaseResultsTable()
                    + "?id=eq."
                    + URLEncoder.encode(id, StandardCharsets.UTF_8);
                supabaseClientService.restRequest("PATCH", patchPath, patch, accessToken, "return=minimal");
                updatedCount++;
            }

            if (data.size() < pageSize) {
                break;
            }
            offset += pageSize;
        }

        return updatedCount;
    }

    public SavedPredictionRecord insertPredictionResult(String accessToken, PredictionResultCreateRequest request) {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("patient_first_name", request.patientFirstName().trim());
        payload.put("patient_last_name", request.patientLastName().trim());
        payload.set("clinical_inputs", objectMapper.valueToTree(request.clinicalInputs()));
        payload.put("risk_probability", request.riskProbability());
        payload.put("risk_percent", request.riskPercent());
        payload.put("risk_label", request.riskLabel().trim());
        payload.put("uncertainty_std", request.uncertaintyStd());
        payload.put("uncertainty_percent", request.uncertaintyPercent());
        payload.set("confidence_interval_95", objectMapper.valueToTree(request.confidenceInterval95()));

        JsonNode data = supabaseClientService.restRequest(
            "POST",
            properties.getSupabaseResultsTable(),
            payload,
            accessToken,
            "return=representation"
        );
        if (!data.isArray() || data.isEmpty()) {
            throw new ApiException(502, "Unexpected response when saving prediction result.");
        }
        return mapSavedPredictionRecord(data.get(0));
    }

    public SavedPredictionRecord updatePredictionResult(
        String accessToken,
        String resultId,
        PredictionResultUpdateRequest request
    ) {
        ObjectNode payload = objectMapper.createObjectNode();
        putIfPresent(payload, "patient_first_name", trimOrNull(request.patientFirstName()));
        putIfPresent(payload, "patient_last_name", trimOrNull(request.patientLastName()));
        if (request.clinicalInputs() != null) {
            payload.set("clinical_inputs", objectMapper.valueToTree(request.clinicalInputs()));
        }
        putIfPresent(payload, "risk_probability", request.riskProbability());
        putIfPresent(payload, "risk_percent", request.riskPercent());
        putIfPresent(payload, "risk_label", trimOrNull(request.riskLabel()));
        putIfPresent(payload, "uncertainty_std", request.uncertaintyStd());
        putIfPresent(payload, "uncertainty_percent", request.uncertaintyPercent());
        if (request.confidenceInterval95() != null) {
            payload.set("confidence_interval_95", objectMapper.valueToTree(request.confidenceInterval95()));
        }

        if (payload.isEmpty()) {
            throw new ApiException(400, "No update fields were provided.");
        }

        String path = properties.getSupabaseResultsTable()
            + "?id=eq."
            + URLEncoder.encode(resultId, StandardCharsets.UTF_8);
        JsonNode data = supabaseClientService.restRequest("PATCH", path, payload, accessToken, "return=representation");
        if (!data.isArray() || data.isEmpty()) {
            throw new ApiException(404, "Prediction result not found.");
        }
        return mapSavedPredictionRecord(data.get(0));
    }

    public List<SavedPredictionRecord> listPredictionResults(String accessToken, Integer limit) {
        int safeLimit = limit == null ? DEFAULT_LIMIT : Math.min(Math.max(limit, 1), 200);
        String select = "id,created_at,patient_first_name,patient_last_name,clinical_inputs,"
            + "risk_probability,risk_percent,risk_label,uncertainty_std,uncertainty_percent,confidence_interval_95";
        String path = properties.getSupabaseResultsTable()
            + "?select=" + select
            + "&order=created_at.desc&limit=" + safeLimit;

        JsonNode data = supabaseClientService.restRequest("GET", path, null, accessToken, null);
        if (!data.isArray()) {
            throw new ApiException(502, "Unexpected response when loading saved results.");
        }

        List<SavedPredictionRecord> results = new ArrayList<>();
        for (JsonNode node : data) {
            results.add(mapSavedPredictionRecord(node));
        }
        return results;
    }

    private SavedPredictionRecord mapSavedPredictionRecord(JsonNode node) {
        String id = requiredText(node, "id", "Saved result row is missing 'id'.");
        String createdAt = requiredText(node, "created_at", "Saved result row is missing 'created_at'.");

        String patientFirstName = optionalText(node, "patient_first_name");
        if (patientFirstName == null || patientFirstName.isBlank()) {
            patientFirstName = optionalText(node, "first_name");
        }
        String patientLastName = optionalText(node, "patient_last_name");
        if (patientLastName == null || patientLastName.isBlank()) {
            patientLastName = optionalText(node, "last_name");
        }

        Map<String, Object> clinicalInputs = objectMapper.convertValue(
            node.path("clinical_inputs"),
            new TypeReference<Map<String, Object>>() {}
        );

        List<Double> confidenceValues = new ArrayList<>();
        JsonNode intervalNode = node.path("confidence_interval_95");
        if (intervalNode.isArray()) {
            for (JsonNode value : intervalNode) {
                if (value.isNumber()) {
                    confidenceValues.add(value.asDouble());
                }
            }
        }

        return new SavedPredictionRecord(
            id,
            createdAt,
            patientFirstName == null ? "" : patientFirstName,
            patientLastName == null ? "" : patientLastName,
            clinicalInputs == null ? Map.of() : clinicalInputs,
            requiredDouble(node, "risk_probability", "Saved result row has invalid 'risk_probability'."),
            requiredDouble(node, "risk_percent", "Saved result row has invalid 'risk_percent'."),
            optionalText(node, "risk_label") == null ? "" : optionalText(node, "risk_label"),
            requiredDouble(node, "uncertainty_std", "Saved result row has invalid 'uncertainty_std'."),
            requiredDouble(node, "uncertainty_percent", "Saved result row has invalid 'uncertainty_percent'."),
            confidenceValues
        );
    }

    private RiskRule mapRiskRule(JsonNode node) {
        double threshold = requiredDouble(node, "threshold", "Risk settings row is malformed.");
        String label = optionalText(node, "label");
        if (label == null || label.trim().isEmpty()) {
            throw new ApiException(502, "Risk settings row is malformed.");
        }
        return new RiskRule(threshold, label.trim());
    }

    private List<RiskRule> normalizeRules(List<RiskRule> rules) {
        return rules.stream().sorted(Comparator.comparingDouble(RiskRule::threshold)).toList();
    }

    private void validateRuleSet(List<RiskRule> rules) {
        if (rules == null || rules.isEmpty()) {
            throw new ApiException(400, "Add at least one rule.");
        }
        Set<Double> seen = new HashSet<>();
        for (RiskRule rule : rules) {
            if (rule.threshold() < 0 || rule.threshold() > 1) {
                throw new ApiException(400, "Thresholds must be between 0 and 1.");
            }
            String label = rule.label() == null ? "" : rule.label().trim();
            if (label.isEmpty()) {
                throw new ApiException(400, "Labels cannot be empty.");
            }
            double key = Math.round(rule.threshold() * 1_000_000_0000d) / 1_000_000_0000d;
            if (!seen.add(key)) {
                throw new ApiException(400, "Threshold values must be unique.");
            }
        }
    }

    private String classifyProbability(double probability, List<RiskRule> rules) {
        String currentLabel = rules.get(0).label().trim();
        for (RiskRule rule : rules) {
            if (probability >= rule.threshold()) {
                currentLabel = rule.label().trim();
            } else {
                break;
            }
        }
        return currentLabel;
    }

    private void putIfPresent(ObjectNode node, String key, String value) {
        if (value != null) {
            node.put(key, value);
        }
    }

    private void putIfPresent(ObjectNode node, String key, Double value) {
        if (value != null) {
            node.put(key, value);
        }
    }

    private String trimOrNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String requiredText(JsonNode node, String key, String errorMessage) {
        String value = optionalText(node, key);
        if (value == null || value.isBlank()) {
            throw new ApiException(502, errorMessage);
        }
        return value;
    }

    private String optionalText(JsonNode node, String key) {
        JsonNode value = node.get(key);
        if (value == null || value.isNull()) {
            return null;
        }
        return value.asText();
    }

    private double requiredDouble(JsonNode node, String key, String errorMessage) {
        JsonNode value = node.get(key);
        if (value == null || !value.isNumber()) {
            throw new ApiException(502, errorMessage);
        }
        return value.asDouble();
    }

    private RiskRule defaultLowRisk() {
        return new RiskRule(0.0, "Low Risk");
    }

    private RiskRule defaultMediumRisk() {
        return new RiskRule(0.35, "Medium Risk");
    }

    private RiskRule defaultHighRisk() {
        return new RiskRule(0.7, "High Risk");
    }
}
