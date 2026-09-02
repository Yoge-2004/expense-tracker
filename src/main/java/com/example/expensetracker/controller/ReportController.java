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

    private final MonthlyReportService monthlyReportService;
    private final ExportService exportService;
    private final UserService userService;

    /**
     * Constructs {@link ReportController} with required services.
     *
     * @param monthlyReportService monthly report service
     * @param exportService export service
     * @param userService user service
     */
    public ReportController(MonthlyReportService monthlyReportService,
                            ExportService exportService,
                            UserService userService) {
        this.monthlyReportService = monthlyReportService;
        this.exportService = exportService;
        this.userService = userService;
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

        LocalDate now = LocalDate.now();
        int y = year != null ? year : now.getYear();
        int m = month != null ? month : now.getMonthValue();

        MonthlyReportDto report = monthlyReportService.generateMonthlyReport(userId, y, m);
        return ResponseEntity.ok(report);
    }

    /**
     * Downloads the monthly financial report as a standalone HTML document.
     *
     * @param userId user identifier
     * @param year calendar year (defaults to current year)
     * @param month calendar month (defaults to current month)
     * @return response entity containing HTML report file attachment
     */
    @Operation(
        summary = "Get monthly financial report as HTML",
        description = "Generates and serves the executive monthly financial summary template as a downloadable HTML document with visual progress bars and tables."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "HTML report rendered successfully",
            content = @Content(mediaType = MediaType.TEXT_HTML_VALUE, schema = @Schema(type = "string"))),
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

        LocalDate now = LocalDate.now();
        int y = year != null ? year : now.getYear();
        int m = month != null ? month : now.getMonthValue();

        String html = monthlyReportService.generateMonthlyReportHtml(userId, y, m);
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_HTML)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"monthly-report-" + y + "-" + m + ".html\"")
                .body(html);
    }

    /**
     * Triggers immediate dispatch of the executive monthly financial report email to the user.
     *
     * @param userId user identifier
     * @param year calendar year (defaults to current year)
     * @param month calendar month (defaults to current month)
     * @return response entity with status confirmation
     */
    @Operation(
        summary = "Trigger sending monthly financial report email",
        description = "Dispatches the executive monthly financial summary report directly to the user's registered email address."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Email dispatch processed successfully"),
        @ApiResponse(responseCode = "400", description = "User not found"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @PostMapping("/monthly/user/{userId}/send-email")
    public ResponseEntity<Map<String, String>> sendMonthlyReportEmail(
            @Parameter(description = "ID of the authenticated user", required = true, example = "1")
            @PathVariable Long userId,
            @Parameter(description = "Calendar year (defaults to current year)", example = "2026")
            @RequestParam(required = false) Integer year,
            @Parameter(description = "Calendar month 1-12 (defaults to current month)", example = "8")
            @RequestParam(required = false) Integer month) {

        LocalDate now = LocalDate.now();
        int y = year != null ? year : now.getYear();
        int m = month != null ? month : now.getMonthValue();

        monthlyReportService.sendMonthlyReportEmail(userId, y, m);
        return ResponseEntity.ok(Collections.singletonMap("message", "Monthly report email successfully sent."));
    }

    /**
     * Exports a comprehensive multi-sheet Microsoft Excel (.xlsx) financial workbook.
     *
     * @param userId user identifier
     * @return raw Excel workbook binary attachment
     */
    @Operation(
        summary = "Export comprehensive financial workbook to Excel (.xlsx)",
        description = "Generates a 4-sheet financial spreadsheet containing Overview KPI metrics, Incomes, Expenses, and Savings Goals."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Excel workbook generated successfully"),
        @ApiResponse(responseCode = "400", description = "User not found"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @GetMapping({"/user/{userId}/export/excel", "/user/{userId}/export/xlsx"})
    public ResponseEntity<byte[]> exportFinancialStatementExcel(
            @Parameter(description = "ID of the authenticated user", required = true, example = "1")
            @PathVariable Long userId) {
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        byte[] bytes = exportService.exportFinancialStatementExcel(user);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"financial-summary.xlsx\"")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(bytes);
    }

    /**
     * Exports an executive financial statement report in PDF format.
     *
     * @param userId user identifier
     * @return raw PDF document binary attachment
     */
    @Operation(
        summary = "Export executive financial statement to PDF",
        description = "Generates an executive PDF report containing Cash Flow KPIs, Incomes breakdown, Expenses breakdown, and Savings Goals status."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "PDF statement generated successfully"),
        @ApiResponse(responseCode = "400", description = "User not found"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @GetMapping("/user/{userId}/export/pdf")
    public ResponseEntity<byte[]> exportFinancialStatementPdf(
            @Parameter(description = "ID of the authenticated user", required = true, example = "1")
            @PathVariable Long userId) {
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        byte[] bytes = exportService.exportFinancialStatementPdf(user);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"financial-statement.pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(bytes);
    }
}
