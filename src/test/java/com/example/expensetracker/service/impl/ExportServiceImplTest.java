package com.example.expensetracker.service.impl;

import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.Income;
import com.example.expensetracker.model.SavingsGoal;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.BudgetRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.IncomeRepository;
import com.example.expensetracker.repository.SavingsGoalRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("ExportServiceImpl Unit Tests")
class ExportServiceImplTest {

    @Mock
    private ExpenseRepository expenseRepository;

    @Mock
    private IncomeRepository incomeRepository;

    @Mock
    private SavingsGoalRepository savingsGoalRepository;

    @Mock
    private BudgetRepository budgetRepository;

    private ExportServiceImpl exportService;

    private User testUser;
    private Expense testExpense;
    private Income testIncome;
    private SavingsGoal testGoal;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        exportService = new ExportServiceImpl(
                expenseRepository, incomeRepository, savingsGoalRepository, budgetRepository);
        objectMapper = new ObjectMapper();

        testUser = new User();
        testUser.setId(1L);
        testUser.setName("John Doe");
        testUser.setEmail("john@example.com");
        testUser.setCurrency("USD");

        Category category = new Category();
        category.setId(10L);
        category.setName("Groceries");

        testExpense = new Expense();
        testExpense.setId(101L);
        testExpense.setUser(testUser);
        testExpense.setAmount(new BigDecimal("125.50"));
        testExpense.setDescription("Supermarket \"Weekly\" haul");
        testExpense.setExpenseDate(LocalDate.of(2026, 9, 15));
        testExpense.setCategory(category);
        testExpense.setRecurring(false);

        testIncome = new Income();
        testIncome.setId(201L);
        testIncome.setUser(testUser);
        testIncome.setAmount(new BigDecimal("3500.00"));
        testIncome.setSource("Tech Corp Salary");
        testIncome.setDescription("Monthly paycheck");
        testIncome.setIncomeDate(LocalDate.of(2026, 9, 1));
        testIncome.setIsRecurring(true);

