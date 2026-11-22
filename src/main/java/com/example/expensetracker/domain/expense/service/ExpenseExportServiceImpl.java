package com.example.expensetracker.domain.expense.service;

import java.nio.charset.StandardCharsets;
import java.util.List;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.expensetracker.domain.expense.dto.ExpenseDto;
import com.example.expensetracker.domain.expense.mapper.ExpenseMapper;
import com.example.expensetracker.domain.expense.model.Expense;
import com.example.expensetracker.domain.expense.repository.ExpenseRepository;
import com.example.expensetracker.common.export.CsvExportSupport;
import com.example.expensetracker.domain.report.service.ExpenseExcelReportGenerator;
import com.example.expensetracker.domain.report.service.ExpensePdfReportGenerator;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.infrastructure.exception.ExportException;

/** Expense-only export use cases and expense persistence access. */
@Service
@Transactional(readOnly = true)
public class ExpenseExportServiceImpl implements ExpenseExportService {

    private final ExpenseRepository expenses;
    private final ObjectMapper objectMapper;
    private final ExpensePdfReportGenerator pdfGenerator;
    private final ExpenseExcelReportGenerator excelGenerator;

    public ExpenseExportServiceImpl(ExpenseRepository expenses,
                                    ObjectMapper objectMapper,
                                    ExpensePdfReportGenerator pdfGenerator,
                                    ExpenseExcelReportGenerator excelGenerator) {
        this.expenses = expenses;
        this.objectMapper = objectMapper;
        this.pdfGenerator = pdfGenerator;
        this.excelGenerator = excelGenerator;
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
        User validUser = requireUser(user);
        return pdfGenerator.generate(validUser, preferredCurrency, expenses.findByUser(validUser));
    }

    @Override
    public byte[] exportExpensesToExcel(User user) {
        return exportExpensesToExcel(user, null);
    }

    @Override
    public byte[] exportExpensesToExcel(User user, String preferredCurrency) {
        User validUser = requireUser(user);
        return excelGenerator.generate(validUser, preferredCurrency, expenses.findByUser(validUser));
    }

    private User requireUser(User user) {
        if (user == null) {
            throw new IllegalArgumentException("User context cannot be null");
        }
        return user;
    }
}
