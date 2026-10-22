package com.example.expensetracker.controller;

import com.example.expensetracker.dto.FinancialIntelligenceDto;
import com.example.expensetracker.dto.WealthSimulationRequest;
import com.example.expensetracker.dto.WealthSimulationResponse;
import com.example.expensetracker.security.UserSecurity;
import com.example.expensetracker.service.FinancialIntelligenceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Financial Intelligence & Forecasting")
@Slf4j
@RequiredArgsConstructor
@SecurityRequirement(name = "BearerAuth")
@RestController
@RequestMapping("/api/intelligence")
public class FinancialIntelligenceController {

    private final FinancialIntelligenceService intelligenceService;
    private final UserSecurity userSecurity;

    @Operation(summary = "Get executive financial intelligence snapshot")
    @GetMapping("/user/{userId}")
    public ResponseEntity<FinancialIntelligenceDto> getIntelligenceSnapshot(@PathVariable Long userId) {
        userSecurity.validateUserAccess(userId);
        return ResponseEntity.ok(intelligenceService.getIntelligenceSnapshot(userId));
    }

    @Operation(summary = "Simulate What-If wealth and savings goal trajectory")
    @PostMapping("/user/{userId}/simulate")
    public ResponseEntity<WealthSimulationResponse> simulateWealthTrajectory(
            @PathVariable Long userId,
            @Valid @RequestBody(required = false) WealthSimulationRequest request) {
        userSecurity.validateUserAccess(userId);
        return ResponseEntity.ok(intelligenceService.simulateWealthTrajectory(userId, request));
    }
}
