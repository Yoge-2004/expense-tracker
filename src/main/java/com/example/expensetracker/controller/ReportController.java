package com.example.expensetracker.controller;

import com.example.expensetracker.dto.MonthlyReportDto;
import com.example.expensetracker.model.User;
import com.example.expensetracker.service.ExportService;
import com.example.expensetracker.service.MonthlyReportService;
import com.example.expensetracker.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Collections;
import java.util.Map;

/**
 * REST controller exposing endpoints for generating and dispatching executive monthly financial reports.
 *
 * <p>Provides JSON summaries, standalone responsive HTML downloads with visual cash flow and savings
 * milestones, and manual triggers for email dispatch.</p>
 *
 * @author Yogeshwaran
 */
@Tag(
    name = "Reports",
    description = """
        Monthly financial summary reports and automated email dispatches.
        Aggregates multi-dimensional financial intelligence: expenses, incomes, net cash flow,
        savings rate, category breakdowns, budget limits, and active savings goals.
        All endpoints require Bearer JWT authentication.
        """
)
@SecurityRequirement(name = "BearerAuth")
@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private static final Logger log = LoggerFactory.getLogger(ReportController.class);

    private final MonthlyReportService monthlyReportService;
    private final ExportService exportService;
    private final UserService userService;
    private final com.example.expensetracker.security.UserSecurity userSecurity;

    /**
     * Constructs {@link ReportController} with required services.
     *
     * @param monthlyReportService monthly report service
     * @param exportService export service
     * @param userService user service
     * @param userSecurity user security component
     */
    public ReportController(MonthlyReportService monthlyReportService,
                            ExportService exportService,
                            UserService userService,
                            com.example.expensetracker.security.UserSecurity userSecurity) {
        this.monthlyReportService = monthlyReportService;
        this.exportService = exportService;
        this.userService = userService;
        this.userSecurity = userSecurity;
    }

    /**
     * Generates a consolidated monthly financial report in JSON format.
     *
     * @param userId user identifier
     * @param year calendar year (defaults to current year)
     * @param month calendar month (defaults to current month)
     * @return response entity containing {@link MonthlyReportDto}
     */
    @Operation(
        summary = "Get monthly financial report JSON",
        description = "Aggregates total inflow, outflow, net savings, savings rate %, category allocations, budget status, and top expenses."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Monthly report generated successfully",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = MonthlyReportDto.class))),
        @ApiResponse(responseCode = "400", description = "User not found or invalid period parameters"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @GetMapping("/monthly/user/{userId}")
    public ResponseEntity<MonthlyReportDto> getMonthlyReport(
            @Parameter(description = "ID of the authenticated user", required = true, example = "1")
            @PathVariable Long userId,
            @Parameter(description = "Calendar year (defaults to current year)", example = "2026")
            @RequestParam(required = false) Integer year,
            @Parameter(description = "Calendar month 1-12 (defaults to current month)", example = "8")
            @RequestParam(required = false) Integer month) {
        userSecurity.validateUserAccess(userId);

        LocalDate now = LocalDate.now();
        int y = year != null ? year : now.getYear();
        int m = month != null ? month : now.getMonthValue();

        log.info("Generating monthly financial report JSON for userId={}, period={}-{}", userId, y, m);
        MonthlyReportDto report = monthlyReportService.generateMonthlyReport(userId, y, m);
        log.info("Monthly report generated for userId={}: totalInflow={}, totalOutflow={}, netSavings={}",
                userId, report.getTotalIncome(), report.getTotalOutflow(), report.getNetCashFlow());
        return ResponseEntity.ok(report);
    }

    /**
     * Exports an executive monthly financial statement as a standalone styled HTML page.
     *
     * @param userId user identifier
     * @param year calendar year (defaults to current year)
     * @param month calendar month (defaults to current month)
     * @return standalone HTML response
     */
    @Operation(
        summary = "Export monthly statement to standalone HTML",
        description = "Returns a beautifully styled executive monthly financial report formatted for printing or offline presentation."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "HTML statement returned successfully"),
        @ApiResponse(responseCode = "400", description = "User not found"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @GetMapping(value = "/monthly/user/{userId}/html", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> getMonthlyReportHtml(
            @Parameter(description = "ID of the authenticated user", required = true, example = "1")
            @PathVariable Long userId,
            @Parameter(description = "Calendar year (defaults to current year)", example = "2026")
            @RequestParam(required = false) Integer year,
            @Parameter(description = "Calendar month 1-12 (defaults to current month)", example = "8")
            @RequestParam(required = false) Integer month) {
        userSecurity.validateUserAccess(userId);

        LocalDate now = LocalDate.now();
        int y = year != null ? year : now.getYear();
        int m = month != null ? month : now.getMonthValue();

        log.info("Generating monthly report HTML for userId={}, period={}-{}", userId, y, m);
        String html = monthlyReportService.generateMonthlyReportHtml(userId, y, m);
        log.info("Monthly report HTML generated for userId={}, length={}", userId, html.length());
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"financial-report-" + y + "-" + m + ".html\"")
                .body(html);
    }

    /**
     * Manually triggers immediate dispatch of the monthly executive financial summary email.
     *
     * @param userId user identifier
     * @param year calendar year (defaults to current year)
     * @param month calendar month (defaults to current month)
     * @return operation status confirmation
     */
    @Operation(
        summary = "Send monthly financial summary email",
        description = "Immediately dispatches the comprehensive monthly financial statement HTML email to the authenticated user's address."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Email triggered successfully"),
        @ApiResponse(responseCode = "400", description = "User not found"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @PostMapping("/monthly/user/{userId}/send-email")
    public ResponseEntity<Map<String, Object>> sendMonthlyReportEmail(
            @Parameter(description = "ID of the authenticated user", required = true, example = "1")
            @PathVariable Long userId,
            @Parameter(description = "Calendar year (defaults to current year)", example = "2026")
            @RequestParam(required = false) Integer year,
            @Parameter(description = "Calendar month 1-12 (defaults to current month)", example = "8")
            @RequestParam(required = false) Integer month) {
        userSecurity.validateUserAccess(userId);

        LocalDate now = LocalDate.now();
        int y = year != null ? year : now.getYear();
        int m = month != null ? month : now.getMonthValue();

        log.info("Triggering monthly report email for userId={}, period={}-{}", userId, y, m);
        monthlyReportService.sendMonthlyReportEmail(userId, y, m);
        log.info("Monthly report email dispatched successfully for userId={}", userId);
        return ResponseEntity.ok(Collections.singletonMap("message", "Monthly report email successfully sent."));
    }

    /**
     * Exports a comprehensive 4-sheet PowerBI-style financial intelligence dashboard workbook (.xlsx).
     *
     * @param userId user identifier
     * @param currencyParam optional query parameter for display currency (e.g. INR, USD, EUR)
     * @param currencyHeader optional request header for display currency
     * @return raw Excel workbook binary attachment
     */
    @Operation(
        summary = "Export comprehensive financial workbook to Excel (.xlsx)",
        description = "Generates a 4-sheet financial spreadsheet containing Overview KPI metrics, Incomes, Expenses, and Savings Goals with dynamic currency resolution."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Excel workbook generated successfully"),
        @ApiResponse(responseCode = "400", description = "User not found"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @GetMapping({"/user/{userId}/export/excel", "/user/{userId}/export/xlsx"})
    public ResponseEntity<byte[]> exportFinancialStatementExcel(
            @Parameter(description = "ID of the authenticated user", required = true, example = "1")
            @PathVariable Long userId,
            @Parameter(description = "Preferred ISO currency code (e.g. INR, USD, EUR)", required = false)
            @RequestParam(value = "currency", required = false) String currencyParam,
            @RequestHeader(value = "X-Currency", required = false) String currencyHeader) {
        userSecurity.validateUserAccess(userId);
        log.info("Exporting financial statement Excel for userId={}, currencyParam={}, currencyHeader={}",
                userId, currencyParam, currencyHeader);
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        String preferredCurrency = (currencyParam != null && !currencyParam.isBlank()) ? currencyParam : currencyHeader;
        byte[] bytes = exportService.exportFinancialStatementExcel(user, preferredCurrency);
        log.info("Financial statement Excel generated for userId={}, byteCount={}", userId, bytes != null ? bytes.length : 0);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"financial-summary.xlsx\"")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(bytes);
    }

    /**
     * Exports an executive financial statement report in PDF format with dynamic currency resolution.
     *
     * @param userId user identifier
     * @param currencyParam optional query parameter for display currency
     * @param currencyHeader optional request header for display currency
     * @return raw PDF document binary attachment
     */
    @Operation(
        summary = "Export executive financial statement to PDF",
        description = "Generates an executive PDF report containing Cash Flow KPIs, Incomes breakdown, Expenses breakdown, and Savings Goals status with dynamic currency resolution."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "PDF statement generated successfully"),
        @ApiResponse(responseCode = "400", description = "User not found"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @GetMapping("/user/{userId}/export/pdf")
    public ResponseEntity<byte[]> exportFinancialStatementPdf(
            @Parameter(description = "ID of the authenticated user", required = true, example = "1")
            @PathVariable Long userId,
            @Parameter(description = "Preferred ISO currency code (e.g. INR, USD, EUR)", required = false)
            @RequestParam(value = "currency", required = false) String currencyParam,
            @RequestHeader(value = "X-Currency", required = false) String currencyHeader) {
        userSecurity.validateUserAccess(userId);
        log.info("Exporting financial statement PDF for userId={}, currencyParam={}, currencyHeader={}",
                userId, currencyParam, currencyHeader);
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        String preferredCurrency = (currencyParam != null && !currencyParam.isBlank()) ? currencyParam : currencyHeader;
        byte[] bytes = exportService.exportFinancialStatementPdf(user, preferredCurrency);
        log.info("Financial statement PDF generated for userId={}, byteCount={}", userId, bytes != null ? bytes.length : 0);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"financial-statement.pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(bytes);
    }
}
