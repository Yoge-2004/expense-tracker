package com.example.expensetracker.controller;

import com.example.expensetracker.dto.MlClassificationRequest;
import com.example.expensetracker.dto.MlClassificationResponse;
import com.example.expensetracker.service.MlInferenceClient;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
}
