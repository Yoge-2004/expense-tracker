package com.example.expensetracker.service;

import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.Income;
import com.example.expensetracker.model.SavingsGoal;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.IncomeRepository;
import com.example.expensetracker.repository.SavingsGoalRepository;
import com.example.expensetracker.service.impl.ExportServiceImpl;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link ExportServiceImpl}.
 * Validates CSV, JSON, PDF, and Excel byte outputs for expenses, incomes, and financial statements.
 *
 * @author Yogeshwaran
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ExportServiceImpl Unit Tests")
class ExportServiceImplTest {

    @Mock
    private ExpenseRepository expenseRepository;

    @Mock
    private IncomeRepository incomeRepository;

    @Mock
    private SavingsGoalRepository savingsGoalRepository;

    @InjectMocks
    private ExportServiceImpl exportService;

    private User sampleUser;
    private Expense sampleExpense;
    private Income sampleIncome;
    private SavingsGoal sampleGoal;

    @BeforeEach
    void setUp() {
        sampleUser = new User();
        sampleUser.setId(1L);
        sampleUser.setName("Yogeshwaran");
        sampleUser.setEmail("yoge@example.com");

        Category category = new Category();
        category.setId(1L);
        category.setName("Groceries");
        category.setUser(sampleUser);

        sampleExpense = new Expense();
        sampleExpense.setId(10L);
        sampleExpense.setAmount(new BigDecimal("1500.00"));
        sampleExpense.setDescription("Weekly vegetables");
        sampleExpense.setExpenseDate(LocalDate.of(2026, 8, 10));
        sampleExpense.setCategory(category);
        sampleExpense.setUser(sampleUser);

        sampleIncome = new Income();
        sampleIncome.setId(20L);
        sampleIncome.setAmount(new BigDecimal("75000.00"));
        sampleIncome.setSource("Salary");
        sampleIncome.setDescription("Monthly compensation");
        sampleIncome.setIncomeDate(LocalDate.of(2026, 8, 1));
        sampleIncome.setIsRecurring(true);
        sampleIncome.setUser(sampleUser);

        sampleGoal = new SavingsGoal();
        sampleGoal.setId(30L);
        sampleGoal.setName("Emergency Fund");
        sampleGoal.setTargetAmount(new BigDecimal("100000.00"));
        sampleGoal.setCurrentAmount(new BigDecimal("45000.00"));
        sampleGoal.setTargetDate(LocalDate.of(2026, 12, 31));
        sampleGoal.setUser(sampleUser);
    }

    @Test
    @DisplayName("exportExpensesToCsv generates valid RFC 4180 CSV bytes")
    void exportExpensesToCsv_generatesValidCsv() {
        when(expenseRepository.findByUser(sampleUser)).thenReturn(List.of(sampleExpense));

        byte[] bytes = exportService.exportExpensesToCsv(sampleUser);
        assertThat(bytes).isNotNull();
        String csv = new String(bytes, StandardCharsets.UTF_8);

        assertThat(csv).contains("ID,Date,Category,Amount,Description,Recurring");
        assertThat(csv).contains("10,2026-08-10,\"Groceries\",1500.00,\"Weekly vegetables\",false");
    }

    @Test
    @DisplayName("exportExpensesToJson generates valid JSON array bytes")
    void exportExpensesToJson_generatesValidJson() {
        when(expenseRepository.findByUser(sampleUser)).thenReturn(List.of(sampleExpense));

        byte[] bytes = exportService.exportExpensesToJson(sampleUser);
        assertThat(bytes).isNotNull();
        String json = new String(bytes, StandardCharsets.UTF_8);

        assertThat(json).contains("\"id\" : 10");
        assertThat(json).contains("\"amount\" : 1500.00");
        assertThat(json).contains("\"categoryName\" : \"Groceries\"");
    }

    @Test
    @DisplayName("exportExpensesToPdf generates non-empty PDF bytes with PDF header")
    void exportExpensesToPdf_generatesPdf() {
        when(expenseRepository.findByUser(sampleUser)).thenReturn(List.of(sampleExpense));

        byte[] bytes = exportService.exportExpensesToPdf(sampleUser);
        assertThat(bytes).isNotNull().isNotEmpty();
        String header = new String(bytes, 0, Math.min(bytes.length, 5), StandardCharsets.ISO_8859_1);
        assertThat(header).startsWith("%PDF");
    }