        testGoal = new SavingsGoal();
        testGoal.setId(301L);
        testGoal.setUser(testUser);
        testGoal.setName("Emergency Fund");
        testGoal.setTargetAmount(new BigDecimal("10000.00"));
        testGoal.setCurrentAmount(new BigDecimal("4500.00"));
        testGoal.setTargetDate(LocalDate.of(2027, 12, 31));
        testGoal.setStatus("ACTIVE");
    }

    @Test
    @DisplayName("exportExpensesToCsv: produces valid CSV headers and data rows")
    void exportExpensesToCsv_success() {
        when(expenseRepository.findByUser(testUser)).thenReturn(List.of(testExpense));

        byte[] csvBytes = exportService.exportExpensesToCsv(testUser);

        assertNotNull(csvBytes);
        String csv = new String(csvBytes, StandardCharsets.UTF_8);
        assertTrue(csv.startsWith("ID,Date,Category,Amount,Description,Recurring\n"));
        assertTrue(csv.contains("101,2026-09-15,\"Groceries\",125.50,\"Supermarket \"\"Weekly\"\" haul\",false"));
        verify(expenseRepository).findByUser(testUser);
    }

    @Test
    @DisplayName("exportExpensesToCsv: handles empty list cleanly")
    void exportExpensesToCsv_emptyList() {
        when(expenseRepository.findByUser(testUser)).thenReturn(Collections.emptyList());

        byte[] csvBytes = exportService.exportExpensesToCsv(testUser);

        assertNotNull(csvBytes);
        String csv = new String(csvBytes, StandardCharsets.UTF_8);
        assertEquals("ID,Date,Category,Amount,Description,Recurring\n", csv);
    }

    @Test
    @DisplayName("exportExpensesToJson: produces valid JSON with correct fields")
    void exportExpensesToJson_success() throws Exception {
        when(expenseRepository.findByUser(testUser)).thenReturn(List.of(testExpense));

        byte[] jsonBytes = exportService.exportExpensesToJson(testUser);

        assertNotNull(jsonBytes);
        JsonNode root = objectMapper.readTree(jsonBytes);
        assertTrue(root.isArray());
        assertEquals(1, root.size());
        assertEquals(101L, root.get(0).get("id").asLong());
        assertEquals(125.50, root.get(0).get("amount").asDouble());
        assertEquals("Groceries", root.get(0).get("categoryName").asText());
    }

    @Test
    @DisplayName("exportExpensesToPdf: produces valid PDF starting with %PDF-")
    void exportExpensesToPdf_success() {
        when(expenseRepository.findByUser(testUser)).thenReturn(List.of(testExpense));

        byte[] pdfBytes = exportService.exportExpensesToPdf(testUser, "USD");

        assertNotNull(pdfBytes);
        assertTrue(pdfBytes.length > 50);
        String header = new String(pdfBytes, 0, 5, StandardCharsets.US_ASCII);
        assertEquals("%PDF-", header);
    }

    @Test
    @DisplayName("exportExpensesToExcel: generates valid XLSX workbook with expenses")
    void exportExpensesToExcel_success() throws Exception {
        when(expenseRepository.findByUser(testUser)).thenReturn(List.of(testExpense));

        byte[] xlsxBytes = exportService.exportExpensesToExcel(testUser, "EUR");

        assertNotNull(xlsxBytes);
        try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(xlsxBytes))) {
            assertTrue(workbook.getNumberOfSheets() >= 1);
            assertNotNull(workbook.getSheet("Expenses"));
        }
    }

    @Test
    @DisplayName("exportIncomesToCsv: produces valid CSV headers and data rows")
    void exportIncomesToCsv_success() {
        when(incomeRepository.findByUser(testUser)).thenReturn(List.of(testIncome));

        byte[] csvBytes = exportService.exportIncomesToCsv(testUser);

        assertNotNull(csvBytes);
        String csv = new String(csvBytes, StandardCharsets.UTF_8);
        assertTrue(csv.startsWith("ID,Date,Source,Amount,Description,Recurring\n"));
        assertTrue(csv.contains("201,2026-09-01,\"Tech Corp Salary\",3500.00,\"Monthly paycheck\",true"));
    }

    @Test
    @DisplayName("exportIncomesToJson: produces valid JSON array")
    void exportIncomesToJson_success() throws Exception {
        when(incomeRepository.findByUser(testUser)).thenReturn(List.of(testIncome));

        byte[] jsonBytes = exportService.exportIncomesToJson(testUser);

        assertNotNull(jsonBytes);
        JsonNode root = objectMapper.readTree(jsonBytes);
        assertTrue(root.isArray());
        assertEquals(1, root.size());
        assertEquals(201L, root.get(0).get("id").asLong());
        assertEquals("Tech Corp Salary", root.get(0).get("source").asText());
    }

    @Test
    @DisplayName("exportIncomesToPdf: produces valid PDF")
    void exportIncomesToPdf_success() {
        when(incomeRepository.findByUser(testUser)).thenReturn(List.of(testIncome));

        byte[] pdfBytes = exportService.exportIncomesToPdf(testUser, "INR");

        assertNotNull(pdfBytes);
        String header = new String(pdfBytes, 0, 5, StandardCharsets.US_ASCII);
        assertEquals("%PDF-", header);
    }

    @Test
    @DisplayName("exportIncomesToExcel: generates valid XLSX workbook with incomes")
    void exportIncomesToExcel_success() throws Exception {
        when(incomeRepository.findByUser(testUser)).thenReturn(List.of(testIncome));

        byte[] xlsxBytes = exportService.exportIncomesToExcel(testUser, "INR");

        assertNotNull(xlsxBytes);
        try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(xlsxBytes))) {
            assertNotNull(workbook.getSheet("Incomes"));
        }
    }

    @Test
    @DisplayName("exportFinancialStatementExcel: generates comprehensive multi-sheet workbook")
    void exportFinancialStatementExcel_success() throws Exception {
        when(expenseRepository.findByUser(testUser)).thenReturn(List.of(testExpense));
        when(incomeRepository.findByUser(testUser)).thenReturn(List.of(testIncome));
        when(savingsGoalRepository.findByUser(testUser)).thenReturn(List.of(testGoal));
        when(budgetRepository.findByUser(testUser)).thenReturn(Collections.emptyList());

        byte[] xlsxBytes = exportService.exportFinancialStatementExcel(testUser, "USD");

        assertNotNull(xlsxBytes);
        try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(xlsxBytes))) {
            assertTrue(workbook.getNumberOfSheets() >= 4);
            assertNotNull(workbook.getSheet("Dashboard"));
            assertNotNull(workbook.getSheet("Incomes"));
            assertNotNull(workbook.getSheet("Expenses"));
            assertNotNull(workbook.getSheet("Savings Goals"));
        }
    }

    @Test
    @DisplayName("exportExpensesToCsv: null user screams IllegalArgumentException")
    void exportExpensesToCsv_nullUser_throwsException() {
        assertThrows(IllegalArgumentException.class, () -> exportService.exportExpensesToCsv(null));
    }

    @Test
    @DisplayName("exportExpensesToJson: null user screams IllegalArgumentException")
    void exportExpensesToJson_nullUser_throwsException() {
        assertThrows(IllegalArgumentException.class, () -> exportService.exportExpensesToJson(null));
    }

    @Test
    @DisplayName("exportExpensesToPdf: null user screams IllegalArgumentException")
    void exportExpensesToPdf_nullUser_throwsException() {
        assertThrows(IllegalArgumentException.class, () -> exportService.exportExpensesToPdf(null));
        assertThrows(IllegalArgumentException.class, () -> exportService.exportExpensesToPdf(null, "USD"));
    }

    @Test
    @DisplayName("exportExpensesToExcel: null user screams IllegalArgumentException")
    void exportExpensesToExcel_nullUser_throwsException() {
        assertThrows(IllegalArgumentException.class, () -> exportService.exportExpensesToExcel(null));
        assertThrows(IllegalArgumentException.class, () -> exportService.exportExpensesToExcel(null, "USD"));
    }

    @Test
    @DisplayName("exportIncomesToCsv: null user screams IllegalArgumentException")
    void exportIncomesToCsv_nullUser_throwsException() {
        assertThrows(IllegalArgumentException.class, () -> exportService.exportIncomesToCsv(null));
    }

    @Test
    @DisplayName("exportIncomesToJson: null user screams IllegalArgumentException")
    void exportIncomesToJson_nullUser_throwsException() {
        assertThrows(IllegalArgumentException.class, () -> exportService.exportIncomesToJson(null));
    }

    @Test
    @DisplayName("exportIncomesToPdf: null user screams IllegalArgumentException")
    void exportIncomesToPdf_nullUser_throwsException() {
        assertThrows(IllegalArgumentException.class, () -> exportService.exportIncomesToPdf(null));
        assertThrows(IllegalArgumentException.class, () -> exportService.exportIncomesToPdf(null, "INR"));
    }

    @Test
    @DisplayName("exportIncomesToExcel: null user screams IllegalArgumentException")
    void exportIncomesToExcel_nullUser_throwsException() {
        assertThrows(IllegalArgumentException.class, () -> exportService.exportIncomesToExcel(null));
        assertThrows(IllegalArgumentException.class, () -> exportService.exportIncomesToExcel(null, "INR"));
    }

    @Test
    @DisplayName("exportFinancialStatementExcel: null user screams IllegalArgumentException")
    void exportFinancialStatementExcel_nullUser_throwsException() {
        assertThrows(IllegalArgumentException.class, () -> exportService.exportFinancialStatementExcel(null));
        assertThrows(IllegalArgumentException.class, () -> exportService.exportFinancialStatementExcel(null, "USD"));
    }

    @Test
    @DisplayName("exportFinancialStatementPdf: null user screams IllegalArgumentException")
    void exportFinancialStatementPdf_nullUser_throwsException() {
        assertThrows(IllegalArgumentException.class, () -> exportService.exportFinancialStatementPdf(null));
        assertThrows(IllegalArgumentException.class, () -> exportService.exportFinancialStatementPdf(null, "USD"));
    }
}
