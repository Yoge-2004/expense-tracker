package com.example.expensetracker.domain.loan.service;

import java.util.List;

import com.example.expensetracker.domain.loan.dto.LoanAdjustmentDto;
import com.example.expensetracker.domain.loan.dto.LoanAdjustmentRequest;
import com.example.expensetracker.domain.loan.dto.LoanMetricsDto;



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
