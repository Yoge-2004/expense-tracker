package com.example.expensetracker.service;

import com.example.expensetracker.dto.ExpenseDto;
import com.example.expensetracker.dto.IncomeDto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.io.IOException;
import java.sql.SQLException;
import java.util.Map;

/**
 * Service providing administrative inspection of platform-wide transactions,
 * full multi-tenant ledger export, and instant database snapshot generation.
 *
 * @author Yogeshwaran
 */
public interface AdminDataService {

    Page<ExpenseDto> getAllExpenses(Long userId, Pageable pageable);

    Page<IncomeDto> getAllIncomes(Long userId, Pageable pageable);

    Map<String, Object> exportPlatformLedger();

    byte[] exportSqliteSnapshot() throws IOException, SQLException;

    Map<String, Object> triggerManualBackup();
}
