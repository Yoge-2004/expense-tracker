package com.example.expensetracker.domain.report.api;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import com.example.expensetracker.domain.report.service.ExecutiveReportData;
import com.example.expensetracker.domain.report.service.ExecutiveReportDateRange;
import com.example.expensetracker.domain.report.service.ExecutiveReportService;
import com.example.expensetracker.domain.report.service.ReportExportRegistry;
import com.example.expensetracker.domain.report.service.ReportExportStrategy;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.domain.user.security.UserSecurity;
import com.example.expensetracker.domain.user.service.UserProfileService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * REST controller exposing executive range-based financial exports.
 * Orchestrates ledger extraction and delegates document rendering
 * polymorphically to registered {@link ReportExportStrategy} beans via {@link ReportExportRegistry}.
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
@RequiredArgsConstructor
@Transactional(readOnly = true)
@RestController
@RequestMapping({"/api/reports", "/api/expenses"})
public class RangeReportController {

    private final ExecutiveReportService executiveReportService;
    private final UserProfileService users;
    private final UserSecurity security;
    private final ReportExportRegistry exportRegistry;

    /**
     * Polymorphic range export endpoint following the Open/Closed Principle (OCP).
     * Any registered {@link ReportExportStrategy} can be invoked dynamically without code changes.
     */
    @Operation(summary = "Export a range report in any supported format",
            description = "Looks up the export strategy for `format` (`excel` or `pdf`) and returns "
                    + "the report as a file download.")
    @ApiResponse(responseCode = "200", description = "Report file")
    @ApiResponse(responseCode = "400", description = "Unsupported format, bad date or end before start")
    @ApiResponse(responseCode = "403", description = "Not the owner of this data")
    @GetMapping("/user/{userId}/export/range/{format}")
    public ResponseEntity<byte[]> exportByFormat(
            @Parameter(description = "Id of the user whose data is exported.") @PathVariable Long userId,
            @Parameter(description = "Export format: `excel` or `pdf`.") @PathVariable String format,
            @Parameter(description = "Start date (yyyy-MM-dd). Omit for no lower bound.") @RequestParam(required = false) String from,
            @Parameter(description = "End date (yyyy-MM-dd). Omit for no upper bound.") @RequestParam(required = false) String to,
            @Parameter(description = "ISO currency code used in the report.") @RequestParam(defaultValue = "INR") String currency) {
        return exportWithStrategy(userId, format, from, to, currency, null);
    }

    @Operation(summary = "Export a range report as Excel",
            description = "Executive dashboard workbook (.xlsx) for the chosen date range.")
    @ApiResponse(responseCode = "200", description = "Excel workbook")
    @ApiResponse(responseCode = "400", description = "Bad date or end before start")
    @ApiResponse(responseCode = "403", description = "Not the owner of this data")
    @GetMapping("/user/{userId}/export/range/excel")
    public ResponseEntity<byte[]> excel(
            @Parameter(description = "Id of the user whose data is exported.") @PathVariable Long userId,
            @Parameter(description = "Start date (yyyy-MM-dd). Omit for no lower bound.") @RequestParam(required = false) String from,
            @Parameter(description = "End date (yyyy-MM-dd). Omit for no upper bound.") @RequestParam(required = false) String to,
            @Parameter(description = "ISO currency code used in the report.") @RequestParam(defaultValue = "INR") String currency) {
        return exportWithStrategy(userId, "excel", from, to, currency, null);
    }

    @Operation(summary = "Export a range report as PDF",
            description = "Executive dashboard PDF for the chosen date range.")
    @ApiResponse(responseCode = "200", description = "PDF document")
    @ApiResponse(responseCode = "400", description = "Bad date or end before start")
    @ApiResponse(responseCode = "403", description = "Not the owner of this data")
    @GetMapping("/user/{userId}/export/range/pdf")
    public ResponseEntity<byte[]> pdf(
            @Parameter(description = "Id of the user whose data is exported.") @PathVariable Long userId,
            @Parameter(description = "Start date (yyyy-MM-dd). Omit for no lower bound.") @RequestParam(required = false) String from,
            @Parameter(description = "End date (yyyy-MM-dd). Omit for no upper bound.") @RequestParam(required = false) String to,
            @Parameter(description = "ISO currency code used in the report.") @RequestParam(defaultValue = "INR") String currency) {
        return exportWithStrategy(userId, "pdf", from, to, currency, "ExpenseTracker_Executive_Report.pdf");
    }

    private ResponseEntity<byte[]> exportWithStrategy(
            Long userId, String format, String from, String to, String currency, String filenameOverride) {
        security.validateUserAccess(userId);
        User user = user(userId);
        ExecutiveReportDateRange range = ExecutiveReportDateRange.of(from, to);
        ReportExportStrategy strategy = exportRegistry
                .findStrategy(format)
                .orElseThrow(() -> new IllegalArgumentException("Unsupported report format: " + format));

        log.info("Generating executive {} report via strategy for userId={}, range='{}', currency='{}'",
                format, userId, range.label(), currency);
        ExecutiveReportData data = executiveReportService.loadReportData(user, range);
        byte[] bytes = strategy.generate(data, range, currency, user.getName());
        String filename = filenameOverride != null ? filenameOverride : strategy.filename(range);
        log.info("Executive {} report generated successfully for userId={}, size={} bytes",
                format, userId, bytes.length);

        return ResponseEntity.ok()
                .contentType(strategy.mediaType())
                .contentLength(bytes.length)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment()
                                .filename(filename)
                                .build().toString())
                .body(bytes);
    }

    private User user(Long id) {
        return users.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }
}
