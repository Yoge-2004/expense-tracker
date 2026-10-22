package com.example.expensetracker.service;

import com.example.expensetracker.dto.FinancialIntelligenceDto;
import com.example.expensetracker.dto.WealthSimulationRequest;
import com.example.expensetracker.dto.WealthSimulationResponse;

public interface FinancialIntelligenceService {
    FinancialIntelligenceDto getIntelligenceSnapshot(Long userId);
    WealthSimulationResponse simulateWealthTrajectory(Long userId, WealthSimulationRequest request);
}
