package com.example.expensetracker.domain.admin.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.io.IOException;
import java.io.OutputStream;
import java.sql.SQLException;
import java.util.Map;

import com.example.expensetracker.domain.expense.dto.ExpenseDto;
import com.example.expensetracker.domain.income.dto.IncomeDto;



/**
 * Service providing administrative inspection of platform-wide transactions,
 * full multi-tenant ledger export, and instant database snapshot generation.
 *
 * @author Yogeshwaran
 */
public interface AdminDataService {

    Page<ExpenseDto> getAllExpenses(Long userId, Pageable pageable);

    Page<IncomeDto> getAllIncomes(Long userId, Pageable pageable);

    /**
     * Streams the full multi-tenant ledger (users, expenses, incomes, categories) to {@code out} as
     * one JSON object.
     *
     * <p>Rows are read and written one page at a time, so memory use stays flat however large the
     * database is. The stream is closed when writing finishes. Keys are {@code timestamp}, then each
     * collection followed by its total ({@code users}/{@code totalUsers}, and so on).</p>
     *
     * @param out destination, normally the HTTP response body
     * @throws IOException if writing to {@code out} fails
     */
    void writePlatformLedger(OutputStream out) throws IOException;

    byte[] exportSqliteSnapshot() throws IOException, SQLException;

    Map<String, Object> triggerManualBackup();
}
