package com.example.expensetracker.service;

import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.CategoryRepository;
import com.example.expensetracker.service.impl.ImportServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import java.io.ByteArrayOutputStream;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link ImportServiceImpl}.
 * Validates dynamic CSV header parsing, row error resiliency, and JSON parsing for expenses and incomes.
 *
 * @author Yogeshwaran
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ImportServiceImpl Unit Tests")
class ImportServiceImplTest {

    @Mock
    private ExpenseService expenseService;

    @Mock
    private IncomeService incomeService;

    @Mock
    private CategoryRepository categoryRepository;

    @InjectMocks
    private ImportServiceImpl importService;

    private User sampleUser;
    private Category sampleCategory;

    @BeforeEach
    void setUp() {
        sampleUser = new User();
        sampleUser.setId(1L);
        sampleUser.setName("Yogeshwaran");
        sampleUser.setEmail("yoge@example.com");

        sampleCategory = new Category();
        sampleCategory.setId(10L);
        sampleCategory.setName("Food");
        sampleCategory.setUser(sampleUser);
    }

    @Test
    @DisplayName("importExpensesFromCsv succeeds with valid CSV and creates missing category")
    void importExpensesFromCsv_success() {
        String csv = "Date,Category,Amount,Description\n2026-08-01,Food,250.00,Lunch\n2026-08-02,Transport,50.00,Metro\n";
        MockMultipartFile file = new MockMultipartFile("file", "expenses.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8));

        when(categoryRepository.findByNameIgnoreCase("Food")).thenReturn(Optional.of(sampleCategory));
        when(categoryRepository.findByNameIgnoreCase("Transport")).thenReturn(Optional.empty());
        when(categoryRepository.save(any(Category.class))).thenAnswer(i -> i.getArgument(0));

        Map<String, Object> result = importService.importExpensesFromCsv(file, sampleUser);

        assertThat(result.get("imported")).isEqualTo(2);
        assertThat(result.get("failedRows")).isEqualTo(0);
        assertThat(result.get("message").toString()).contains("Imported 2 expenses successfully.");
    }

    @Test
    @DisplayName("importExpensesFromCsv throws exception when required header missing")
    void importExpensesFromCsv_missingHeader_throwsException() {
        String csv = "Date,Description,Amount\n2026-08-01,Lunch,250.00\n";
        MockMultipartFile file = new MockMultipartFile("file", "expenses.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8));

        assertThatThrownBy(() -> importService.importExpensesFromCsv(file, sampleUser))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("category");
    }

    @Test
    @DisplayName("importExpensesFromCsv tolerates bad rows and imports good rows")
    void importExpensesFromCsv_withBadRows_partiallySucceeds() {
        String csv = "Date,Category,Amount\n2026-08-01,Food,250.00\nINVALID_DATE,Food,abc\n2026-08-03,Food,120.00\n";
        MockMultipartFile file = new MockMultipartFile("file", "expenses.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8));

        when(categoryRepository.findByNameIgnoreCase("Food")).thenReturn(Optional.of(sampleCategory));

        Map<String, Object> result = importService.importExpensesFromCsv(file, sampleUser);

        assertThat(result.get("imported")).isEqualTo(2);
        assertThat(result.get("failedRows")).isEqualTo(1);
        assertThat(result.get("message").toString()).contains("Imported 2 expenses successfully");
    }

    @Test
    @DisplayName("importExpensesFromJson imports expense records")
    void importExpensesFromJson_success() {
        String json = "[{\"amount\": 350.00, \"description\": \"Dinner\", \"categoryName\": \"Food\"}]";
        MockMultipartFile file = new MockMultipartFile("file", "expenses.json", "application/json", json.getBytes(StandardCharsets.UTF_8));

        when(categoryRepository.findByNameIgnoreCase("Food")).thenReturn(Optional.of(sampleCategory));

        Map<String, Object> result = importService.importExpensesFromJson(file, sampleUser);

        assertThat(result.get("imported")).isEqualTo(1);
        verify(expenseService).createExpense(any(Expense.class), eq(sampleUser));
    }

    @Test
    @DisplayName("importIncomesFromCsv succeeds with valid CSV")
    void importIncomesFromCsv_success() {
        String csv = "Date,Source,Amount,Description\n2026-08-01,Salary,75000.00,Monthly salary\n";
        MockMultipartFile file = new MockMultipartFile("file", "incomes.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8));

        Map<String, Object> result = importService.importIncomesFromCsv(file, sampleUser);

        assertThat(result.get("imported")).isEqualTo(1);
        assertThat(result.get("failedRows")).isEqualTo(0);
        assertThat(result.get("message").toString()).contains("Imported 1 income record successfully.");
    }

    @Test
    @DisplayName("importIncomesFromCsv throws exception when required header is missing")
    void importIncomesFromCsv_missingHeader_throwsException() {
        String csv = "Date,Description,Amount\n2026-08-01,Bonus,5000.00\n";
        MockMultipartFile file = new MockMultipartFile("file", "incomes.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8));

        assertThatThrownBy(() -> importService.importIncomesFromCsv(file, sampleUser))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("source");
    }

    @Test
    @DisplayName("importIncomesFromJson imports income records")
    void importIncomesFromJson_success() {
        String json = "[{\"amount\": 80000.00, \"source\": \"Tech Job\", \"incomeDate\": \"2026-08-01\"}]";
        MockMultipartFile file = new MockMultipartFile("file", "incomes.json", "application/json", json.getBytes(StandardCharsets.UTF_8));

        Map<String, Object> result = importService.importIncomesFromJson(file, sampleUser);

        assertThat(result.get("imported")).isEqualTo(1);
        verify(incomeService).createIncome(any(), eq(sampleUser));
    }

    @Test
    @DisplayName("importExpensesFromExcel successfully imports records from valid XLSX workbook")
    void importExpensesFromExcel_success() throws Exception {
        byte[] xlsxBytes;
        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("Expenses");
            Row h = sheet.createRow(0);
            h.createCell(0).setCellValue("Date");
            h.createCell(1).setCellValue("Category");
            h.createCell(2).setCellValue("Amount");
            h.createCell(3).setCellValue("Description");

            Row r = sheet.createRow(1);
            r.createCell(0).setCellValue("2026-08-15");
            r.createCell(1).setCellValue("Groceries");
            r.createCell(2).setCellValue(1250.50);
            r.createCell(3).setCellValue("Weekly market trip");

            wb.write(bos);
            xlsxBytes = bos.toByteArray();
        }

        when(categoryRepository.findByNameIgnoreCase("Groceries")).thenReturn(Optional.of(sampleCategory));

        MockMultipartFile file = new MockMultipartFile(
                "file", "expenses.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xlsxBytes
        );

        Map<String, Object> result = importService.importExpensesFromExcel(file, sampleUser);
        assertThat(result.get("imported")).isEqualTo(1);
        assertThat(result.get("failedRows")).isEqualTo(0);
        verify(expenseService).createExpense(any(), eq(sampleUser));
    }

    @Test
    @DisplayName("importExpensesFromExcel throws on missing required headers")
    void importExpensesFromExcel_missingHeaders() throws Exception {
        byte[] xlsxBytes;
        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("Expenses");
            Row h = sheet.createRow(0);
            h.createCell(0).setCellValue("Date");
            h.createCell(1).setCellValue("Description");

            wb.write(bos);
            xlsxBytes = bos.toByteArray();
        }

        MockMultipartFile file = new MockMultipartFile("file", "expenses.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xlsxBytes);

        assertThatThrownBy(() -> importService.importExpensesFromExcel(file, sampleUser))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Category");
    }

    @Test
    @DisplayName("importIncomesFromExcel successfully imports records from valid XLSX workbook")
    void importIncomesFromExcel_success() throws Exception {
        byte[] xlsxBytes;
        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("Incomes");
            Row h = sheet.createRow(0);
            h.createCell(0).setCellValue("Date");
            h.createCell(1).setCellValue("Source");
            h.createCell(2).setCellValue("Amount");
            h.createCell(3).setCellValue("Description");
            h.createCell(4).setCellValue("Recurring");

            Row r = sheet.createRow(1);
            r.createCell(0).setCellValue("2026-08-01");
            r.createCell(1).setCellValue("Tech Job");
            r.createCell(2).setCellValue(85000.00);
            r.createCell(3).setCellValue("Monthly paycheck");
            r.createCell(4).setCellValue("YES");

            wb.write(bos);
            xlsxBytes = bos.toByteArray();
        }

        MockMultipartFile file = new MockMultipartFile(
                "file", "incomes.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xlsxBytes
        );

        Map<String, Object> result = importService.importIncomesFromExcel(file, sampleUser);
        assertThat(result.get("imported")).isEqualTo(1);
        assertThat(result.get("failedRows")).isEqualTo(0);
        verify(incomeService).createIncome(any(), eq(sampleUser));
    }

    @Test
    @DisplayName("importIncomesFromExcel throws on missing required headers")
    void importIncomesFromExcel_missingHeaders() throws Exception {
        byte[] xlsxBytes;
        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("Incomes");
            Row h = sheet.createRow(0);
            h.createCell(0).setCellValue("Date");
            h.createCell(1).setCellValue("Description");

            wb.write(bos);
            xlsxBytes = bos.toByteArray();
        }

        MockMultipartFile file = new MockMultipartFile("file", "incomes.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xlsxBytes);

        assertThatThrownBy(() -> importService.importIncomesFromExcel(file, sampleUser))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Source");
    }
}
