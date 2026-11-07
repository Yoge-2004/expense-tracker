package com.example.expensetracker.controller;

import com.example.expensetracker.dto.BudgetDto;
import com.example.expensetracker.dto.BudgetStatusDto;
import com.example.expensetracker.dto.ExpenseDto;
import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.CategoryRepository;
import com.example.expensetracker.security.CustomUserDetailsService;
import com.example.expensetracker.security.JwtAuthenticationFilter;
import com.example.expensetracker.security.JwtService;
import com.example.expensetracker.security.UserSecurity;
import com.example.expensetracker.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(
        controllers = ExpenseController.class,
        excludeFilters = @ComponentScan.Filter(
                type = org.springframework.context.annotation.FilterType.ASSIGNABLE_TYPE,
                classes = JwtAuthenticationFilter.class))
@AutoConfigureMockMvc(addFilters = false)
class ExpenseControllerTest {

    @Autowired MockMvc mockMvc;

    @MockitoBean ExpenseService expenseService;
    @MockitoBean UserService userService;
    @MockitoBean CategoryRepository categoryRepository;
    @MockitoBean BudgetService budgetService;
    @MockitoBean RecurringExpenseService recurringExpenseService;
    @MockitoBean ExportService exportService;
    @MockitoBean ImportService importService;
    @MockitoBean UserSecurity userSecurity;
    @MockitoBean JwtService jwtService;
    @MockitoBean CustomUserDetailsService customUserDetailsService;