    @Test
    @DisplayName("exportExpensesToExcel generates valid XLSX workbook with Expenses sheet")
    void exportExpensesToExcel_generatesXlsx() throws Exception {
        when(expenseRepository.findByUser(sampleUser)).thenReturn(List.of(sampleExpense));

        byte[] bytes = exportService.exportExpensesToExcel(sampleUser);
        assertThat(bytes).isNotNull().isNotEmpty();

        try (Workbook workbook = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            Sheet sheet = workbook.getSheet("Expenses");
            assertThat(sheet).isNotNull();
            assertThat(sheet.getRow(0).getCell(0).getStringCellValue()).isEqualTo("ID");
            assertThat(sheet.getRow(1).getCell(2).getStringCellValue()).isEqualTo("Groceries");
            assertThat(sheet.getRow(1).getCell(3).getNumericCellValue()).isEqualTo(1500.0);
        }
    }

    @Test
    @DisplayName("exportIncomesToCsv generates valid CSV bytes")
    void exportIncomesToCsv_generatesValidCsv() {
        when(incomeRepository.findByUser(sampleUser)).thenReturn(List.of(sampleIncome));

        byte[] bytes = exportService.exportIncomesToCsv(sampleUser);
        assertThat(bytes).isNotNull();
        String csv = new String(bytes, StandardCharsets.UTF_8);

        assertThat(csv).contains("ID,Date,Source,Amount,Description,Recurring");
        assertThat(csv).contains("20,2026-08-01,\"Salary\",75000.00,\"Monthly compensation\",true");
    }

    @Test
    @DisplayName("exportIncomesToJson generates valid JSON array bytes")
    void exportIncomesToJson_generatesValidJson() {
        when(incomeRepository.findByUser(sampleUser)).thenReturn(List.of(sampleIncome));

        byte[] bytes = exportService.exportIncomesToJson(sampleUser);
        assertThat(bytes).isNotNull();
        String json = new String(bytes, StandardCharsets.UTF_8);

        assertThat(json).contains("\"source\" : \"Salary\"");
        assertThat(json).contains("\"amount\" : 75000.00");
    }

    @Test
    @DisplayName("exportIncomesToPdf generates non-empty PDF bytes")
    void exportIncomesToPdf_generatesPdf() {
        when(incomeRepository.findByUser(sampleUser)).thenReturn(List.of(sampleIncome));

        byte[] bytes = exportService.exportIncomesToPdf(sampleUser);
        assertThat(bytes).isNotNull().isNotEmpty();
        String header = new String(bytes, 0, Math.min(bytes.length, 5), StandardCharsets.ISO_8859_1);
        assertThat(header).startsWith("%PDF");
    }

    @Test
    @DisplayName("exportIncomesToExcel generates valid XLSX workbook with Incomes sheet")
    void exportIncomesToExcel_generatesXlsx() throws Exception {
        when(incomeRepository.findByUser(sampleUser)).thenReturn(List.of(sampleIncome));

        byte[] bytes = exportService.exportIncomesToExcel(sampleUser);
        assertThat(bytes).isNotNull().isNotEmpty();

        try (Workbook workbook = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            Sheet sheet = workbook.getSheet("Incomes");
            assertThat(sheet).isNotNull();
            assertThat(sheet.getRow(0).getCell(2).getStringCellValue()).isEqualTo("Source");
            assertThat(sheet.getRow(1).getCell(2).getStringCellValue()).isEqualTo("Salary");
            assertThat(sheet.getRow(1).getCell(3).getNumericCellValue()).isEqualTo(75000.0);
        }
    }

    @Test
    @DisplayName("exportFinancialStatementExcel generates PowerBI-style 4-sheet multi-tab workbook with Dashboard")
    void exportFinancialStatementExcel_generatesCompleteWorkbook() throws Exception {
        when(expenseRepository.findByUser(sampleUser)).thenReturn(List.of(sampleExpense));
        when(incomeRepository.findByUser(sampleUser)).thenReturn(List.of(sampleIncome));
        when(savingsGoalRepository.findByUser(sampleUser)).thenReturn(List.of(sampleGoal));

        byte[] bytes = exportService.exportFinancialStatementExcel(sampleUser);
        assertThat(bytes).isNotNull().isNotEmpty();

        try (Workbook workbook = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            assertThat(workbook.getNumberOfSheets()).isEqualTo(4);
            assertThat(workbook.getSheetName(0)).isEqualTo("Dashboard");
            assertThat(workbook.getSheetName(1)).isEqualTo("Incomes");
            assertThat(workbook.getSheetName(2)).isEqualTo("Expenses");
            assertThat(workbook.getSheetName(3)).isEqualTo("Savings Goals");

            Sheet dash = workbook.getSheetAt(0);
            assertThat(dash.getRow(0).getCell(0).getStringCellValue()).contains("FINANCIAL INTELLIGENCE EXECUTIVE DASHBOARD");
            assertThat(dash.getRow(2).getCell(0).getStringCellValue()).contains("Yogeshwaran");
        }
    }

