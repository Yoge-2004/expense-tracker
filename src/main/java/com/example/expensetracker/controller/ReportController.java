package com.example.expensetracker.controller;

import com.example.expensetracker.dto.MonthlyReportDto;
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

@Tag(
    name = "Reports",
    description = "Monthly financial summaries and complete financial exports. All endpoints require Bearer JWT authentication."
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
    private final RangeReportController rangeReportController;

    public ReportController(MonthlyReportService monthlyReportService,
                            ExportService exportService,
                            UserService userService,
                            com.example.expensetracker.security.UserSecurity userSecurity,
                            RangeReportController rangeReportController) {
        this.monthlyReportService = monthlyReportService;
        this.exportService = exportService;
        this.userService = userService;
        this.userSecurity = userSecurity;
        this.rangeReportController = rangeReportController;
    }

    @Operation(summary = "Get monthly financial report JSON",
            description = "Aggregates total inflow, outflow, net savings, savings rate, category allocations, budget status, and top expenses.")
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
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month) {
        userSecurity.validateUserAccess(userId);
        LocalDate now = LocalDate.now();
        int y = year != null ? year : now.getYear();
        int m = month != null ? month : now.getMonthValue();
        log.info("Generating monthly financial report JSON for userId={}, period={}-{}", userId, y, m);
        return ResponseEntity.ok(monthlyReportService.generateMonthlyReport(userId, y, m));
    }

    @Operation(summary = "Export monthly statement to standalone HTML")
    @GetMapping(value = "/monthly/user/{userId}/html", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> getMonthlyReportHtml(
            @PathVariable Long userId,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month) {
        userSecurity.validateUserAccess(userId);
        LocalDate now = LocalDate.now();
        int y = year != null ? year : now.getYear();
        int m = month != null ? month : now.getMonthValue();
        String html = monthlyReportService.generateMonthlyReportHtml(userId, y, m);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"financial-report-" + y + "-" + m + ".html\"")
                .body(html);
    }

    @Operation(summary = "Send monthly financial summary email")
    @PostMapping("/monthly/user/{userId}/send-email")
    public ResponseEntity<Map<String, Object>> sendMonthlyReportEmail(
            @PathVariable Long userId,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month) {
        userSecurity.validateUserAccess(userId);
        LocalDate now = LocalDate.now();
        int y = year != null ? year : now.getYear();
        int m = month != null ? month : now.getMonthValue();
        monthlyReportService.sendMonthlyReportEmail(userId, y, m);
        return ResponseEntity.ok(Collections.singletonMap("message", "Monthly report email successfully sent."));
    }

    @Operation(summary = "Export complete financial workbook to Excel (.xlsx)",
            description = "Includes expenses, incomes, savings goals, subscriptions, budgets, and cash-flow summary.")
    @GetMapping({"/user/{userId}/export/excel", "/user/{userId}/export/xlsx"})
    public ResponseEntity<byte[]> exportFinancialStatementExcel(
            @PathVariable Long userId,
            @RequestParam(value = "currency", required = false) String currencyParam,
            @RequestHeader(value = "X-Currency", required = false) String currencyHeader) {
        String preferredCurrency = (currencyParam != null && !currencyParam.isBlank()) ? currencyParam : currencyHeader;
        ResponseEntity<byte[]> response = rangeReportController.excel(userId, null, null,
                preferredCurrency == null || preferredCurrency.isBlank() ? "INR" : preferredCurrency);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"financial-summary.xlsx\"")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(response.getBody());
    }

    @Operation(summary = "Export complete financial statement to PDF",
            description = "Includes expenses, incomes, savings goals, subscriptions, budgets, and cash-flow summary.")
    @GetMapping("/user/{userId}/export/pdf")
    public ResponseEntity<byte[]> exportFinancialStatementPdf(
            @PathVariable Long userId,
            @RequestParam(value = "currency", required = false) String currencyParam,
            @RequestHeader(value = "X-Currency", required = false) String currencyHeader) {
        String preferredCurrency = (currencyParam != null && !currencyParam.isBlank()) ? currencyParam : currencyHeader;
        ResponseEntity<byte[]> response = rangeReportController.pdf(userId, null, null,
                preferredCurrency == null || preferredCurrency.isBlank() ? "INR" : preferredCurrency);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"financial-statement.pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(response.getBody());
    }
}