    private User user;
    private Category food;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setId(7L);
        user.setName("Jane Doe");
        user.setEmail("jane@example.com");
        food = new Category();
        food.setId(1L);
        food.setName("Food");
    }

    @Test
    void createExpenseValidatesAccessBuildsEntityAndReturnsCreatedDto() throws Exception {
        Expense saved = expense(42L, new BigDecimal("199.99"), "Lunch", LocalDate.of(2026, 9, 1), food);
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(expenseService.createExpense(any(Expense.class), same(user))).thenReturn(saved);

        mockMvc.perform(post("/api/expenses/user/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"amount":199.99,"description":"Lunch","expenseDate":"2026-09-01","categoryId":1}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(42))
                .andExpect(jsonPath("$.categoryName").value("Food"))
                .andExpect(jsonPath("$.amount").value(199.99));

        verify(userSecurity).validateUserAccess(7L);
        verify(userService).findById(7L);
        verify(expenseService).createExpense(argThat(entity ->
                new BigDecimal("199.99").compareTo(entity.getAmount()) == 0
                        && "Lunch".equals(entity.getDescription())
                        && LocalDate.of(2026, 9, 1).equals(entity.getExpenseDate())
                        && entity.getCategory() != null
                        && Long.valueOf(1L).equals(entity.getCategory().getId())
                        && !entity.isRecurring()), same(user));
    }

    @Test
    void createExpenseRejectsInvalidPayloadBeforeCallingService() throws Exception {
        mockMvc.perform(post("/api/expenses/user/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"amount":-10,"description":"Bad","expenseDate":"2026-09-01","categoryId":1}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("amount")));

        verifyNoInteractions(userSecurity, userService, expenseService);
    }

    @Test
    void getExpensesReturnsEmptyListWhenNoExpensesExist() throws Exception {
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(expenseService.getUserExpenses(user)).thenReturn(List.of());

        mockMvc.perform(get("/api/expenses/user/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$").isEmpty());

        verify(userSecurity).validateUserAccess(7L);
        verify(userService).findById(7L);
        verify(expenseService).getUserExpenses(user);
    }

    @Test
    void getExpensesMapsEntitiesSafelyWhenCategoryIsNull() throws Exception {
        Expense expenseWithoutCategory = expense(11L, new BigDecimal("12.50"), "Vending machine",
                LocalDate.of(2026, 9, 3), null);
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(expenseService.getUserExpenses(user)).thenReturn(List.of(expenseWithoutCategory));

        mockMvc.perform(get("/api/expenses/user/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(11))
                .andExpect(jsonPath("$[0].categoryName").value("Uncategorized"))
                .andExpect(jsonPath("$[0].categoryId").doesNotExist());
    }

    @Test
    void updateExpenseAppliesUpdatedFieldsAndReturnsUpdatedDto() throws Exception {
        Expense updated = expense(42L, new BigDecimal("225.00"), "Lunch + dessert",
                LocalDate.of(2026, 9, 1), food);
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(categoryRepository.findById(1L)).thenReturn(Optional.of(food));
        when(expenseService.updateExpense(eq(42L), any(Expense.class), same(user))).thenReturn(updated);

        mockMvc.perform(put("/api/expenses/42/user/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"amount":225.00,"description":"Lunch + dessert",
                                 "expenseDate":"2026-09-01","categoryId":1}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(42))
                .andExpect(jsonPath("$.amount").value(225.0))
                .andExpect(jsonPath("$.description").value("Lunch + dessert"));

        verify(userSecurity).validateUserAccess(7L);
        verify(expenseService).updateExpense(eq(42L), argThat(entity ->
                new BigDecimal("225.00").compareTo(entity.getAmount()) == 0
                        && "Lunch + dessert".equals(entity.getDescription())
                        && food.equals(entity.getCategory())), same(user));
    }

    @Test
    void updateExpenseRejectsForeignCategoryBeforeCallingService() throws Exception {
        User someoneElse = new User();
        someoneElse.setId(99L);
        Category foreignCategory = Category.builder().id(9L).name("Private").user(someoneElse).build();

        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(categoryRepository.findById(9L)).thenReturn(Optional.of(foreignCategory));

        mockMvc.perform(put("/api/expenses/42/user/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"categoryId":9}
                                """))
                .andExpect(status().isForbidden());

        verify(userSecurity).validateUserAccess(7L);
        verify(expenseService, never()).updateExpense(anyLong(), any(Expense.class), any(User.class));
    }

    @Test
    void deleteExpenseValidatesAccessAndDelegates() throws Exception {
        when(userService.findById(7L)).thenReturn(Optional.of(user));

        mockMvc.perform(delete("/api/expenses/42/user/7"))
                .andExpect(status().isNoContent());

        verify(userSecurity).validateUserAccess(7L);
        verify(userService).findById(7L);
        verify(expenseService).deleteExpense(42L, user);
    }

    // ─── Budget Endpoints ───────────────────────────────────────────────

    @Test
    void setBudgetRejectsNonPositiveLimitWithoutDatabaseLookup() throws Exception {
        mockMvc.perform(post("/api/expenses/budget/user/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"categoryId":1,"limitAmount":0}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Budget limit must be a positive number"));

        verify(userSecurity).validateUserAccess(7L);
        verifyNoInteractions(budgetService);
    }

    @Test
    void setBudgetDelegatesToBudgetService() throws Exception {
        mockMvc.perform(post("/api/expenses/budget/user/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"categoryId":1,"limitAmount":500,"period":"MONTHLY"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Budget set successfully"));

        verify(userSecurity).validateUserAccess(7L);
        verify(budgetService).setBudget(eq(7L), any(BudgetDto.class));
    }

    @Test
    void deleteBudgetByIdDelegatesToBudgetService() throws Exception {
        mockMvc.perform(delete("/api/expenses/budget/9"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Budget limit deleted successfully"));

        verify(budgetService).deleteBudgetById(9L);
    }

    @Test
    void deleteBudgetByIdPropagatesNoSuchElementException() throws Exception {
        doThrow(new NoSuchElementException("Budget not found with id=404"))
                .when(budgetService).deleteBudgetById(404L);

        mockMvc.perform(delete("/api/expenses/budget/404"))
                .andExpect(status().isNotFound());

        verify(budgetService).deleteBudgetById(404L);
    }

    @Test
    void deleteBudgetByCategoryDelegatesToBudgetService() throws Exception {
        mockMvc.perform(delete("/api/expenses/budget/user/7/category/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Budget limit deleted successfully"));

        verify(userSecurity).validateUserAccess(7L);
        verify(budgetService).deleteBudgetByCategory(7L, 1L);
    }

    @Test
    void getBudgetStatusDelegatesToBudgetService() throws Exception {
        BudgetStatusDto statusDto = new BudgetStatusDto(
                3L, 1L, "Food", new BigDecimal("1000"), new BigDecimal("350"),
                35.0, "MONTHLY", null, LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30)
        );
        when(budgetService.getBudgetStatus(7L)).thenReturn(List.of(statusDto));

        mockMvc.perform(get("/api/expenses/budget/status/user/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].budgetId").value(3))
                .andExpect(jsonPath("$[0].categoryName").value("Food"))
                .andExpect(jsonPath("$[0].limit").value(1000))
                .andExpect(jsonPath("$[0].spent").value(350))
                .andExpect(jsonPath("$[0].percentage").value(35.0))
                .andExpect(jsonPath("$[0].period").value("MONTHLY"));

        verify(userSecurity).validateUserAccess(7L);
        verify(budgetService).getBudgetStatus(7L);
    }

    // ─── Recurring Endpoints ────────────────────────────────────────────

    @Test
    void addRecurringDelegatesToRecurringExpenseService() throws Exception {
        mockMvc.perform(post("/api/expenses/recurring/user/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"amount":649,"description":"Netflix",
                                 "expenseDate":"2026-09-01","categoryId":1,"frequency":"monthly"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Recurring Expense Setup Successfully"));

        verify(userSecurity).validateUserAccess(7L);
        verify(recurringExpenseService).createRecurringExpense(eq(7L), any(ExpenseDto.class));
    }

    @Test
    void addRecurringPropagatesBadRequest() throws Exception {
        doThrow(new IllegalArgumentException("Custom frequency requires a positive interval in days"))
                .when(recurringExpenseService).createRecurringExpense(eq(7L), any(ExpenseDto.class));

        mockMvc.perform(post("/api/expenses/recurring/user/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"amount":100,"description":"Custom",
                                 "expenseDate":"2026-09-01","categoryId":1,"frequency":"CUSTOM","intervalDays":0}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Custom frequency requires a positive interval in days"));

        verify(userSecurity).validateUserAccess(7L);
    }

    @Test
    void getUserSubscriptionsDelegatesToRecurringExpenseService() throws Exception {
        Map<String, Object> sub1 = Map.of("id", 3L, "description", "Netflix", "categoryName", "Food");
        Map<String, Object> sub2 = Map.of("id", 4L, "description", "Spotify", "categoryName", "Uncategorized");
        when(recurringExpenseService.getUserSubscriptions(7L)).thenReturn(List.of(sub1, sub2));

        mockMvc.perform(get("/api/expenses/recurring/user/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(3))
                .andExpect(jsonPath("$[0].categoryName").value("Food"))
                .andExpect(jsonPath("$[1].categoryName").value("Uncategorized"));

        verify(userSecurity).validateUserAccess(7L);
        verify(recurringExpenseService).getUserSubscriptions(7L);
    }

    @Test
    void updateSubscriptionDelegatesToRecurringExpenseService() throws Exception {
        mockMvc.perform(put("/api/expenses/recurring/9/user/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"amount":799,"description":"Netflix 4K","nextDueDate":"2026-11-01"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Subscription updated successfully"));

        verify(userSecurity).validateUserAccess(7L);
        verify(recurringExpenseService).updateSubscription(eq(9L), anyMap());
    }

    @Test
    void deleteSubscriptionDelegatesToRecurringExpenseService() throws Exception {
        mockMvc.perform(delete("/api/expenses/recurring/12/user/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Subscription cancelled successfully"));

        verify(userSecurity).validateUserAccess(7L);
        verify(recurringExpenseService).deleteSubscription(12L);
    }

    // ─── Export & Import Endpoints ──────────────────────────────────────

    @Test
    void exportCsvReturnsAttachmentAndDelegates() throws Exception {
        byte[] csv = "date,category,amount\n2026-09-01,Food,10\n".getBytes();
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(exportService.exportExpensesToCsv(user)).thenReturn(csv);

        mockMvc.perform(get("/api/expenses/user/7/export/csv"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"expenses.csv\""))
                .andExpect(content().contentTypeCompatibleWith("text/csv"))
                .andExpect(content().bytes(csv));

        verify(exportService).exportExpensesToCsv(user);
    }

    @Test
    void exportPdfPrefersRequestParameterOverHeader() throws Exception {
        byte[] pdf = new byte[]{1, 2, 3};
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(exportService.exportExpensesToPdf(user, "USD")).thenReturn(pdf);

        mockMvc.perform(get("/api/expenses/user/7/export/pdf")
                        .queryParam("currency", "USD")
                        .header("X-Currency", "EUR"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"expenses.pdf\""))
                .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                .andExpect(content().bytes(pdf));

        verify(exportService).exportExpensesToPdf(user, "USD");
    }

    @Test
    void exportExcelFallsBackToCurrencyHeader() throws Exception {
        byte[] xlsx = new byte[]{4, 5, 6};
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(exportService.exportExpensesToExcel(user, "EUR")).thenReturn(xlsx);

        mockMvc.perform(get("/api/expenses/user/7/export/excel")
                        .header("X-Currency", "EUR"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"expenses.xlsx\""))
                .andExpect(content().contentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .andExpect(content().bytes(xlsx));

        verify(exportService).exportExpensesToExcel(user, "EUR");
    }

    @Test
    void importCsvValidatesOwnerAndDelegatesMultipartFile() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "expenses.csv", "text/csv", "Date,Category,Amount\n2026-09-01,Food,10\n".getBytes());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("imported", 1);
        result.put("failed", 0);
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(importService.importExpensesFromCsv(any(), same(user))).thenReturn(result);

        mockMvc.perform(multipart("/api/expenses/user/7/import/csv").file(file))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.imported").value(1))
                .andExpect(jsonPath("$.failed").value(0));

        verify(importService).importExpensesFromCsv(any(), same(user));
    }

    @Test
    void importJsonRejectsMissingFile() throws Exception {
        mockMvc.perform(multipart("/api/expenses/user/7/import/json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Required multipart file part is missing."));

        verifyNoInteractions(userService, importService);
    }

    @Test
    void importExcelReturnsUserNotFoundBeforeCallingImportService() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "expenses.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", new byte[]{1, 2});
        when(userService.findById(7L)).thenReturn(Optional.empty());

        mockMvc.perform(multipart("/api/expenses/user/7/import/excel").file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("User not found"));

        verify(importService, never()).importExpensesFromExcel(any(), any());
    }

    @Test
    void reconcileBankStatementDelegatesToService() throws Exception {
        User user = new User();
        user.setId(7L);
        when(userService.findById(7L)).thenReturn(Optional.of(user));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalRows", 5);
        result.put("reconciledCount", 3);
        result.put("newExpensesCount", 2);
        result.put("newIncomesCount", 0);
        result.put("message", "Reconciliation complete");
        when(importService.reconcileBankStatement(any(), same(user))).thenReturn(result);

        MockMultipartFile file = new MockMultipartFile("file", "statement.csv", "text/csv", "test".getBytes());
        mockMvc.perform(multipart("/api/expenses/user/7/import/statement").file(file))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalRows").value(5))
                .andExpect(jsonPath("$.reconciledCount").value(3))
                .andExpect(jsonPath("$.newExpensesCount").value(2));

        verify(importService).reconcileBankStatement(any(), same(user));
    }

    private static Expense expense(Long id, BigDecimal amount, String description,
                                   LocalDate date, Category category) {
        Expense expense = new Expense();
        expense.setId(id);
        expense.setAmount(amount);
        expense.setDescription(description);
        expense.setExpenseDate(date);
        expense.setCategory(category);
        return expense;
    }
}
