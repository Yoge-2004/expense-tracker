package com.example.expensetracker.service.impl;

import com.example.expensetracker.dto.ExpenseDto;
import com.example.expensetracker.dto.IncomeDto;
import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.CategoryRepository;
import com.example.expensetracker.service.ExpenseService;
import com.example.expensetracker.service.IncomeService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("ImportServiceImpl Unit Tests")
class ImportServiceImplTest {

    @Mock
    private ExpenseService expenseService;

    @Mock
    private IncomeService incomeService;

    @Mock
    private CategoryRepository categoryRepository;

    private ImportServiceImpl importService;

    private User testUser;
    private Category foodCategory;

    @BeforeEach
    void setUp() {
        importService = new ImportServiceImpl(expenseService, incomeService, categoryRepository);

        testUser = new User();
        testUser.setId(10L);
        testUser.setName("Tester");
        testUser.setEmail("tester@example.com");

        foodCategory = new Category();
        foodCategory.setId(1L);
        foodCategory.setName("Food");
        foodCategory.setUser(testUser);
    }

    @Test
    @DisplayName("importExpensesFromCsv: successfully imports valid expense rows")
    void importExpensesFromCsv_success() {
        String csvContent = "date,category,amount,description\n" +
                "2026-09-10,Food,25.50,Lunch at diner\n" +
                "2026-09-11,Food,15.00,Coffee\n";
        MockMultipartFile file = new MockMultipartFile(
                "file", "expenses.csv", "text/csv", csvContent.getBytes(StandardCharsets.UTF_8));

        when(categoryRepository.findByUserAndNameIgnoreCase(testUser, "Food"))
                .thenReturn(Optional.of(foodCategory));

        Map<String, Object> result = importService.importExpensesFromCsv(file, testUser);

        assertNotNull(result);
        assertEquals(2, result.get("imported"));
        assertEquals(0, result.get("failedRows"));
        verify(expenseService, times(2)).createExpense(any(Expense.class), eq(testUser));
    }

