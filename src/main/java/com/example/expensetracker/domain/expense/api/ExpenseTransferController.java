package com.example.expensetracker.domain.expense.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.Map;

import com.example.expensetracker.domain.expense.model.Category;
import com.example.expensetracker.domain.expense.model.Expense;
import com.example.expensetracker.domain.report.service.ExportService;
import com.example.expensetracker.domain.report.service.ImportService;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.domain.user.service.UserService;
import com.example.expensetracker.infrastructure.security.UserSecurity;



/**
 * Controller dedicated exclusively to expense data file exchange (bulk export and import).
 *
 * <p>Enforces Single Responsibility Principle (SRP) by decoupling multi-format serialization
 * and multipart file handling from the main expense record transaction operations.</p>
 *
 * @author Yogeshwaran
 */
@Tag(
    name        = "Expense Data Transfer",
    description = "Export and import expense datasets in CSV, JSON, and Excel formats, as well as bank statement reconciliation."
)
@Slf4j
@RequiredArgsConstructor
@SecurityRequirement(name = "BearerAuth")
@RestController
@RequestMapping("/api/expenses")
public class ExpenseTransferController {

    private final ExportService exportService;
    private final ImportService importService;
    private final UserService userService;
    private final UserSecurity userSecurity;

    @Operation(summary = "Export expenses to CSV")
    @GetMapping("/user/{userId}/export/csv")
    public ResponseEntity<byte[]> exportCsv(@PathVariable Long userId) {
        userSecurity.validateUserAccess(userId);
        log.info("Exporting expenses to CSV for userId={}", userId);
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        byte[] bytes = exportService.exportExpensesToCsv(user);
        log.info("Expenses CSV export generated for userId={}, byteCount={}", userId, bytes != null ? bytes.length : 0);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"expenses.csv\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .contentLength(bytes != null ? bytes.length : 0)
                .body(bytes);
    }

