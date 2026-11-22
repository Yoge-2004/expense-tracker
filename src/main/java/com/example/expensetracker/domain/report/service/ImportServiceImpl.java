package com.example.expensetracker.domain.report.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import com.example.expensetracker.domain.expense.repository.CategoryRepository;
import com.example.expensetracker.domain.expense.service.ExpenseImportService;
import com.example.expensetracker.domain.expense.service.ExpenseImportServiceImpl;
import com.example.expensetracker.domain.expense.service.ExpenseService;
import com.example.expensetracker.domain.income.service.IncomeImportService;
import com.example.expensetracker.domain.income.service.IncomeImportServiceImpl;
import com.example.expensetracker.domain.income.service.IncomeService;
import com.example.expensetracker.domain.user.model.User;

/**
 * Composite facade implementation of {@link ImportService}.
 * <p>
 * Decomposed in accordance with SOLID engineering principles:
 * <ul>
 *   <li><b>Single Responsibility Principle (SRP):</b> Ingestion logic is delegated to dedicated services
 *       ({@link ExpenseImportService}, {@link IncomeImportService}, and {@link BankStatementReconciliationService}),
 *       while shared parsing algorithms reside in {@link ImportParsingSupport}.</li>
 *   <li><b>Interface Segregation Principle (ISP):</b> Clients can depend directly on fine-grained import contracts
 *       or use this facade when composite import capabilities are required.</li>
 *   <li><b>Dependency Inversion Principle (DIP):</b> Depends on abstractions injected via constructor.</li>
 * </ul>
 * </p>
 *
 * @author Yogeshwaran
 */
@Slf4j
@Primary
@Service("importService")
@Transactional(readOnly = true)
public class ImportServiceImpl implements ImportService {

    private final ExpenseImportService expenseImportService;
    private final IncomeImportService incomeImportService;
    private final BankStatementReconciliationService bankStatementReconciliationService;

    @Autowired
    public ImportServiceImpl(ExpenseImportService expenseImportService,
                             IncomeImportService incomeImportService,
                             BankStatementReconciliationService bankStatementReconciliationService) {
        this.expenseImportService = expenseImportService;
        this.incomeImportService = incomeImportService;
        this.bankStatementReconciliationService = bankStatementReconciliationService;
    }

    /**
     * Backward-compatible constructor for standalone instantiation and test harnesses.
     */
    public ImportServiceImpl(ExpenseService expenseService,
                             IncomeService incomeService,
                             CategoryRepository categoryRepository,
                             List<BankStatementParser> statementParsers,
                             ObjectMapper objectMapper) {
        this(new ExpenseImportServiceImpl(expenseService, categoryRepository, objectMapper),
             new IncomeImportServiceImpl(incomeService, objectMapper),
             new BankStatementReconciliationServiceImpl(expenseService, incomeService, categoryRepository, statementParsers));
    }

    /**
     * Backward-compatible convenience constructor.
     */
    public ImportServiceImpl(ExpenseService expenseService,
                             IncomeService incomeService,
                             CategoryRepository categoryRepository) {
        this(expenseService, incomeService, categoryRepository, Collections.emptyList(), null);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EXPENSE IMPORTS (Delegated to ExpenseImportService)
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    @Transactional
    public Map<String, Object> importExpensesFromCsv(MultipartFile file, User user) {
        return expenseImportService.importExpensesFromCsv(file, user);
    }

    @Override
    @Transactional
    public Map<String, Object> importExpensesFromJson(MultipartFile file, User user) {
        return expenseImportService.importExpensesFromJson(file, user);
    }

    @Override
    @Transactional
    public Map<String, Object> importExpensesFromExcel(MultipartFile file, User user) {
        return expenseImportService.importExpensesFromExcel(file, user);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INCOME IMPORTS (Delegated to IncomeImportService)
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    @Transactional
    public Map<String, Object> importIncomesFromCsv(MultipartFile file, User user) {
        return incomeImportService.importIncomesFromCsv(file, user);
    }

    @Override
    @Transactional
    public Map<String, Object> importIncomesFromJson(MultipartFile file, User user) {
        return incomeImportService.importIncomesFromJson(file, user);
    }

    @Override
    @Transactional
    public Map<String, Object> importIncomesFromExcel(MultipartFile file, User user) {
        return incomeImportService.importIncomesFromExcel(file, user);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // BANK STATEMENT RECONCILIATION (Delegated to BankStatementReconciliationService)
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    @Transactional
    public Map<String, Object> reconcileBankStatement(MultipartFile file, User user) {
        return bankStatementReconciliationService.reconcileBankStatement(file, user);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UTILITY METHODS FOR TEST & CLIENT BACKWARD-COMPATIBILITY
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Extracts a clean, human-readable merchant/source name from noisy bank statement narrations.
     * Delegates to {@link ImportParsingSupport#cleanBankNarration(String)}.
     */
    public static String cleanBankNarration(String raw) {
        return ImportParsingSupport.cleanBankNarration(raw);
    }

    /**
     * Parses a date string across ISO and supported locale-specific patterns.
     * Delegates to {@link ImportParsingSupport#parseDateString(String)}.
     */
    public static LocalDate parseDateString(String fallbackStr) {
        return ImportParsingSupport.parseDateString(fallbackStr);
    }
}