    @Test
    @DisplayName("importExpensesFromCsv: throws IllegalArgumentException when file is empty")
    void importExpensesFromCsv_emptyFile() {
        MockMultipartFile file = new MockMultipartFile("file", "empty.csv", "text/csv", new byte[0]);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> importService.importExpensesFromCsv(file, testUser));
        assertTrue(ex.getMessage().contains("empty"));
    }

    @Test
    @DisplayName("importExpensesFromCsv: throws IllegalArgumentException when required headers are missing")
    void importExpensesFromCsv_missingHeaders() {
        String csvContent = "category,amount\nFood,25.50\n";
        MockMultipartFile file = new MockMultipartFile(
                "file", "invalid.csv", "text/csv", csvContent.getBytes(StandardCharsets.UTF_8));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> importService.importExpensesFromCsv(file, testUser));
        assertTrue(ex.getMessage().contains("must contain at least 'date', 'category', and 'amount'"));
    }

    @Test
    @DisplayName("importExpensesFromCsv: captures row errors and imports remaining valid rows")
    void importExpensesFromCsv_partialFailure() {
        String csvContent = "date,category,amount,description\n" +
                "2026-09-10,Food,25.50,Valid lunch\n" +
                "invalid-date,Food,30.00,Invalid date row\n";
        MockMultipartFile file = new MockMultipartFile(
                "file", "expenses.csv", "text/csv", csvContent.getBytes(StandardCharsets.UTF_8));

        when(categoryRepository.findByUserAndNameIgnoreCase(testUser, "Food"))
                .thenReturn(Optional.of(foodCategory));

        Map<String, Object> result = importService.importExpensesFromCsv(file, testUser);

        assertNotNull(result);
        assertEquals(1, result.get("imported"));
        assertEquals(1, result.get("failedRows"));
        verify(expenseService, times(1)).createExpense(any(Expense.class), eq(testUser));
    }

    @Test
    @DisplayName("importExpensesFromJson: successfully imports valid json payload")
    void importExpensesFromJson_success() throws Exception {
        List<ExpenseDto> dtos = List.of(
                new ExpenseDto(null, new BigDecimal("45.00"), "Dinner", LocalDate.of(2026, 9, 12), 1L, "Food"),
                new ExpenseDto(null, new BigDecimal("12.00"), "Snack", LocalDate.of(2026, 9, 13), 1L, "Food")
        );
        byte[] bytes = new ObjectMapper().findAndRegisterModules().writeValueAsBytes(dtos);
        MockMultipartFile file = new MockMultipartFile(
                "file", "expenses.json", "application/json", bytes);

        when(categoryRepository.findByUserAndNameIgnoreCase(testUser, "Food"))
                .thenReturn(Optional.of(foodCategory));

        Map<String, Object> result = importService.importExpensesFromJson(file, testUser);

        assertNotNull(result);
        assertEquals(2, result.get("imported"));
        verify(expenseService, times(2)).createExpense(any(Expense.class), eq(testUser));
    }

    @Test
    @DisplayName("importIncomesFromCsv: successfully imports valid income rows")
    void importIncomesFromCsv_success() {
        String csvContent = "date,source,amount,description\n" +
                "2026-09-01,Salary,5000.00,Monthly direct deposit\n" +
                "2026-09-15,Dividends,150.00,Stock dividend\n";
        MockMultipartFile file = new MockMultipartFile(
                "file", "incomes.csv", "text/csv", csvContent.getBytes(StandardCharsets.UTF_8));

        Map<String, Object> result = importService.importIncomesFromCsv(file, testUser);

        assertNotNull(result);
        assertEquals(2, result.get("imported"));
        assertEquals(0, result.get("failedRows"));
        verify(incomeService, times(2)).createIncome(any(), eq(testUser));
    }

    @Test
    @DisplayName("importIncomesFromJson: successfully imports income json array")
    void importIncomesFromJson_success() throws Exception {
        List<IncomeDto> dtos = List.of(
                new IncomeDto(null, new BigDecimal("2500.00"), "Client Payment", "Consulting",
                        LocalDate.of(2026, 9, 5), false, LocalDateTime.now())
        );
        byte[] bytes = new ObjectMapper().findAndRegisterModules().writeValueAsBytes(dtos);
        MockMultipartFile file = new MockMultipartFile(
                "file", "incomes.json", "application/json", bytes);

        Map<String, Object> result = importService.importIncomesFromJson(file, testUser);

        assertNotNull(result);
        assertEquals(1, result.get("imported"));
        verify(incomeService, times(1)).createIncome(any(), eq(testUser));
    }

    @Test
    @DisplayName("importServices: null user context throws IllegalArgumentException across all methods")
    void importMethods_nullUser_throwsException() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "data.csv", "text/csv", "date,category,amount\n".getBytes());
        assertThrows(IllegalArgumentException.class, () -> importService.importExpensesFromCsv(file, null));
        assertThrows(IllegalArgumentException.class, () -> importService.importExpensesFromJson(file, null));
        assertThrows(IllegalArgumentException.class, () -> importService.importExpensesFromExcel(file, null));
        assertThrows(IllegalArgumentException.class, () -> importService.importIncomesFromCsv(file, null));
        assertThrows(IllegalArgumentException.class, () -> importService.importIncomesFromJson(file, null));
        assertThrows(IllegalArgumentException.class, () -> importService.importIncomesFromExcel(file, null));
    }

    @Test
    @DisplayName("importExpensesFromJson: non-positive or null amount items scream IllegalArgumentException")
    void importExpensesFromJson_invalidAmounts() throws Exception {
        List<ExpenseDto> dtosZero = List.of(
                new ExpenseDto(null, BigDecimal.ZERO, "Free food", LocalDate.now(), null, "Food")
        );
        byte[] bytesZero = new ObjectMapper().findAndRegisterModules().writeValueAsBytes(dtosZero);
        MockMultipartFile fileZero = new MockMultipartFile("file", "expenses.json", "application/json", bytesZero);

        assertThrows(IllegalArgumentException.class, () -> importService.importExpensesFromJson(fileZero, testUser));

        List<ExpenseDto> dtosNeg = List.of(
                new ExpenseDto(null, new BigDecimal("-10.00"), "Negative", LocalDate.now(), null, "Food")
        );
        byte[] bytesNeg = new ObjectMapper().findAndRegisterModules().writeValueAsBytes(dtosNeg);
        MockMultipartFile fileNeg = new MockMultipartFile("file", "expenses.json", "application/json", bytesNeg);

        assertThrows(IllegalArgumentException.class, () -> importService.importExpensesFromJson(fileNeg, testUser));
    }

    @Test
    @DisplayName("importIncomesFromJson: non-positive amount or blank source items scream IllegalArgumentException")
    void importIncomesFromJson_invalidData() throws Exception {
        List<IncomeDto> dtosZero = List.of(
                new IncomeDto(null, BigDecimal.ZERO, "Zero Salary", "", LocalDate.now(), false, null)
        );
        byte[] bytesZero = new ObjectMapper().findAndRegisterModules().writeValueAsBytes(dtosZero);
        MockMultipartFile fileZero = new MockMultipartFile("file", "incomes.json", "application/json", bytesZero);

        assertThrows(IllegalArgumentException.class, () -> importService.importIncomesFromJson(fileZero, testUser));

        List<IncomeDto> dtosBlankSource = List.of(
                new IncomeDto(null, new BigDecimal("100.00"), "   ", "", LocalDate.now(), false, null)
        );
        byte[] bytesBlankSource = new ObjectMapper().findAndRegisterModules().writeValueAsBytes(dtosBlankSource);
        MockMultipartFile fileBlankSource = new MockMultipartFile(
                "file", "incomes.json", "application/json", bytesBlankSource);

        assertThrows(IllegalArgumentException.class,
                () -> importService.importIncomesFromJson(fileBlankSource, testUser));
    }
}