    @Test
    @DisplayName("exportFinancialStatementPdf generates executive PDF document")
    void exportFinancialStatementPdf_generatesPdf() {
        when(expenseRepository.findByUser(sampleUser)).thenReturn(List.of(sampleExpense));
        when(incomeRepository.findByUser(sampleUser)).thenReturn(List.of(sampleIncome));
        when(savingsGoalRepository.findByUser(sampleUser)).thenReturn(List.of(sampleGoal));

        byte[] bytes = exportService.exportFinancialStatementPdf(sampleUser);
        assertThat(bytes).isNotNull().isNotEmpty();
        String header = new String(bytes, 0, Math.min(bytes.length, 5), StandardCharsets.ISO_8859_1);
        assertThat(header).startsWith("%PDF");
    }

    @Test
    @DisplayName("exportFinancialStatementExcel respects preferred INR currency and formats all sheets")
    void exportFinancialStatementExcel_withPreferredCurrencyINR() throws Exception {
        when(expenseRepository.findByUser(sampleUser)).thenReturn(List.of(sampleExpense));
        when(incomeRepository.findByUser(sampleUser)).thenReturn(List.of(sampleIncome));
        when(savingsGoalRepository.findByUser(sampleUser)).thenReturn(List.of(sampleGoal));

        byte[] bytes = exportService.exportFinancialStatementExcel(sampleUser, "INR");
        assertThat(bytes).isNotNull().isNotEmpty();

        java.nio.file.Files.write(java.nio.file.Path.of("target/powerbi_dashboard_inr.xlsx"), bytes);

        try (Workbook workbook = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            Sheet dash = workbook.getSheetAt(0);
            String subBanner = dash.getRow(2).getCell(0).getStringCellValue();
            assertThat(subBanner).contains("INR");
            assertThat(subBanner).contains("₹");

            // Verify KPI card perimeter cells are created and styled
            for (int r = 4; r <= 6; r++) {
                for (int c = 0; c <= 7; c++) {
                    Cell cell = dash.getRow(r).getCell(c);
                    assertThat(cell).isNotNull();
                    assertThat(cell.getCellStyle()).isNotNull();
                }
            }

            // Verify Incomes sheet has INR symbol in header
            Sheet incSheet = workbook.getSheet("Incomes");
            assertThat(incSheet.getRow(0).getCell(3).getStringCellValue()).contains("₹");

            // Verify Expenses sheet has INR symbol in header
            Sheet expSheet = workbook.getSheet("Expenses");
            assertThat(expSheet.getRow(0).getCell(3).getStringCellValue()).contains("₹");
        }
    }

    @Test
    @DisplayName("exportFinancialStatementExcel respects EUR currency")
    void exportFinancialStatementExcel_withPreferredCurrencyEUR() throws Exception {
        when(expenseRepository.findByUser(sampleUser)).thenReturn(List.of(sampleExpense));
        when(incomeRepository.findByUser(sampleUser)).thenReturn(List.of(sampleIncome));
        when(savingsGoalRepository.findByUser(sampleUser)).thenReturn(List.of(sampleGoal));

        byte[] bytes = exportService.exportFinancialStatementExcel(sampleUser, "EUR");
        assertThat(bytes).isNotNull().isNotEmpty();

        java.nio.file.Files.write(java.nio.file.Path.of("target/powerbi_dashboard_eur.xlsx"), bytes);

        try (Workbook workbook = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            Sheet dash = workbook.getSheetAt(0);
            String subBanner = dash.getRow(2).getCell(0).getStringCellValue();
            assertThat(subBanner).contains("EUR");
            assertThat(subBanner).contains("€");
        }
    }
}
