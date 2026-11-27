package com.example.expensetracker.domain.ai.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.*;

import com.example.expensetracker.domain.ai.dto.MlClassificationRequest;
import com.example.expensetracker.domain.ai.dto.MlClassificationResponse;
import com.example.expensetracker.domain.ai.service.MlInferenceClient;

/**
 * REST controller exposing proxy endpoints to the Python ML inference service
 * for category prediction, merchant canonicalization, duplicate checking,
 * anomaly scoring, and spending forecasts.
 */
@Tag(name = "ML Inference", description = "Machine-learning expense classification, merchant matching, duplicate detection, anomaly scoring, and forecasts")
@SecurityRequirement(name = "BearerAuth")
@RestController
@RequestMapping("/api/ml")
public class MlInferenceController {

    private final MlInferenceClient client;

    public MlInferenceController(MlInferenceClient client) {
        this.client = client;
    }

    @Operation(summary = "Classify an expense description with the active ML model")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Classification result returned"),
        @ApiResponse(responseCode = "400", description = "Invalid classification request"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @PostMapping("/classify")
    public ResponseEntity<MlClassificationResponse> classify(
            @Valid @RequestBody MlClassificationRequest request) {
        return ResponseEntity.ok(client.classify(request));
    }

    @Operation(summary = "Match merchant against canonical merchant names")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Canonical merchant matches returned"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @PostMapping("/merchants/match")
    public ResponseEntity<Map<String, Object>> matchMerchant(@RequestBody Map<String, Object> request) {
        Map<String, Object> payload = new LinkedHashMap<>();
        String query = request.containsKey("query") ? String.valueOf(request.get("query"))
                : String.valueOf(request.getOrDefault("raw_merchant", ""));
        payload.put("query", query);
        payload.put("top_k", request.getOrDefault("top_k", 5));

        Map<String, Object> res = new LinkedHashMap<>(client.matchMerchant(payload));
        if (res.get("matches") instanceof List<?> list && !list.isEmpty() && list.getFirst() instanceof Map<?, ?> top) {
            res.put("canonical_merchant", top.get("merchant"));
            res.put("merchant", top.get("merchant"));
            res.put("confidence", top.get("similarity"));
        } else {
            res.put("canonical_merchant", query);
            res.put("confidence", 0.0);
        }
        return ResponseEntity.ok(res);
    }

    @Operation(summary = "Check duplicate candidate transactions using vector similarity")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Duplicate similarity assessment returned"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @PostMapping("/duplicates/check")
    public ResponseEntity<Map<String, Object>> checkDuplicates(@RequestBody Map<String, Object> request) {
        Map<String, Object> payload = new LinkedHashMap<>();
        if (request.containsKey("candidate_a") && request.containsKey("candidate_b")) {
            Map<?, ?> a = request.get("candidate_a") instanceof Map<?, ?> m ? m : Map.of();
            Map<?, ?> b = request.get("candidate_b") instanceof Map<?, ?> m ? m : Map.of();
            String queryA = a.get("description") != null ? String.valueOf(a.get("description")) : "";
            String descB = b.get("description") != null ? String.valueOf(b.get("description")) : "";
            payload.put("query", queryA);
            payload.put("candidates", List.of(descB));
            payload.put("threshold", 0.70);
            payload.put("top_k", 5);
        } else {
            payload.putAll(request);
        }

        Map<String, Object> res = new LinkedHashMap<>(client.checkDuplicates(payload));
        if (res.get("matches") instanceof List<?> list && !list.isEmpty() && list.getFirst() instanceof Map<?, ?> top) {
            double sim = top.get("similarity") instanceof Number n ? n.doubleValue() : 0.0;
            res.put("is_duplicate", sim >= 0.70);
            res.put("similarity", sim);
        } else {
            res.put("is_duplicate", false);
            res.put("similarity", 0.0);
        }
        return ResponseEntity.ok(res);
    }

    @Operation(summary = "Score transactions for statistical and pattern anomalies")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Anomaly scores returned"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @PostMapping("/anomalies/score")
    public ResponseEntity<Map<String, Object>> scoreAnomalies(@RequestBody Map<String, Object> request) {
        Map<String, Object> payload = new LinkedHashMap<>();
        if (!request.containsKey("transactions")) {
            double amt = request.containsKey("amount") && request.get("amount") instanceof Number n ? n.doubleValue() : 0.0;
            String cat = request.containsKey("category") ? String.valueOf(request.get("category")) : "General";
            payload.put("transactions", List.of(Map.of("amount", amt, "category", cat)));
        } else {
            payload.putAll(request);
        }

        Map<String, Object> res = new LinkedHashMap<>(client.scoreAnomalies(payload));
        if (res.get("results") instanceof List<?> list && !list.isEmpty() && list.getFirst() instanceof Map<?, ?> first) {
            res.put("is_anomaly", first.get("is_anomaly") != null ? first.get("is_anomaly") : false);
            res.put("anomaly_score", first.get("anomaly_score") != null ? first.get("anomaly_score") : 0.0);
            res.put("z_score", first.get("z_score") != null ? first.get("z_score") : 0.0);
        }
        return ResponseEntity.ok(res);
    }

    @Operation(summary = "Generate multi-day forward spending forecast")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Spending forecast returned"),
        @ApiResponse(responseCode = "400", description = "Invalid forecast parameters"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @PostMapping("/forecast/spending")
    public ResponseEntity<Map<String, Object>> forecastSpending(@RequestBody(required = false) Map<String, Object> request) {
        Map<String, Object> safeRequest = request != null ? request : Map.of();
        Map<String, Object> payload = new LinkedHashMap<>();
        int horizon = parseIntParam(safeRequest.get("horizon_days"), 7, "horizon_days");
        payload.put("horizon_days", Math.clamp(horizon, 1, 30));

        if (safeRequest.get("history") instanceof List<?> list && !list.isEmpty()) {
            List<Map<String, Object>> history = new ArrayList<>();
            for (Object item : list) {
                if (item instanceof Map<?, ?> m) {
                    Map<String, Object> entry = new LinkedHashMap<>();
                    m.forEach((k, v) -> entry.put(String.valueOf(k), v));
                    history.add(entry);
                }
            }
            // FastAPI requires at least 28 history days. If fewer, pad with earlier zero-spend days
            if (!history.isEmpty() && history.size() < 28) {
                java.time.LocalDate earliest;
                try {
                    String firstDateStr = String.valueOf(history.getFirst().get("date"));
                    earliest = java.time.LocalDate.parse(firstDateStr.split("T")[0]);
                } catch (Exception _) {
                    earliest = java.time.LocalDate.now().minusDays(history.size());
                }
                int needed = 28 - history.size();
                List<Map<String, Object>> padding = new ArrayList<>();
                for (int i = needed; i >= 1; i--) {
                    padding.add(Map.of("date", earliest.minusDays(i).toString(), "amount", 0.0));
                }
                padding.addAll(history);
                history = padding;
            }
            payload.put("history", history);
        } else if (safeRequest.get("daily_amounts") instanceof List<?> list && !list.isEmpty()) {
            List<Map<String, Object>> history = new ArrayList<>();
            int size = Math.max(list.size(), 28);
            java.time.LocalDate start = java.time.LocalDate.now().minusDays(size);
            for (int i = 0; i < list.size(); i++) {
                double amt = parseDoubleParam(list.get(i), 0.0, "daily_amounts[" + i + "]");
                history.add(Map.of("date", start.plusDays(i).toString(), "amount", amt));
            }
            while (history.size() < 28) {
                history.addFirst(Map.of("date", start.minusDays(28 - history.size()).toString(), "amount", 0.0));
            }
            payload.put("history", history);
        } else {
            double base = parseDoubleParam(safeRequest.get("historical_base"), 45000.0, "historical_base");
            double avgDaily = base / 30.0;
            List<Map<String, Object>> simulated = new ArrayList<>();
            java.time.LocalDate start = java.time.LocalDate.now().minusDays(30);
            for (int i = 0; i < 30; i++) {
                double variance = Math.sin(i * 0.5) * (avgDaily * 0.2);
                simulated.add(Map.of("date", start.plusDays(i).toString(), "amount", Math.max(10.0, avgDaily + variance)));
            }
            payload.put("history", simulated);
        }

        Map<String, Object> upstream = client.forecastSpending(payload);
        Map<String, Object> res = upstream != null ? new LinkedHashMap<>(upstream) : new LinkedHashMap<>();
        return ResponseEntity.ok(res);
    }

    @Operation(summary = "Get ML engine health and loaded model revisions")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "ML engine status returned"),
        @ApiResponse(responseCode = "503", description = "ML engine unavailable")
    })
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(client.health());
    }

    private static int parseIntParam(Object raw, int defaultValue, String fieldName) {
        if (raw == null) {
            return defaultValue;
        }
        if (raw instanceof Number n) {
            return n.intValue();
        }
        if (raw instanceof String s && !s.isBlank()) {
            try {
                return Integer.parseInt(s.trim());
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException(fieldName + " must be a valid integer", e);
            }
        }
        throw new IllegalArgumentException(fieldName + " must be a valid integer");
    }

    private static double parseDoubleParam(Object raw, double defaultValue, String fieldName) {
        if (raw == null) {
            return defaultValue;
        }
        if (raw instanceof Number n) {
            return n.doubleValue();
        }
        if (raw instanceof String s && !s.isBlank()) {
            try {
                double parsed = Double.parseDouble(s.trim());
                if (!Double.isFinite(parsed)) {
                    throw new IllegalArgumentException(fieldName + " must be finite");
                }
                return parsed;
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException(fieldName + " must be a valid number", e);
            }
        }
        throw new IllegalArgumentException(fieldName + " must be a valid number");
    }
}
