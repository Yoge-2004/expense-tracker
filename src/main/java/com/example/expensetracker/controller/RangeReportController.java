package com.example.expensetracker.controller;

import com.example.expensetracker.model.Budget;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.Income;
import com.example.expensetracker.model.RecurringExpense;
import com.example.expensetracker.model.SavingsGoal;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.BudgetRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.IncomeRepository;
import com.example.expensetracker.repository.RecurringExpenseRepository;
import com.example.expensetracker.repository.SavingsGoalRepository;
import com.example.expensetracker.security.UserSecurity;
import com.example.expensetracker.service.UserService;
import com.example.expensetracker.service.report.ExecutiveExcelReportGenerator;
import com.example.expensetracker.service.report.ExecutivePdfReportGenerator;
import com.example.expensetracker.service.report.ExecutiveReportData;
import com.example.expensetracker.service.report.ExecutiveReportDateRange;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST controller exposing executive range-based financial exports.
 * Orchestrates ledger extraction and delegates document rendering
 * to specialized Excel and PDF generators.
 */
@Slf4j
@RequiredArgsConstructor
@Transactional(readOnly = true)
@RestController
@RequestMapping({"/api/reports", "/api/expenses"})
public class RangeReportController {

    private static final MediaType XLSX = MediaType.parseMediaType(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    private final ExpenseRepository expenses;
    private final IncomeRepository incomes;
    private final SavingsGoalRepository savingsGoals;
    private final RecurringExpenseRepository recurringExpenses;
    private final BudgetRepository budgets;
    private final UserService users;
    private final UserSecurity security;
    private final ExecutiveExcelReportGenerator excelReportGenerator;
    private final ExecutivePdfReportGenerator pdfReportGenerator;

    @GetMapping("/user/{userId}/export/range/excel")
    public ResponseEntity<byte[]> excel(@PathVariable Long userId,
                                        @RequestParam(required = false) String from,
                                        @RequestParam(required = false) String to,
                                        @RequestParam(defaultValue = "INR") String currency) {
        security.validateUserAccess(userId);
        User user = user(userId);
        ExecutiveReportDateRange range = ExecutiveReportDateRange.of(from, to);
        log.info("Generating executive Excel report for userId={}, range='{}', currency='{}'",
                userId, range.label(), currency);
        ExecutiveReportData data = data(user, range);
        byte[] bytes = excelReportGenerator.generate(data, range, currency);
        log.info("Executive Excel report generated successfully for userId={}, size={} bytes", userId, bytes.length);
        return ResponseEntity.ok()
                .contentType(XLSX)
                .contentLength(bytes.length)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment()
                                .filename("ExpenseTracker_Executive_Dashboard.xlsx")
                                .build().toString())
                .body(bytes);
    }

    @GetMapping("/user/{userId}/export/range/pdf")
    public ResponseEntity<byte[]> pdf(@PathVariable Long userId,
                                      @RequestParam(required = false) String from,
                                      @RequestParam(required = false) String to,
                                      @RequestParam(defaultValue = "INR") String currency) {
        security.validateUserAccess(userId);
        User user = user(userId);
        ExecutiveReportDateRange range = ExecutiveReportDateRange.of(from, to);
        log.info("Generating executive PDF report for userId={}, range='{}', currency='{}'",
                userId, range.label(), currency);
        ExecutiveReportData data = data(user, range);
        byte[] bytes = pdfReportGenerator.generate(data, range, currency, user.getName());
        log.info("Executive PDF report generated successfully for userId={}, size={} bytes", userId, bytes.length);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .contentLength(bytes.length)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment()
                                .filename("ExpenseTracker_Executive_Report.pdf")
                                .build().toString())
                .body(bytes);
    }

    private User user(Long id) {
        return users.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    private ExecutiveReportData data(User user, ExecutiveReportDateRange range) {
        List<Expense> e;
        if (range.from() != null && range.to() != null) {
            e = expenses.findByUserAndExpenseDateBetween(user, range.from(), range.to());
        } else if (range.from() != null) {
            e = expenses.findByUserAndExpenseDateGreaterThanEqual(user, range.from());
        } else if (range.to() != null) {
            e = expenses.findByUserAndExpenseDateLessThanEqual(user, range.to());
        } else {
            e = expenses.findByUser(user);
        }

        List<Income> i;
        if (range.from() != null && range.to() != null) {
            i = incomes.findByUserAndIncomeDateBetween(user, range.from(), range.to());
        } else if (range.from() != null) {
            i = incomes.findByUserAndIncomeDateGreaterThanEqual(user, range.from());
        } else if (range.to() != null) {
            i = incomes.findByUserAndIncomeDateLessThanEqual(user, range.to());
        } else {
            i = incomes.findByUser(user);
        }

        List<SavingsGoal> s = savingsGoals.findByUser(user);
        List<RecurringExpense> r = recurringExpenses.findByUser(user);
        List<Budget> b = budgets.findByUser(user);
        return new ExecutiveReportData(e, i, s, r, b);
    }
}
