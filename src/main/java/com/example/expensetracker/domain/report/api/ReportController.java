package com.example.expensetracker.domain.report.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.ContentDisposition;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.Map;

import com.example.expensetracker.domain.report.dto.MonthlyReportDto;
import com.example.expensetracker.domain.report.service.FinancialStatementExportService;
import com.example.expensetracker.domain.report.service.MonthlyReportService;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.domain.user.service.UserService;
import com.example.expensetracker.infrastructure.security.UserSecurity;



@Tag(
    name = "Reports",
    description = "Monthly financial summaries and complete financial exports. All endpoints require Bearer JWT."
)
@Slf4j
@RequiredArgsConstructor
@SecurityRequirement(name = "BearerAuth")
@Transactional(readOnly = true)
@RestController
@RequestMapping("/api/reports")
public class ReportController {

    //noinspection UnknownHttpHeader,SpringJavaUnknownHttpHeaderInspection
    private static final String CURRENCY_HEADER_KEY = "X-Currency";

    private final MonthlyReportService monthlyReportService;
    private final FinancialStatementExportService financialStatementExportService;
    private final UserService userService;
    private final UserSecurity userSecurity;

    @Operation(summary = "Get monthly financial report JSON",
            description = "Aggregates total inflow, outflow, net savings, savings rate, " +
                    "allocations, budgets, top items.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Monthly report generated successfully",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                               schema = @Schema(implementation = MonthlyReportDto.class))),
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
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"financial-report-" + y + "-" + m + ".html\"")
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
        return ResponseEntity.ok(Map.of("message", "Monthly report email successfully sent."));
    }

    @Operation(summary = "Export complete financial workbook to Excel (.xlsx)",
            description = "Includes expenses, incomes, savings goals, subscriptions, budgets, and cash-flow summary.")
    @GetMapping({"/user/{userId}/export/excel", "/user/{userId}/export/xlsx"})
    public ResponseEntity<byte[]> exportFinancialStatementExcel(
            @PathVariable Long userId,
            @RequestParam(value = "currency", required = false) String currencyParam,
            @RequestHeader(required = false) HttpHeaders headers) {
        String currencyHeader = headers != null ? headers.getFirst(CURRENCY_HEADER_KEY) : null;
        String currency = preferredCurrency(currencyParam, currencyHeader);
        User user = reportUser(userId);
        byte[] payload = financialStatementExportService.exportFinancialStatementExcel(user, currency);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename("financial-summary.xlsx").build().toString())
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .contentLength(payload.length)
                .body(payload);
    }

    @Operation(summary = "Export complete financial statement to PDF",
            description = "Includes expenses, incomes, savings goals, subscriptions, budgets, and cash-flow summary.")
    @GetMapping("/user/{userId}/export/pdf")
    public ResponseEntity<byte[]> exportFinancialStatementPdf(
            @PathVariable Long userId,
            @RequestParam(value = "currency", required = false) String currencyParam,
            @RequestHeader(required = false) HttpHeaders headers) {
        String currencyHeader = headers != null ? headers.getFirst(CURRENCY_HEADER_KEY) : null;
        String currency = preferredCurrency(currencyParam, currencyHeader);
        User user = reportUser(userId);
        byte[] payload = financialStatementExportService.exportFinancialStatementPdf(user, currency);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename("financial-statement.pdf").build().toString())
                .contentType(MediaType.APPLICATION_PDF)
                .contentLength(payload.length)
                .body(payload);
    }

    private String preferredCurrency(String requestedCurrency, String headerCurrency) {
        if (requestedCurrency != null && !requestedCurrency.isBlank()) {
            return requestedCurrency;
        }
        if (headerCurrency != null && !headerCurrency.isBlank()) {
            return headerCurrency;
        }
        return "INR";
    }

    private User reportUser(Long userId) {
        userSecurity.validateUserAccess(userId);
        return userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }
}
