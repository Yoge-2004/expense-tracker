package com.example.expensetracker.domain.admin.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import com.example.expensetracker.domain.user.model.User;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Path;
import java.sql.SQLException;

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

    /**
     * Writes a portable SQLite snapshot of the current database to a new temporary file.
     *
     * <p>The file is returned instead of a {@code byte[]} so the caller can stream it and the whole
     * database never has to sit on the heap. The caller owns the file and must delete it once it has
     * been sent.</p>
     *
     * @return path of the freshly written snapshot
     * @throws IOException  if the temporary file cannot be created
     * @throws SQLException if the database cannot be read
     */
    Path createSqliteSnapshotFile() throws IOException, SQLException;

    /**
     * Checks that {@code actor} may take a bulk copy of the platform data and records the attempt in
     * the audit trail. Call this before any data is written to the response.
     *
     * @param actor      the signed-in administrator
     * @param stepUpPin  the administrator's security PIN; required and verified
     * @param action     audit action name, for example {@code EXPORT_PLATFORM_LEDGER}
     * @param ipAddress  client address recorded with the audit entry
     * @param userAgent  client user agent recorded with the audit entry
     * @throws com.example.expensetracker.infrastructure.exception.ForbiddenException  if {@code actor} is not a Super Admin
     * @throws com.example.expensetracker.infrastructure.exception.BadRequestException if the PIN is missing or wrong
     */
    void authorizeBulkExport(User actor, String stepUpPin, String action, String ipAddress, String userAgent);
}
