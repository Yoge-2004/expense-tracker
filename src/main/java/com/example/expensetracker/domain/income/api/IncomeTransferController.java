package com.example.expensetracker.domain.income.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.example.expensetracker.domain.income.model.Income;
import com.example.expensetracker.domain.income.service.IncomeExportService;
import com.example.expensetracker.domain.report.service.ImportService;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.domain.user.service.UserService;
import com.example.expensetracker.infrastructure.security.UserSecurity;


/**
 * Dedicated REST controller for income export and import operations across CSV, JSON, PDF, and Excel formats.
 * Fulfills the Single Responsibility Principle (SRP) by isolating data transformation and transfer
 * endpoints from transactional income CRUD.
 *
 * @author Yogeshwaran
 */
@Tag(
    name = "Income Transfers",
    description = "Export and import endpoints for user income datasets across CSV, JSON, PDF, and Excel formats."
)
@Slf4j
@RestController
@RequestMapping("/api/incomes")
@RequiredArgsConstructor
@SecurityRequirement(name = "BearerAuth")
public class IncomeTransferController {

    private final UserService userService;
    private final IncomeExportService exportService;
    private final ImportService importService;
    private final UserSecurity userSecurity;

    @Operation(summary = "Export incomes to CSV",
        description = "Generates a downloadable CSV containing all recorded income entries.")
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
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .contentLength(bytes != null ? bytes.length : 0)
                .body(bytes);
    }

    @Operation(summary = "Export incomes to JSON",
        description = "Generates a downloadable JSON array containing all recorded income entries.")
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
                .contentLength(bytes != null ? bytes.length : 0)
                .body(bytes);
    }

    @SuppressWarnings({"UnknownHttpHeaderInspection", "SpringMVCUnknownHttpHeaderInspection"})
    @Operation(summary = "Export incomes to PDF report",
        description = "Generates a printable PDF income report table with calculated totals.")
    @GetMapping("/user/{userId}/export/pdf")
    public ResponseEntity<byte[]> exportPdf(
            @Parameter(description = "User ID", required = true) @PathVariable Long userId,
            @Parameter(description = "Preferred ISO currency code (e.g. INR, USD, EUR)")
            @RequestParam(value = "currency", required = false) String currencyParam,
            @SuppressWarnings("all") @RequestHeader(value = "X-Currency", required = false) String currencyHeader) {
        userSecurity.validateUserAccess(userId);
        log.info("Exporting incomes to PDF for userId={}, currencyParam={}, currencyHeader={}",
                userId, currencyParam, currencyHeader);
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        String preferredCurrency = (currencyParam != null && !currencyParam.isBlank()) ? currencyParam : currencyHeader;
        byte[] bytes = exportService.exportIncomesToPdf(user, preferredCurrency);
        log.info("Incomes PDF export generated for userId={}, preferredCurrency={}, byteCount={}",
                userId, preferredCurrency, bytes != null ? bytes.length : 0);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"incomes.pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .contentLength(bytes != null ? bytes.length : 0)
                .body(bytes);
    }

    @SuppressWarnings({"UnknownHttpHeaderInspection", "SpringMVCUnknownHttpHeaderInspection"})
    @Operation(summary = "Export incomes to Excel (.xlsx)",
        description = "Generates a styled Microsoft Excel workbook containing all user incomes.")
    @GetMapping({"/user/{userId}/export/excel", "/user/{userId}/export/xlsx"})
    public ResponseEntity<byte[]> exportExcel(
            @Parameter(description = "User ID", required = true) @PathVariable Long userId,
            @Parameter(description = "Preferred ISO currency code (e.g. INR, USD, EUR)")
            @RequestParam(value = "currency", required = false) String currencyParam,
            @SuppressWarnings("all") @RequestHeader(value = "X-Currency", required = false) String currencyHeader) {
        userSecurity.validateUserAccess(userId);
        log.info("Exporting incomes to Excel for userId={}, currencyParam={}, currencyHeader={}",
                userId, currencyParam, currencyHeader);
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        String preferredCurrency = (currencyParam != null && !currencyParam.isBlank()) ? currencyParam : currencyHeader;
        byte[] bytes = exportService.exportIncomesToExcel(user, preferredCurrency);
        log.info("Incomes Excel export generated for userId={}, byteCount={}",
                userId, bytes != null ? bytes.length : 0);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"incomes.xlsx\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .contentLength(bytes != null ? bytes.length : 0)
                .body(bytes);
    }

    @Operation(summary = "Import incomes from CSV file",
        description = "Uploads a CSV file with dynamic header resolution (required: date, source, amount).")
    @PostMapping(value = "/user/{userId}/import/csv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> importCsv(
            @Parameter(description = "User ID", required = true) @PathVariable Long userId,
            @RequestParam("file") MultipartFile file) {
        userSecurity.validateUserAccess(userId);
        log.info("Importing incomes from CSV for userId={}, filename={}, size={}",
                userId, file.getOriginalFilename(), file.getSize());
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
            @RequestParam("file") MultipartFile file) {
        userSecurity.validateUserAccess(userId);
        log.info("Importing incomes from JSON for userId={}, filename={}, size={}",
                userId, file.getOriginalFilename(), file.getSize());
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Object result = importService.importIncomesFromJson(file, user);
        log.info("JSON income import completed for userId={}", userId);
        return ResponseEntity.ok(result);
    }

    @Operation(summary = "Import incomes from Excel file (.xlsx / .xls)",
        description = "Uploads a Microsoft Excel workbook containing income entries. "
                + "Supports dynamic header detection and per-row error tracking.")
    @PostMapping(value = {"/user/{userId}/import/excel", "/user/{userId}/import/xlsx"},
                 consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> importExcel(
            @Parameter(description = "User ID", required = true) @PathVariable Long userId,
            @RequestParam("file") MultipartFile file) {
        userSecurity.validateUserAccess(userId);
        log.info("Importing incomes from Excel for userId={}, filename={}, size={}",
                userId, file.getOriginalFilename(), file.getSize());
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Object result = importService.importIncomesFromExcel(file, user);
        log.info("Excel income import completed for userId={}", userId);
        return ResponseEntity.ok(result);
    }
}
