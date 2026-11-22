package com.example.expensetracker.domain.report.api;

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

import com.example.expensetracker.domain.budget.model.Budget;
import com.example.expensetracker.domain.budget.repository.BudgetRepository;
import com.example.expensetracker.domain.expense.model.Expense;
import com.example.expensetracker.domain.expense.model.RecurringExpense;
import com.example.expensetracker.domain.expense.repository.ExpenseRepository;
import com.example.expensetracker.domain.expense.repository.RecurringExpenseRepository;
import com.example.expensetracker.domain.goal.model.SavingsGoal;
import com.example.expensetracker.domain.goal.repository.SavingsGoalRepository;
import com.example.expensetracker.domain.income.model.Income;
import com.example.expensetracker.domain.income.repository.IncomeRepository;
import com.example.expensetracker.domain.report.service.ExecutiveExcelReportGenerator;
import com.example.expensetracker.domain.report.service.ExecutivePdfReportGenerator;
import com.example.expensetracker.domain.report.service.ExecutiveReportData;
import com.example.expensetracker.domain.report.service.ExecutiveReportDateRange;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.domain.user.service.UserService;
import com.example.expensetracker.infrastructure.security.UserSecurity;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;



/**
 * REST controller exposing executive range-based financial exports.
 * Orchestrates ledger extraction and delegates document rendering
 * to specialized Excel and PDF generators.
 */
@Tag(
    name = "Range Reports",
    description = """
        Executive dashboard reports for a chosen date range, downloaded as a file.

        Leave `from` and `to` empty for all time, or give either or both as `yyyy-MM-dd`.
        Users can only export their own data. Every path is available under both `/api/reports`
        and `/api/expenses`.
        """
)
@SecurityRequirement(name = "BearerAuth")
@Slf4j
@Transactional(readOnly = true)
@RestController
@RequestMapping({"/api/reports", "/api/expenses"})
public class RangeReportController {

    private static final MediaType XLSX = MediaType.parseMediaType(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    private final com.example.expensetracker.domain.report.service.ExecutiveReportService executiveReportService;
    private final UserService users;
    private final UserSecurity security;
    private final ExecutiveExcelReportGenerator excelReportGenerator;
    private final ExecutivePdfReportGenerator pdfReportGenerator;
    private final com.example.expensetracker.domain.report.service.ReportExportRegistry exportRegistry;

    @org.springframework.beans.factory.annotation.Autowired
    public RangeReportController(com.example.expensetracker.domain.report.service.ExecutiveReportService executiveReportService,
                                 UserService users,
                                 UserSecurity security,
                                 ExecutiveExcelReportGenerator excelReportGenerator,
                                 ExecutivePdfReportGenerator pdfReportGenerator,
                                 @org.springframework.beans.factory.annotation.Autowired(required = false) com.example.expensetracker.domain.report.service.ReportExportRegistry exportRegistry) {
        this.executiveReportService = executiveReportService;
        this.users = users;
        this.security = security;
        this.excelReportGenerator = excelReportGenerator;
        this.pdfReportGenerator = pdfReportGenerator;
        this.exportRegistry = exportRegistry;
    }

    public RangeReportController(ExpenseRepository expenses,
                                 IncomeRepository incomes,
                                 SavingsGoalRepository savingsGoals,
                                 RecurringExpenseRepository recurringExpenses,
                                 BudgetRepository budgets,
                                 UserService users,
                                 UserSecurity security,
                                 ExecutiveExcelReportGenerator excelReportGenerator,
                                 ExecutivePdfReportGenerator pdfReportGenerator,
                                 com.example.expensetracker.domain.report.service.ReportExportRegistry exportRegistry) {
        this(new com.example.expensetracker.domain.report.service.ExecutiveReportServiceImpl(
                expenses, incomes, savingsGoals, recurringExpenses, budgets),
                users, security, excelReportGenerator, pdfReportGenerator, exportRegistry);
    }

    public RangeReportController(ExpenseRepository expenses,
                                 IncomeRepository incomes,
                                 SavingsGoalRepository savingsGoals,
                                 RecurringExpenseRepository recurringExpenses,
                                 BudgetRepository budgets,
                                 UserService users,
                                 UserSecurity security,
                                 ExecutiveExcelReportGenerator excelReportGenerator,
                                 ExecutivePdfReportGenerator pdfReportGenerator) {
        this(expenses, incomes, savingsGoals, recurringExpenses, budgets,
                users, security, excelReportGenerator, pdfReportGenerator, null);
    }

    /**
     * Polymorphic range export endpoint following the Open/Closed Principle (OCP).
     * Any registered ReportExportStrategy can be invoked dynamically without code changes.
     */
    @Operation(summary = "Export a range report in any supported format",
            description = "Looks up the export strategy for `format` (`excel` or `pdf`) and returns "
                    + "the report as a file download.")
    @ApiResponse(responseCode = "200", description = "Report file")
    @ApiResponse(responseCode = "400", description = "Unsupported format, bad date or end before start")
    @ApiResponse(responseCode = "403", description = "Not the owner of this data")
    @GetMapping("/user/{userId}/export/range/{format}")
    public ResponseEntity<byte[]> exportByFormat(@Parameter(description = "Id of the user whose data is exported.") @PathVariable Long userId,
                                                 @Parameter(description = "Export format: `excel` or `pdf`.") @PathVariable String format,
                                                 @Parameter(description = "Start date (yyyy-MM-dd). Omit for no lower bound.") @RequestParam(required = false) String from,
                                                 @Parameter(description = "End date (yyyy-MM-dd). Omit for no upper bound.") @RequestParam(required = false) String to,
                                                 @Parameter(description = "ISO currency code used in the report.") @RequestParam(defaultValue = "INR") String currency) {
        security.validateUserAccess(userId);
        User user = user(userId);
        ExecutiveReportDateRange range = ExecutiveReportDateRange.of(from, to);
        com.example.expensetracker.domain.report.service.ReportExportStrategy strategy = exportRegistry
                .findStrategy(format)
                .orElseThrow(() -> new IllegalArgumentException("Unsupported report format: " + format));

        log.info("Generating executive {} report via strategy for userId={}, range='{}', currency='{}'",
                format, userId, range.label(), currency);
        ExecutiveReportData data = data(user, range);
        byte[] bytes = strategy.generate(data, range, currency, user.getName());

        return ResponseEntity.ok()
                .contentType(strategy.mediaType())
                .contentLength(bytes.length)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment()
                                .filename(strategy.filename(range))
                                .build().toString())
                .body(bytes);
    }

