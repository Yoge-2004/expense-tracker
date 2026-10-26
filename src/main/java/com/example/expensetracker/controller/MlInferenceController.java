package com.example.expensetracker.controller;

import com.example.expensetracker.dto.MlClassificationRequest;
import com.example.expensetracker.dto.MlClassificationResponse;
import com.example.expensetracker.service.MlInferenceClient;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/ml")
public class MlInferenceController {

    private final MlInferenceClient client;

    public MlInferenceController(MlInferenceClient client) {
        this.client = client;
    }

    @Operation(summary = "Classify an expense description with the active ML model")
    @PostMapping("/classify")
    public ResponseEntity<MlClassificationResponse> classify(
            @Valid @RequestBody MlClassificationRequest request) {
        return ResponseEntity.ok(client.classify(request));
    }

    @Operation(summary = "Match merchant against canonical merchant names")
    @PostMapping("/merchants/match")
    public ResponseEntity<Map<String, Object>> matchMerchant(@RequestBody Map<String, Object> request) {
        return ResponseEntity.ok(client.matchMerchant(request));
    }

    @Operation(summary = "Check duplicate candidate transactions using vector similarity")
    @PostMapping("/duplicates/check")
    public ResponseEntity<Map<String, Object>> checkDuplicates(@RequestBody Map<String, Object> request) {
        return ResponseEntity.ok(client.checkDuplicates(request));
    }

    @Operation(summary = "Score transactions for statistical and pattern anomalies")
    @PostMapping("/anomalies/score")
    public ResponseEntity<Map<String, Object>> scoreAnomalies(@RequestBody Map<String, Object> request) {
        return ResponseEntity.ok(client.scoreAnomalies(request));
    }

    @Operation(summary = "Generate multi-day forward spending forecast")
    @PostMapping("/forecast/spending")
    public ResponseEntity<Map<String, Object>> forecastSpending(@RequestBody Map<String, Object> request) {
        return ResponseEntity.ok(client.forecastSpending(request));
    }

    @Operation(summary = "Get ML engine health and loaded model revisions")
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(client.health());
    }
}
