package com.example.expensetracker.controller;

import com.example.expensetracker.dto.CashFlowSummaryDto;
import com.example.expensetracker.dto.IncomeDto;
import com.example.expensetracker.dto.IncomeRequest;
import com.example.expensetracker.model.User;
import com.example.expensetracker.service.ExportService;
import com.example.expensetracker.service.ImportService;
import com.example.expensetracker.service.IncomeService;
import com.example.expensetracker.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/**
 * REST controller exposing endpoints for managing user income streams and cash flow metrics.
 *
 * <p>Supports recording salary, dividends, freelance gigs, and other income inflows.
 * Provides monthly cash flow analytics comparing earnings to expenditures.</p>
 *
 * @author Yogeshwaran
 */
@Tag(
    name = "Income",
    description = """
        Income and earnings management for Expense Tracker.
        Enables tracking of salary, freelance work, investments, business earnings, and other income streams.
        Also calculates net cash flow and savings rate by comparing income against recorded expenses.
        All endpoints require Bearer JWT authentication.
        """
)
@SecurityRequirement(name = "BearerAuth")
@RestController
@RequestMapping("/api/incomes")
public class IncomeController {

    private static final Logger log = LoggerFactory.getLogger(IncomeController.class);

    private final IncomeService incomeService;
    private final UserService userService;
    private final ExportService exportService;
    private final ImportService importService;
    private final com.example.expensetracker.security.UserSecurity userSecurity;

    /**
     * Constructs {@link IncomeController} with required services.
     *
     * @param incomeService the income service
     * @param userService the user service
     * @param exportService the export service
     * @param importService the import service
     * @param userSecurity the user security component
     */
    public IncomeController(IncomeService incomeService,
                            UserService userService,
                            ExportService exportService,
                            ImportService importService,
                            com.example.expensetracker.security.UserSecurity userSecurity) {
        this.incomeService = incomeService;
        this.userService = userService;
        this.exportService = exportService;
        this.importService = importService;
        this.userSecurity = userSecurity;
    }