    @Operation(summary = "Export a range report as Excel",
            description = "Executive dashboard workbook (.xlsx) for the chosen date range.")
    @ApiResponse(responseCode = "200", description = "Excel workbook")
    @ApiResponse(responseCode = "400", description = "Bad date or end before start")
    @ApiResponse(responseCode = "403", description = "Not the owner of this data")
    @GetMapping("/user/{userId}/export/range/excel")
    public ResponseEntity<byte[]> excel(@Parameter(description = "Id of the user whose data is exported.") @PathVariable Long userId,
                                        @Parameter(description = "Start date (yyyy-MM-dd). Omit for no lower bound.") @RequestParam(required = false) String from,
                                        @Parameter(description = "End date (yyyy-MM-dd). Omit for no upper bound.") @RequestParam(required = false) String to,
                                        @Parameter(description = "ISO currency code used in the report.") @RequestParam(defaultValue = "INR") String currency) {
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

    @Operation(summary = "Export a range report as PDF",
            description = "Executive dashboard PDF for the chosen date range.")
    @ApiResponse(responseCode = "200", description = "PDF document")
    @ApiResponse(responseCode = "400", description = "Bad date or end before start")
    @ApiResponse(responseCode = "403", description = "Not the owner of this data")
    @GetMapping("/user/{userId}/export/range/pdf")
    public ResponseEntity<byte[]> pdf(@Parameter(description = "Id of the user whose data is exported.") @PathVariable Long userId,
                                      @Parameter(description = "Start date (yyyy-MM-dd). Omit for no lower bound.") @RequestParam(required = false) String from,
                                      @Parameter(description = "End date (yyyy-MM-dd). Omit for no upper bound.") @RequestParam(required = false) String to,
                                      @Parameter(description = "ISO currency code used in the report.") @RequestParam(defaultValue = "INR") String currency) {
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
        return executiveReportService.loadReportData(user, range);
    }
}
