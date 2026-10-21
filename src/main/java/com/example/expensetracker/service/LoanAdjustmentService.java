package com.example.expensetracker.service;

import com.example.expensetracker.dto.LoanAdjustmentDto;
import com.example.expensetracker.dto.LoanAdjustmentRequest;
import com.example.expensetracker.dto.LoanMetricsDto;

import java.util.List;

/**
 * Service defining operations for managing peer loans, friend adjustments, and debt settlements.
 *
 * @author Yogeshwaran
 */
public interface LoanAdjustmentService {

    List<LoanAdjustmentDto> getLoansForUser(Long userId);

    LoanAdjustmentDto getLoanById(Long id, Long userId);

    LoanAdjustmentDto createLoan(LoanAdjustmentRequest request, Long userId);

    LoanAdjustmentDto updateLoan(Long id, LoanAdjustmentRequest request, Long userId);

    LoanAdjustmentDto toggleSettleLoan(Long id, Long userId);

    void deleteLoan(Long id, Long userId);

    LoanMetricsDto getLoanMetrics(Long userId);
}