    @Operation(summary = "Export expenses to JSON")
    @GetMapping("/user/{userId}/export/json")
    public ResponseEntity<byte[]> exportJson(@PathVariable Long userId) {
        userSecurity.validateUserAccess(userId);
        log.info("Exporting expenses to JSON for userId={}", userId);
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        byte[] bytes = exportService.exportExpensesToJson(user);
        log.info("Expenses JSON export generated for userId={}, byteCount={}",
                userId, bytes != null ? bytes.length : 0);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"expenses.json\"")
                .contentType(MediaType.APPLICATION_JSON)
                .contentLength(bytes != null ? bytes.length : 0)
                .body(bytes);
    }

    @Operation(summary = "Export expenses to PDF report")
    @GetMapping("/user/{userId}/export/pdf")
    public ResponseEntity<byte[]> exportPdf(
            @PathVariable Long userId,
            @RequestParam(value = "currency", required = false) String currencyParam,
            @RequestHeader(value = "X-Currency", required = false) String currencyHeader) {
        userSecurity.validateUserAccess(userId);
        log.info("Exporting expenses to PDF for userId={}, currencyParam={}, currencyHeader={}",
                userId, currencyParam, currencyHeader);
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        String preferredCurrency = (currencyParam != null && !currencyParam.isBlank()) ? currencyParam : currencyHeader;
        byte[] bytes = exportService.exportExpensesToPdf(user, preferredCurrency);
        log.info("Expenses PDF export generated for userId={}, byteCount={}", userId, bytes != null ? bytes.length : 0);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"expenses.pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .contentLength(bytes != null ? bytes.length : 0)
                .body(bytes);
    }

    @Operation(summary = "Export expenses to Excel workbook (.xlsx)")
    @GetMapping({"/user/{userId}/export/excel", "/user/{userId}/export/xlsx"})
    public ResponseEntity<byte[]> exportExcel(
            @PathVariable Long userId,
            @RequestParam(value = "currency", required = false) String currencyParam,
            @RequestHeader(value = "X-Currency", required = false) String currencyHeader) {
        userSecurity.validateUserAccess(userId);
        log.info("Exporting expenses to Excel for userId={}, currencyParam={}, currencyHeader={}",
                userId, currencyParam, currencyHeader);
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        String preferredCurrency = (currencyParam != null && !currencyParam.isBlank()) ? currencyParam : currencyHeader;
        byte[] bytes = exportService.exportExpensesToExcel(user, preferredCurrency);
        log.info("Expenses Excel export generated for userId={}, byteCount={}",
                userId, bytes != null ? bytes.length : 0);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"expenses.xlsx\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .contentLength(bytes != null ? bytes.length : 0)
                .body(bytes);
    }

    @Operation(
        summary = "Import expenses from CSV file",
        description = """
            Columns are matched by header name, not fixed position — so this accepts any
            reasonable column order/subset, not just this app's own export format. Required
            headers (case-insensitive): Date, Category, Amount. Description is optional.

            Each row is parsed independently: a problem in one row (bad date, non-numeric
            amount, etc.) is recorded and skipped rather than aborting the entire import.
            The response reports how many rows imported successfully and lists any that
            didn't, with a reason, so a partially-malformed file still gets you most of the
            way there instead of an all-or-nothing failure.
            """
    )
    @PostMapping(value = "/user/{userId}/import/csv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> importCsv(
            @PathVariable Long userId,
            @RequestParam("file") MultipartFile file) {
        userSecurity.validateUserAccess(userId);
        log.info("Importing expenses from CSV for userId={}, filename={}, size={}",
                userId, file.getOriginalFilename(), file.getSize());
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Map<String, Object> result = importService.importExpensesFromCsv(file, user);
        log.info("CSV expense import completed for userId={}", userId);
        return ResponseEntity.ok(result);
    }

    @Operation(summary = "Import expenses from JSON file")
    @PostMapping(value = "/user/{userId}/import/json", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> importJson(
            @PathVariable Long userId,
            @RequestParam("file") MultipartFile file) {
        userSecurity.validateUserAccess(userId);
        log.info("Importing expenses from JSON for userId={}, filename={}, size={}",
                userId, file.getOriginalFilename(), file.getSize());
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Map<String, Object> result = importService.importExpensesFromJson(file, user);
        log.info("JSON expense import completed for userId={}", userId);
        return ResponseEntity.ok(result);
    }

    @Operation(summary = "Import expenses from Excel file (.xlsx / .xls)",
            description = "Uploads a Microsoft Excel workbook containing expense entries. "
                    + "Supports dynamic header detection and per-row error tracking.")
    @PostMapping(value = {"/user/{userId}/import/excel", "/user/{userId}/import/xlsx"},
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> importExcel(
            @PathVariable Long userId,
            @RequestParam("file") MultipartFile file) {
        userSecurity.validateUserAccess(userId);
        log.info("Importing expenses from Excel for userId={}, filename={}, size={}",
                userId, file.getOriginalFilename(), file.getSize());
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Map<String, Object> result = importService.importExpensesFromExcel(file, user);
        log.info("Excel expense import completed for userId={}", userId);
        return ResponseEntity.ok(result);
    }

    @Operation(summary = "Reconcile bank statement (.csv, .xlsx, .xls)",
            description = "Parses bank statements across major banks, matches existing entries, "
                    + "and automatically captures 100% of missed debits and credits.")
    @PostMapping(value = "/user/{userId}/import/statement",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> reconcileBankStatement(
            @PathVariable Long userId,
            @RequestParam("file") MultipartFile file) {
        userSecurity.validateUserAccess(userId);
        log.info("Reconciling bank statement for userId={}, filename={}, size={}",
                userId, file.getOriginalFilename(), file.getSize());
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Map<String, Object> result = importService.reconcileBankStatement(file, user);
        log.info("Bank statement reconciliation completed for userId={}: {}", userId, result.get("message"));
        return ResponseEntity.ok(result);
    }
}
