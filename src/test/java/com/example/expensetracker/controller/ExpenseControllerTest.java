package com.example.expensetracker.controller;

import com.example.expensetracker.model.Budget;
import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.RecurringExpense;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.BudgetRepository;
import com.example.expensetracker.repository.CategoryRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.RecurringExpenseRepository;
import com.example.expensetracker.security.CustomUserDetailsService;
import com.example.expensetracker.security.JwtAuthenticationFilter;
import com.example.expensetracker.security.JwtService;
import com.example.expensetracker.security.UserSecurity;
import com.example.expensetracker.service.ExpenseService;
import com.example.expensetracker.service.ExportService;
import com.example.expensetracker.service.ImportService;
import com.example.expensetracker.service.UserService;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
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
    @MockitoBean BudgetRepository budgetRepository;
    @MockitoBean RecurringExpenseRepository recurringExpenseRepository;
    @MockitoBean ExpenseRepository expenseRepository;
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
                .andExpect(jsonPath("$.amount").value(199.99))
                .andExpect(jsonPath("$.description").value("Lunch"))
                .andExpect(jsonPath("$.expenseDate").value("2026-09-01"))
                .andExpect(jsonPath("$.categoryId").value(1))
                .andExpect(jsonPath("$.categoryName").value("Food"));

        verify(userSecurity).validateUserAccess(7L);
        verify(userService).findById(7L);
        verify(expenseService).createExpense(argThat(e ->
                new BigDecimal("199.99").compareTo(e.getAmount()) == 0
                        && "Lunch".equals(e.getDescription())
                        && LocalDate.of(2026, 9, 1).equals(e.getExpenseDate())
                        && e.getCategory() != null
                        && Long.valueOf(1L).equals(e.getCategory().getId())), same(user));
    }

    @Test
    void createExpenseRejectsInvalidPayloadBeforeAccessOrService() throws Exception {
        mockMvc.perform(post("/api/expenses/user/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"amount":0,"description":"Invalid","expenseDate":null,"categoryId":null}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));

        verifyNoInteractions(userSecurity, userService, expenseService);
    }

    @Test
    void createExpenseReturnsBadRequestWhenUserDoesNotExist() throws Exception {
        when(userService.findById(7L)).thenReturn(Optional.empty());

        mockMvc.perform(post("/api/expenses/user/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"amount":100,"description":"Lunch","expenseDate":"2026-09-01","categoryId":1}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("User not found"));

        verify(userSecurity).validateUserAccess(7L);
        verify(expenseService, never()).createExpense(any(), any());
    }

    @Test
    void getExpensesReturnsMappedUserExpenses() throws Exception {
        Expense first = expense(10L, new BigDecimal("120.00"), "Groceries", LocalDate.of(2026, 9, 2), food);
        Expense second = expense(11L, new BigDecimal("50.00"), "Bus", LocalDate.of(2026, 9, 3), null);
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(expenseService.getUserExpenses(user)).thenReturn(List.of(first, second));

        mockMvc.perform(get("/api/expenses/user/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(10))
                .andExpect(jsonPath("$[0].categoryName").value("Food"))
                .andExpect(jsonPath("$[1].id").value(11))
                .andExpect(jsonPath("$[1].categoryId").doesNotExist());

        verify(userSecurity).validateUserAccess(7L);
        verify(expenseService).getUserExpenses(user);
    }

    @Test
    void updateExpenseLoadsCategoryAndDelegatesUpdate() throws Exception {
        Expense updated = expense(42L, new BigDecimal("225.00"), "Lunch + dessert", LocalDate.of(2026, 9, 1), food);
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(categoryRepository.findById(1L)).thenReturn(Optional.of(food));
        when(expenseService.updateExpense(eq(42L), any(Expense.class), same(user))).thenReturn(updated);

        mockMvc.perform(put("/api/expenses/42/user/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"amount":225.00,"description":"Lunch + dessert","expenseDate":"2026-09-01","categoryId":1}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(42))
                .andExpect(jsonPath("$.amount").value(225.00))
                .andExpect(jsonPath("$.categoryName").value("Food"));

        verify(userSecurity).validateUserAccess(7L);
        verify(categoryRepository).findById(1L);
        verify(expenseService).updateExpense(eq(42L), argThat(e ->
                new BigDecimal("225.00").compareTo(e.getAmount()) == 0
                        && "Lunch + dessert".equals(e.getDescription())
                        && food.equals(e.getCategory())), same(user));
    }

    @Test
    void updateExpenseRejectsUnknownCategoryBeforeServiceCall() throws Exception {
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(categoryRepository.findById(999L)).thenReturn(Optional.empty());

        mockMvc.perform(put("/api/expenses/42/user/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"amount":225.00,"description":"Lunch","expenseDate":"2026-09-01","categoryId":999}
                                """))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.message").value("Unexpected error occurred"));

        verify(expenseService, never()).updateExpense(anyLong(), any(Expense.class), any(User.class));
    }

    @Test
    void deleteExpenseValidatesAccessAndReturnsNoContent() throws Exception {
        when(userService.findById(7L)).thenReturn(Optional.of(user));

        mockMvc.perform(delete("/api/expenses/42/user/7"))
                .andExpect(status().isNoContent())
                .andExpect(content().string(""));

        verify(userSecurity).validateUserAccess(7L);
        verify(userService).findById(7L);
        verify(expenseService).deleteExpense(42L, user);
    }

    @Test
    void setBudgetCreatesOrUpdatesBudgetWithPeriodRules() throws Exception {
        Budget existing = new Budget();
        existing.setId(3L);
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(categoryRepository.findById(1L)).thenReturn(Optional.of(food));
        when(budgetRepository.findByUserAndCategoryId(user, 1L)).thenReturn(Optional.of(existing));

        mockMvc.perform(post("/api/expenses/budget/user/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"categoryId":1,"limitAmount":3000,"period":"CUSTOM","intervalDays":14,"startDate":"2026-09-01","endDate":"2026-09-15"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Budget set successfully"));

        verify(userSecurity).validateUserAccess(7L);
        verify(budgetRepository).save(argThat(b ->
                b == existing
                        && sameUser(user, b.getUser())
                        && food.equals(b.getCategory())
                        && new BigDecimal("3000").compareTo(b.getLimitAmount()) == 0
                        && "CUSTOM".equals(b.getPeriod())
                        && Integer.valueOf(14).equals(b.getIntervalDays())
                        && LocalDate.of(2026, 9, 1).equals(b.getStartDate())
                        && LocalDate.of(2026, 9, 15).equals(b.getEndDate())));
    }

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
        verifyNoInteractions(userService, categoryRepository, budgetRepository);
    }

    @Test
    void deleteBudgetByIdValidatesTheActualBudgetOwner() throws Exception {
        Budget budget = new Budget();
        budget.setId(9L);
        budget.setUser(user);
        when(budgetRepository.findById(9L)).thenReturn(Optional.of(budget));

        mockMvc.perform(delete("/api/expenses/budget/9"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Budget limit deleted successfully"));

        verify(userSecurity).validateUserAccess(7L);
        verify(budgetRepository).delete(budget);
    }

    @Test
    void deleteBudgetByIdMissingBudgetReturns404() throws Exception {
        // FIXED: previously a missing budget returned 200 OK (silent no-op), which allowed
        // authenticated users to enumerate which budget IDs existed (403 vs 200). Now we
        // throw NoSuchElementException -> 404 NOT_FOUND, matching REST conventions.
        when(budgetRepository.findById(404L)).thenReturn(Optional.empty());

        mockMvc.perform(delete("/api/expenses/budget/404"))
                .andExpect(status().isNotFound());

        verifyNoInteractions(userSecurity);
        verify(budgetRepository, never()).delete(any(Budget.class));
    }

    @Test
    void deleteBudgetByCategoryVerifiesUserAndRepositoryScope() throws Exception {
        when(userService.findById(7L)).thenReturn(Optional.of(user));

        mockMvc.perform(delete("/api/expenses/budget/user/7/category/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Budget limit deleted successfully"));

        verify(userSecurity).validateUserAccess(7L);
        verify(userService).findById(7L);
        verify(budgetRepository).deleteByUserAndCategoryId(user, 1L);
    }

    @Test
    void getBudgetStatusCalculatesSpentAmountAndPercentage() throws Exception {
        Budget budget = new Budget();
        budget.setId(3L);
        budget.setUser(user);
        budget.setCategory(food);
        budget.setLimitAmount(new BigDecimal("1000"));
        budget.setPeriod("MONTHLY");

        Expense a = expense(1L, new BigDecimal("250"), "A", LocalDate.of(2026, 9, 2), food);
        Expense b = expense(2L, new BigDecimal("100"), "B", LocalDate.of(2026, 9, 4), food);
        Category otherCategory = new Category();
        otherCategory.setId(2L);
        Expense other = expense(3L, new BigDecimal("900"), "Other", LocalDate.of(2026, 9, 4), otherCategory);

        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(budgetRepository.findByUser(user)).thenReturn(List.of(budget));
        when(expenseRepository.findByUserAndExpenseDateBetween(eq(user), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(List.of(a, b, other));

        mockMvc.perform(get("/api/expenses/budget/status/user/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].budgetId").value(3))
                .andExpect(jsonPath("$[0].categoryName").value("Food"))
                .andExpect(jsonPath("$[0].limit").value(1000))
                .andExpect(jsonPath("$[0].spent").value(350))
                .andExpect(jsonPath("$[0].percentage").value(35.0))
                .andExpect(jsonPath("$[0].period").value("MONTHLY"));
    }

    @Test
    void getBudgetStatusSupportsCustomPeriod() throws Exception {
        Budget budget = new Budget();
        budget.setId(4L);
        budget.setUser(user);
        budget.setCategory(food);
        budget.setLimitAmount(new BigDecimal("500"));
        budget.setPeriod("CUSTOM");
        budget.setStartDate(LocalDate.of(2026, 9, 1));
        budget.setEndDate(LocalDate.of(2026, 9, 10));

        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(budgetRepository.findByUser(user)).thenReturn(List.of(budget));
        when(expenseRepository.findByUserAndExpenseDateBetween(eq(user),
                eq(LocalDate.of(2026, 9, 1)), eq(LocalDate.of(2026, 9, 10))))
                .thenReturn(List.of(expense(5L, new BigDecimal("125"), "A", LocalDate.of(2026, 9, 3), food)));

        mockMvc.perform(get("/api/expenses/budget/status/user/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].spent").value(125))
                .andExpect(jsonPath("$[0].percentage").value(25.0))
                .andExpect(jsonPath("$[0].startDate").value("2026-09-01"))
                .andExpect(jsonPath("$[0].endDate").value("2026-09-10"));
    }

    @Test
    void addRecurringCreatesScheduleAndFirstExpense() throws Exception {
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(categoryRepository.findById(1L)).thenReturn(Optional.of(food));
        when(recurringExpenseRepository.save(any(RecurringExpense.class)))
                .thenAnswer(invocation -> {
                    RecurringExpense rec = invocation.getArgument(0);
                    rec.setId(8L);
                    return rec;
                });

        mockMvc.perform(post("/api/expenses/recurring/user/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"amount":649,"description":"Netflix","expenseDate":"2026-09-01","categoryId":1,"frequency":"monthly"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Recurring Expense Setup Successfully"));

        verify(recurringExpenseRepository).save(argThat(rec ->
                new BigDecimal("649").compareTo(rec.getAmount()) == 0
                        && "Netflix".equals(rec.getDescription())
                        && "MONTHLY".equals(rec.getFrequency())
                        && LocalDate.of(2026, 10, 1).equals(rec.getNextDueDate())
                        && rec.getIntervalDays() == null
                        && food.equals(rec.getCategory())
                        && user.equals(rec.getUser())));
        verify(expenseService).createExpense(argThat(first ->
                new BigDecimal("649").compareTo(first.getAmount()) == 0
                        && "Netflix".equals(first.getDescription())
                        && LocalDate.of(2026, 9, 1).equals(first.getExpenseDate())
                        && food.equals(first.getCategory())), same(user));
    }

    @Test
    void addRecurringRejectsInvalidCustomIntervalBeforeSaving() throws Exception {
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(categoryRepository.findById(1L)).thenReturn(Optional.of(food));

        mockMvc.perform(post("/api/expenses/recurring/user/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"amount":100,"description":"Custom","expenseDate":"2026-09-01","categoryId":1,"frequency":"CUSTOM","intervalDays":0}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Custom frequency requires a positive interval in days"));

        verify(recurringExpenseRepository, never()).save(any(RecurringExpense.class));
        verify(expenseService, never()).createExpense(any(Expense.class), any(User.class));
    }

    @Test
    void getUserSubscriptionsMapsCategoryAndNullCategorySafely() throws Exception {
        RecurringExpense first = recurring(3L, new BigDecimal("649"), "Netflix", LocalDate.of(2026, 10, 1), "MONTHLY", food, user);
        RecurringExpense second = recurring(4L, new BigDecimal("119"), "Spotify", LocalDate.of(2026, 10, 5), "MONTHLY", null, user);
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(recurringExpenseRepository.findByUser(user)).thenReturn(List.of(first, second));

        mockMvc.perform(get("/api/expenses/recurring/user/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(3))
                .andExpect(jsonPath("$[0].categoryName").value("Food"))
                .andExpect(jsonPath("$[1].categoryName").value("Uncategorized"))
                .andExpect(jsonPath("$[1].categoryId").doesNotExist());
    }

    @Test
    void updateSubscriptionOnlyChangesFieldsThatArePresentAndValidatesOwner() throws Exception {
        RecurringExpense rec = recurring(9L, new BigDecimal("649"), "Netflix", LocalDate.of(2026, 10, 1), "MONTHLY", food, user);
        when(recurringExpenseRepository.findById(9L)).thenReturn(Optional.of(rec));

        mockMvc.perform(put("/api/expenses/recurring/9/user/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"amount":799,"description":"Netflix 4K","nextDueDate":"2026-11-01"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Subscription updated successfully"));

        verify(userSecurity).validateUserAccess(7L);
        verify(recurringExpenseRepository).save(argThat(updated ->
                new BigDecimal("799").compareTo(updated.getAmount()) == 0
                        && "Netflix 4K".equals(updated.getDescription())
                        && LocalDate.of(2026, 11, 1).equals(updated.getNextDueDate())
                        && "MONTHLY".equals(updated.getFrequency())));
    }

    @Test
    void updateSubscriptionRejectsInvalidCustomInterval() throws Exception {
        RecurringExpense rec = recurring(9L, new BigDecimal("649"), "Netflix", LocalDate.of(2026, 10, 1), "MONTHLY", food, user);
        when(recurringExpenseRepository.findById(9L)).thenReturn(Optional.of(rec));

        mockMvc.perform(put("/api/expenses/recurring/9")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"frequency":"CUSTOM","intervalDays":0}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Custom frequency requires a positive interval in days"));

        verify(recurringExpenseRepository, never()).save(any(RecurringExpense.class));
    }

    @Test
    void deleteSubscriptionValidatesExistingOwnerAndDeletesEntity() throws Exception {
        // FIXED: previously called deleteById(recId) which (a) didn't validate ownership for
        // missing IDs (returned 200 OK with no error) and (b) threw EmptyResultDataAccessException
        // -> 500 if the ID didn't exist. Now we findById + validateUserAccess + delete(entity),
        // which gives correct 400 BAD_REQUEST for missing IDs and 403 for ownership mismatch.
        RecurringExpense rec = recurring(12L, new BigDecimal("119"), "Spotify", LocalDate.of(2026, 10, 5), "MONTHLY", food, user);
        when(recurringExpenseRepository.findById(12L)).thenReturn(Optional.of(rec));

        mockMvc.perform(delete("/api/expenses/recurring/12/user/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Subscription cancelled successfully"));

        verify(userSecurity).validateUserAccess(7L);
        verify(recurringExpenseRepository).delete(rec);
    }

    @Test
    void exportCsvReturnsAttachmentAndDelegates() throws Exception {
        byte[] csv = "date,category,amount\n2026-09-01,Food,10\n".getBytes();
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(exportService.exportExpensesToCsv(user)).thenReturn(csv);

        mockMvc.perform(get("/api/expenses/user/7/export/csv"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"expenses.csv\""))
                .andExpect(content().contentType("text/csv"))
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
                "file", "expenses.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", new byte[]{1, 2});
        when(userService.findById(7L)).thenReturn(Optional.empty());

        mockMvc.perform(multipart("/api/expenses/user/7/import/excel").file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("User not found"));

        verify(importService, never()).importExpensesFromExcel(any(), any());
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

    private static RecurringExpense recurring(Long id, BigDecimal amount, String description,
                                               LocalDate nextDueDate, String frequency,
                                               Category category, User user) {
        RecurringExpense recurring = new RecurringExpense();
        recurring.setId(id);
        recurring.setAmount(amount);
        recurring.setDescription(description);
        recurring.setNextDueDate(nextDueDate);
        recurring.setFrequency(frequency);
        recurring.setCategory(category);
        recurring.setUser(user);
        return recurring;
    }

    private static boolean sameUser(User expected, User actual) {
        return expected == actual;
    }
}
