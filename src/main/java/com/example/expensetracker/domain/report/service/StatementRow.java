package com.example.expensetracker.domain.report.service;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Standard normalized representation of a single transaction entry within an ingested bank statement.
 */
public record StatementRow(
        LocalDate date,
        String narration,
        BigDecimal debit,
        BigDecimal credit,
        String reference,
        int rowNum
) {}