    /**
     * Creates a new income entry for a user.
     *
     * @param userId user identifier
     * @param request income creation payload
     * @return response entity with created income and HTTP 201
     */
    @Operation(summary = "Create income record", description = "Records a new earnings or income entry for the user.")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Income recorded successfully",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = IncomeDto.class))),
        @ApiResponse(responseCode = "400", description = "Validation failed or user not found"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @PostMapping("/user/{userId}")
    public ResponseEntity<IncomeDto> createIncome(
            @Parameter(description = "ID of the authenticated user", required = true, example = "1")
            @PathVariable Long userId,
            @Valid @RequestBody IncomeRequest request) {
        userSecurity.validateUserAccess(userId);
        log.info("Received request to create income for userId={}: amount={}, source={}, date={}, recurring={}",
                userId, request.getAmount(), request.getSource(), request.getIncomeDate(), request.getIsRecurring());
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        IncomeDto created = incomeService.createIncome(request, user);
        log.info("Income successfully created with id={} for userId={}", created.getId(), userId);
        return new ResponseEntity<>(created, HttpStatus.CREATED);
    }

    /**
     * Retrieves all income entries for a user.
     *
     * @param userId user identifier
     * @return list of income DTOs
     */
    @Operation(summary = "Get user incomes", description = "Retrieves all income entries for the user.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "List of incomes",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, array = @ArraySchema(schema = @Schema(implementation = IncomeDto.class)))),
        @ApiResponse(responseCode = "400", description = "User not found"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @GetMapping("/user/{userId}")
    public ResponseEntity<List<IncomeDto>> getUserIncomes(
            @Parameter(description = "ID of the authenticated user", required = true, example = "1")
            @PathVariable Long userId) {
        userSecurity.validateUserAccess(userId);
        log.debug("Fetching income list for userId={}", userId);
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        List<IncomeDto> incomes = incomeService.getUserIncomes(user);
        log.info("Fetched {} income records for userId={}", incomes.size(), userId);
        return ResponseEntity.ok(incomes);
    }

    /**
     * Updates an existing income record owned by a user.
     *
     * @param incomeId income record identifier
     * @param userId user identifier
     * @param request updated income payload
     * @return updated income DTO
     */
    @Operation(summary = "Update income", description = "Modifies an existing income record owned by the user.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Income updated successfully",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = IncomeDto.class))),
        @ApiResponse(responseCode = "400", description = "Income not found or does not belong to user"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @PutMapping("/{incomeId}/user/{userId}")
    public ResponseEntity<IncomeDto> updateIncome(
            @Parameter(description = "ID of the income record", required = true, example = "1")
            @PathVariable Long incomeId,
            @Parameter(description = "ID of the authenticated user", required = true, example = "1")
            @PathVariable Long userId,
            @Valid @RequestBody IncomeRequest request) {
        userSecurity.validateUserAccess(userId);
        log.info("Received request to update income id={} for userId={}: amount={}, source={}",
                incomeId, userId, request.getAmount(), request.getSource());
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        IncomeDto updated = incomeService.updateIncome(incomeId, request, user);
        log.info("Income id={} updated successfully for userId={}", incomeId, userId);
        return ResponseEntity.ok(updated);
    }

    /**
     * Deletes an income record owned by a user.
     *
     * @param incomeId income record identifier
     * @param userId user identifier
     * @return HTTP 204 No Content
     */
    @Operation(summary = "Delete income", description = "Permanently deletes an income record owned by the user.")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Income deleted successfully"),
        @ApiResponse(responseCode = "400", description = "Income not found or does not belong to user"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @DeleteMapping("/{incomeId}/user/{userId}")
    public ResponseEntity<Void> deleteIncome(
            @Parameter(description = "ID of the income record", required = true, example = "1")
            @PathVariable Long incomeId,
            @Parameter(description = "ID of the authenticated user", required = true, example = "1")
            @PathVariable Long userId) {
        userSecurity.validateUserAccess(userId);
        log.info("Received request to delete income id={} for userId={}", incomeId, userId);
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        incomeService.deleteIncome(incomeId, user);
        log.info("Income id={} deleted successfully for userId={}", incomeId, userId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Retrieves the monthly cash flow summary for a user.
     *
     * @param userId user identifier
     * @param year calendar year (optional)
     * @param month calendar month (optional)
     * @return cash flow summary metrics
     */
    @Operation(summary = "Get monthly cash flow summary", description = "Computes total income, total expenses, net savings, and savings rate for a given month.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Cash flow summary",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = CashFlowSummaryDto.class))),
        @ApiResponse(responseCode = "400", description = "User not found"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @GetMapping("/summary/user/{userId}")
    public ResponseEntity<CashFlowSummaryDto> getCashFlowSummary(
            @Parameter(description = "ID of the authenticated user", required = true, example = "1")
            @PathVariable Long userId,
            @Parameter(description = "Year (defaults to current year)", example = "2026")
            @RequestParam(required = false) Integer year,
            @Parameter(description = "Month (1-12, defaults to current month)", example = "8")
            @RequestParam(required = false) Integer month) {
        userSecurity.validateUserAccess(userId);
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        LocalDate now = LocalDate.now();
        int targetYear = (year != null) ? year : now.getYear();
        int targetMonth = (month != null) ? month : now.getMonthValue();

        log.info("Generating cash flow summary for userId={}, period={}-{}", userId, targetYear, String.format("%02d", targetMonth));
        CashFlowSummaryDto summary = incomeService.getCashFlowSummary(user, targetYear, targetMonth);
        log.info("Cash flow summary generated for userId={}: totalIncome={}, totalExpense={}, netSavings={}, savingsRate={}%",
                userId, summary.getTotalIncome(), summary.getTotalExpense(), summary.getNetSavings(), summary.getSavingsRate());
        return ResponseEntity.ok(summary);
    }

    // ═════════════════════════════════════════════════════════════════════
    //  EXPORT & IMPORT (CSV, JSON, PDF, EXCEL)
    // ═════════════════════════════════════════════════════════════════════

    @Operation(summary = "Export incomes to CSV", description = "Generates a downloadable CSV containing all recorded income entries.")
    @GetMapping("/user/{userId}/export/csv")
    public ResponseEntity<byte[]> exportCsv(
            @Parameter(description = "User ID", required = true) @PathVariable Long userId) {
        userSecurity.validateUserAccess(userId);
        log.info("Exporting incomes to CSV for userId={}", userId);
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        byte[] bytes = exportService.exportIncomesToCsv(user);
        log.info("Incomes CSV export generated for userId={}, byteCount={}", userId, bytes != null ? bytes.length : 0);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"incomes.csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(bytes);
    }

    @Operation(summary = "Export incomes to JSON", description = "Generates a downloadable JSON array containing all recorded income entries.")
    @GetMapping("/user/{userId}/export/json")
    public ResponseEntity<byte[]> exportJson(
            @Parameter(description = "User ID", required = true) @PathVariable Long userId) {
        userSecurity.validateUserAccess(userId);
        log.info("Exporting incomes to JSON for userId={}", userId);
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        byte[] bytes = exportService.exportIncomesToJson(user);
        log.info("Incomes JSON export generated for userId={}, byteCount={}", userId, bytes != null ? bytes.length : 0);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"incomes.json\"")
                .contentType(MediaType.APPLICATION_JSON)
                .body(bytes);
    }

    @Operation(summary = "Export incomes to PDF report", description = "Generates a printable PDF income report table with calculated totals.")
    @GetMapping("/user/{userId}/export/pdf")
    public ResponseEntity<byte[]> exportPdf(
            @Parameter(description = "User ID", required = true) @PathVariable Long userId,
            @Parameter(description = "Preferred ISO currency code (e.g. INR, USD, EUR)", required = false)
            @RequestParam(value = "currency", required = false) String currencyParam,
            @RequestHeader(value = "X-Currency", required = false) String currencyHeader) {
        userSecurity.validateUserAccess(userId);
        log.info("Exporting incomes to PDF for userId={}, currencyParam={}, currencyHeader={}", userId, currencyParam, currencyHeader);
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        String preferredCurrency = (currencyParam != null && !currencyParam.isBlank()) ? currencyParam : currencyHeader;
        byte[] bytes = exportService.exportIncomesToPdf(user, preferredCurrency);
        log.info("Incomes PDF export generated for userId={}, preferredCurrency={}, byteCount={}", userId, preferredCurrency, bytes != null ? bytes.length : 0);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"incomes.pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(bytes);
    }

    @Operation(summary = "Export incomes to Excel (.xlsx)", description = "Generates a styled Microsoft Excel workbook containing all user incomes.")
    @GetMapping({"/user/{userId}/export/excel", "/user/{userId}/export/xlsx"})
    public ResponseEntity<byte[]> exportExcel(
            @Parameter(description = "User ID", required = true) @PathVariable Long userId,
            @Parameter(description = "Preferred ISO currency code (e.g. INR, USD, EUR)", required = false)
            @RequestParam(value = "currency", required = false) String currencyParam,
            @RequestHeader(value = "X-Currency", required = false) String currencyHeader) {
        userSecurity.validateUserAccess(userId);
        log.info("Exporting incomes to Excel for userId={}, currencyParam={}, currencyHeader={}", userId, currencyParam, currencyHeader);
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        String preferredCurrency = (currencyParam != null && !currencyParam.isBlank()) ? currencyParam : currencyHeader;
        byte[] bytes = exportService.exportIncomesToExcel(user, preferredCurrency);
        log.info("Incomes Excel export generated for userId={}, byteCount={}", userId, bytes != null ? bytes.length : 0);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"incomes.xlsx\"")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(bytes);
    }

    @Operation(summary = "Import incomes from CSV file", description = "Uploads a CSV file with dynamic header resolution (required: date, source, amount).")
    @PostMapping(value = "/user/{userId}/import/csv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> importCsv(
            @Parameter(description = "User ID", required = true) @PathVariable Long userId,
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        userSecurity.validateUserAccess(userId);
        log.info("Importing incomes from CSV for userId={}, filename={}, size={}", userId, file.getOriginalFilename(), file.getSize());
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Object result = importService.importIncomesFromCsv(file, user);
        log.info("CSV income import completed for userId={}", userId);
        return ResponseEntity.ok(result);
    }

    @Operation(summary = "Import incomes from JSON file", description = "Uploads a JSON array of income objects.")
    @PostMapping(value = "/user/{userId}/import/json", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> importJson(
            @Parameter(description = "User ID", required = true) @PathVariable Long userId,
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        userSecurity.validateUserAccess(userId);
        log.info("Importing incomes from JSON for userId={}, filename={}, size={}", userId, file.getOriginalFilename(), file.getSize());
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Object result = importService.importIncomesFromJson(file, user);
        log.info("JSON income import completed for userId={}", userId);
        return ResponseEntity.ok(result);
    }

    /**
     * Imports incomes from an uploaded Microsoft Excel (.xlsx / .xls) workbook for the given user.
     *
     * @param userId target user ID
     * @param file uploaded Excel spreadsheet
     * @return summary map containing imported count, failed row count, and per-row error messages
     */
    @Operation(summary = "Import incomes from Excel file (.xlsx / .xls)", description = "Uploads a Microsoft Excel workbook containing income entries. Supports dynamic header detection and per-row error tracking.")
    @PostMapping(value = {"/user/{userId}/import/excel", "/user/{userId}/import/xlsx"}, consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> importExcel(
            @Parameter(description = "User ID", required = true) @PathVariable Long userId,
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        userSecurity.validateUserAccess(userId);
        log.info("Importing incomes from Excel for userId={}, filename={}, size={}", userId, file.getOriginalFilename(), file.getSize());
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Object result = importService.importIncomesFromExcel(file, user);
        log.info("Excel income import completed for userId={}", userId);
        return ResponseEntity.ok(result);
    }
}
