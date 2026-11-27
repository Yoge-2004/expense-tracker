package com.example.expensetracker.domain.expense.service;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.expensetracker.common.CurrencyAwareDocumentExporter;
import com.example.expensetracker.common.export.CsvExportSupport;
import com.example.expensetracker.domain.expense.dto.ExpenseDto;
import com.example.expensetracker.domain.expense.mapper.ExpenseMapper;
import com.example.expensetracker.domain.expense.model.Expense;
import com.example.expensetracker.domain.expense.repository.ExpenseRepository;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.infrastructure.exception.ExportException;

/** Expense-only export use cases and expense persistence access. */
@Service
@Transactional(readOnly = true)
public class ExpenseExportServiceImpl implements ExpenseExportService {

    private final ExpenseRepository expenses;
    private final ObjectMapper objectMapper;
    private final Map<String, CurrencyAwareDocumentExporter<User, List<Expense>>> exporters;

    /**
     * Constructs the expense export service wired to all registered document exporter strategies.
     *
     * @param expenses     expense repository
     * @param objectMapper JSON mapper
     * @param exporters    available document exporter strategies keyed by format
     */
    @Autowired
    public ExpenseExportServiceImpl(
            ExpenseRepository expenses,
            ObjectMapper objectMapper,
            List<CurrencyAwareDocumentExporter<User, List<Expense>>> exporters) {
        this.expenses = expenses;
        this.objectMapper = objectMapper;
        this.exporters = exporters == null
                ? Map.of()
                : exporters.stream().collect(Collectors.toMap(
                        e -> e.getFormat().toUpperCase(Locale.ROOT),
                        Function.identity(),
                        (first, _) -> first));
    }

    /**
     * Compatibility constructor accepting explicit PDF and Excel exporter abstractions.
     *
     * @param expenses      expense repository
     * @param objectMapper  JSON mapper
     * @param pdfExporter   PDF exporter strategy
     * @param excelExporter Excel exporter strategy
     */
    public ExpenseExportServiceImpl(
            ExpenseRepository expenses,
            ObjectMapper objectMapper,
            CurrencyAwareDocumentExporter<User, List<Expense>> pdfExporter,
            CurrencyAwareDocumentExporter<User, List<Expense>> excelExporter) {
        this(expenses, objectMapper, List.of(pdfExporter, excelExporter));
    }

    @Override
    public byte[] exportExpensesToCsv(User user) {
        List<Expense> rows = expenses.findByUser(requireUser(user));
        StringBuilder csv = new StringBuilder((int) Math.min(1_000_000L, 48L + rows.size() * 112L));
        csv.append("ID,Date,Category,Amount,Description,Recurring\n");
        for (Expense expense : rows) {
            csv.append(expense.getId()).append(',')
                    .append(expense.getExpenseDate() == null ? "" : expense.getExpenseDate()).append(',')
                    .append(CsvExportSupport.quotedCell(
                            expense.getCategory() == null ? "" : expense.getCategory().getName())).append(',')
                    .append(expense.getAmount() == null ? "0" : expense.getAmount().toPlainString()).append(',')
                    .append(CsvExportSupport.quotedCell(expense.getDescription())).append(',')
                    .append(expense.isRecurring()).append('\n');
        }
        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }

    @Override
    public byte[] exportExpensesToJson(User user) {
        List<ExpenseDto> rows = expenses.findByUser(requireUser(user)).stream()
                .map(ExpenseMapper::toDto)
                .toList();
        try {
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(rows);
        } catch (JsonProcessingException exception) {
            throw new ExportException("Error exporting expenses to JSON", exception);
        }
    }

    @Override
    public byte[] exportExpensesToPdf(User user) {
        return exportExpensesToPdf(user, null);
    }

    @Override
    public byte[] exportExpensesToPdf(User user, String preferredCurrency) {
        return exportWithFormat("PDF", user, preferredCurrency);
    }

    @Override
    public byte[] exportExpensesToExcel(User user) {
        return exportExpensesToExcel(user, null);
    }

    @Override
    public byte[] exportExpensesToExcel(User user, String preferredCurrency) {
        return exportWithFormat("EXCEL", user, preferredCurrency);
    }

    private byte[] exportWithFormat(String format, User user, String preferredCurrency) {
        User validUser = requireUser(user);
        CurrencyAwareDocumentExporter<User, List<Expense>> exporter = exporters.get(format);
        if (exporter == null) {
            throw new ExportException("No expense exporter configured for format: " + format, null);
        }
        return exporter.export(validUser, preferredCurrency, expenses.findByUser(validUser));
    }

    private User requireUser(User user) {
        if (user == null) {
            throw new IllegalArgumentException("User context cannot be null");
        }
        return user;
    }
}
