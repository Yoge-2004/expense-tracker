package com.example.expensetracker.controller;

import com.example.expensetracker.model.*;
import com.example.expensetracker.repository.BudgetRepository;
import com.example.expensetracker.repository.CategoryRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.RecurringExpenseRepository;
import com.example.expensetracker.security.CustomUserDetailsService;
import com.example.expensetracker.security.JwtService;
import com.example.expensetracker.service.ExpenseService;
import com.example.expensetracker.service.ExportService;
import com.example.expensetracker.service.ImportService;
import com.example.expensetracker.service.UserService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Stream;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Unit tests for {@link ExpenseController}.
 *
 * <p>Endpoints covered:</p>
 * <ul>
 *   <li>POST   /api/expenses/user/{userId}</li>
 *   <li>GET    /api/expenses/user/{userId}</li>
 *   <li>DELETE /api/expenses/{expenseId}/user/{userId}</li>
 *   <li>PUT    /api/expenses/{expenseId}/user/{userId}</li>
 *   <li>POST   /api/expenses/budget/user/{userId}</li>
 *   <li>GET    /api/expenses/budget/status/user/{userId}</li>
 *   <li>POST   /api/expenses/recurring/user/{userId}</li>
 *   <li>GET    /api/expenses/recurring/user/{userId}</li>
 *   <li>DELETE /api/expenses/recurring/{recId}</li>
 *   <li>PUT    /api/expenses/recurring/{recId}</li>
 * </ul>
 *
 * @author Yogeshwaran
 */
@WebMvcTest(ExpenseController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("ExpenseController Tests")
class ExpenseControllerTest {

    @Autowired MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());

    @MockitoBean ExpenseService expenseService;
    @MockitoBean UserService userService;
    @MockitoBean CategoryRepository categoryRepository;
    @MockitoBean BudgetRepository budgetRepository;
    @MockitoBean RecurringExpenseRepository recurringExpenseRepository;
    @MockitoBean ExpenseRepository expenseRepository;
    @MockitoBean ExportService exportService;
    @MockitoBean ImportService importService;
    @MockitoBean JwtService jwtService;
    @MockitoBean CustomUserDetailsService customUserDetailsService;

    private User sampleUser;
    private Category foodCategory;
    private Expense sampleExpense;

    @BeforeEach
    void setUp() {
        sampleUser = new User();
        sampleUser.setId(1L);
        sampleUser.setName("Yogeshwaran");
        sampleUser.setEmail("yoge@example.com");
        sampleUser.setEnabled(true);

        when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));

        foodCategory = new Category();
        foodCategory.setId(1L);
        foodCategory.setName("Food");
        foodCategory.setUser(sampleUser);

        sampleExpense = new Expense();
        sampleExpense.setId(10L);
        sampleExpense.setAmount(new BigDecimal("250.00"));
        sampleExpense.setDescription("Lunch");
        sampleExpense.setExpenseDate(LocalDate.of(2025, 6, 15));
        sampleExpense.setUser(sampleUser);
        sampleExpense.setCategory(foodCategory);
    }

    // ══════════════════════════════════════════════════════════════════
    //  EXPENSE CRUD
    // ══════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("POST /api/expenses/user/{userId}")
    class CreateExpense {

        @Test
        @WithMockUser
        @DisplayName("→ 201 Created on valid expense")
        void validExpense_returns201() throws Exception {
            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            when(expenseService.createExpense(any(Expense.class), eq(sampleUser)))
                    .thenReturn(sampleExpense);

            Map<String, Object> body = Map.of(
                    "amount", 250.00,
                    "description", "Lunch",
                    "expenseDate", "2025-06-15",
                    "categoryId", 1
            );

            mockMvc.perform(post("/api/expenses/user/1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.id").value(10))
                    .andExpect(jsonPath("$.amount").value(250.00))
                    .andExpect(jsonPath("$.description").value("Lunch"))
                    .andExpect(jsonPath("$.categoryName").value("Food"));
        }

        @Test
        @WithMockUser
        @DisplayName("→ 400 Bad Request when amount is missing")
        void missingAmount_returns400() throws Exception {
            Map<String, Object> body = Map.of(
                    "description", "Lunch",
                    "expenseDate", "2025-06-15",
                    "categoryId", 1
            );

            mockMvc.perform(post("/api/expenses/user/1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @WithMockUser
        @DisplayName("→ 400 Bad Request when amount is negative")
        void negativeAmount_returns400() throws Exception {
            Map<String, Object> body = Map.of(
                    "amount", -100.00,
                    "description", "Refund",
                    "expenseDate", "2025-06-15",
                    "categoryId", 1
            );

            mockMvc.perform(post("/api/expenses/user/1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @WithMockUser
        @DisplayName("→ 400 Bad Request when date is missing")
        void missingDate_returns400() throws Exception {
            Map<String, Object> body = Map.of(
                    "amount", 250.00,
                    "description", "Lunch",
                    "categoryId", 1
            );

            mockMvc.perform(post("/api/expenses/user/1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @WithMockUser
        @DisplayName("→ 400 Bad Request when category not found")
        void categoryNotFound_returns400() throws Exception {
            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            when(expenseService.createExpense(any(Expense.class), eq(sampleUser)))
                    .thenThrow(new IllegalArgumentException("Category not found"));

            Map<String, Object> body = Map.of(
                    "amount", 250.00,
                    "description", "Lunch",
                    "expenseDate", "2025-06-15",
                    "categoryId", 999
            );

            mockMvc.perform(post("/api/expenses/user/1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value("Category not found"));
        }

        @Test
        @WithMockUser
        @DisplayName("→ 400 Bad Request when user not found")
        void userNotFound_returns400() throws Exception {
            when(userService.findById(99L)).thenReturn(Optional.empty());

            Map<String, Object> body = Map.of(
                    "amount", 250.00,
                    "description", "Lunch",
                    "expenseDate", "2025-06-15",
                    "categoryId", 1
            );

            mockMvc.perform(post("/api/expenses/user/99")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isBadRequest());
        }
    }

    @Nested
    @DisplayName("GET /api/expenses/user/{userId}")
    class GetExpenses {

        @Test
        @WithMockUser
        @DisplayName("→ 200 OK with expense list")
        void returnsExpenseList() throws Exception {
            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            when(expenseService.getUserExpenses(sampleUser)).thenReturn(List.of(sampleExpense));

            mockMvc.perform(get("/api/expenses/user/1"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(1))
                    .andExpect(jsonPath("$[0].id").value(10))
                    .andExpect(jsonPath("$[0].amount").value(250.00))
                    .andExpect(jsonPath("$[0].categoryName").value("Food"));
        }

        @Test
        @WithMockUser
        @DisplayName("→ 200 OK with empty list when no expenses")
        void noExpenses_returnsEmptyList() throws Exception {
            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            when(expenseService.getUserExpenses(sampleUser)).thenReturn(List.of());

            mockMvc.perform(get("/api/expenses/user/1"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(0));
        }

        @Test
        @WithMockUser
        @DisplayName("→ 400 Bad Request when user not found")
        void userNotFound_returns400() throws Exception {
            when(userService.findById(99L)).thenReturn(Optional.empty());

            mockMvc.perform(get("/api/expenses/user/99"))
                    .andExpect(status().isBadRequest());
        }
    }

    @Nested
    @DisplayName("DELETE /api/expenses/{expenseId}/user/{userId}")
    class DeleteExpense {

        @Test
        @WithMockUser
        @DisplayName("→ 204 No Content on successful deletion")
        void validDeletion_returns204() throws Exception {
            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            doNothing().when(expenseService).deleteExpense(10L, sampleUser);

            mockMvc.perform(delete("/api/expenses/10/user/1"))
                    .andExpect(status().isNoContent());

            verify(expenseService).deleteExpense(10L, sampleUser);
        }

        @Test
        @WithMockUser
        @DisplayName("→ 400 Bad Request when expense not found")
        void expenseNotFound_returns400() throws Exception {
            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            doThrow(new IllegalArgumentException("Expense not found"))
                    .when(expenseService).deleteExpense(999L, sampleUser);

            mockMvc.perform(delete("/api/expenses/999/user/1"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value("Expense not found"));
        }

        @Test
        @WithMockUser
        @DisplayName("→ 400 Bad Request when expense belongs to different user")
        void wrongUser_returns400() throws Exception {
            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            doThrow(new IllegalArgumentException("Expense does not belong to this user"))
                    .when(expenseService).deleteExpense(10L, sampleUser);

            mockMvc.perform(delete("/api/expenses/10/user/1"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value("Expense does not belong to this user"));
        }
    }

    @Nested
    @DisplayName("PUT /api/expenses/{expenseId}/user/{userId}")
    class UpdateExpense {

        @Test
        @WithMockUser
        @DisplayName("→ 200 OK with updated expense (Final Fix)")
        void finalUpdateExpenseFix_returns200() throws Exception {
            Expense updated = new Expense();
            updated.setId(10L);
            updated.setAmount(new BigDecimal("300.00"));
            updated.setDescription("Dinner");
            updated.setExpenseDate(LocalDate.of(2025, 6, 20));
            updated.setUser(sampleUser);
            updated.setCategory(foodCategory);

            when(userService.findById(anyLong())).thenReturn(Optional.of(sampleUser));
            when(categoryRepository.findById(1L)).thenReturn(Optional.of(foodCategory));
            when(expenseService.updateExpense(anyLong(), any(Expense.class), any(User.class)))
                    .thenReturn(updated);

            Map<String, Object> body = Map.of(
                    "amount", 300.00,
                    "description", "Dinner",
                    "expenseDate", "2025-06-20",
                    "categoryId", 1
            );

            mockMvc.perform(put("/api/expenses/10/user/1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(10))
                    .andExpect(jsonPath("$.amount").value(300.00))
                    .andExpect(jsonPath("$.description").value("Dinner"));
        }

        @Test
        @WithMockUser
        @DisplayName("→ 500 when expense not found")
        void expenseNotFound_returns500() throws Exception {
            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            when(expenseService.updateExpense(eq(999L), any(Expense.class), eq(sampleUser)))
                    .thenThrow(new RuntimeException("Expense not found"));

            mockMvc.perform(put("/api/expenses/999/user/1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(
                                    Map.of("amount", 100.00,
                                            "description", "Test",
                                            "expenseDate", "2025-06-15"))))
                    .andExpect(status().isInternalServerError());
        }
    }

    // ══════════════════════════════════════════════════════════════════
    //  BUDGET
    // ══════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("POST /api/expenses/budget/user/{userId}")
    class SetBudget {

        @Test
        @WithMockUser
        @DisplayName("→ 200 OK when budget is set successfully")
        void validBudget_returns200() throws Exception {
            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            when(categoryRepository.findById(1L)).thenReturn(Optional.of(foodCategory));
            when(budgetRepository.findByUserAndCategoryId(sampleUser, 1L))
                    .thenReturn(Optional.empty());
            when(budgetRepository.save(any(Budget.class))).thenAnswer(i -> i.getArgument(0));

            Map<String, Object> body = Map.of("categoryId", 1, "limitAmount", 5000.00);

            mockMvc.perform(post("/api/expenses/budget/user/1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("Budget set successfully"));
        }

        @Test
        @WithMockUser
        @DisplayName("→ 200 OK when existing budget is updated")
        void existingBudget_updatesSuccessfully() throws Exception {
            Budget existing = new Budget();
            existing.setId(5L);
            existing.setLimitAmount(new BigDecimal("3000.00"));
            existing.setUser(sampleUser);
            existing.setCategory(foodCategory);

            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            when(categoryRepository.findById(1L)).thenReturn(Optional.of(foodCategory));
            when(budgetRepository.findByUserAndCategoryId(sampleUser, 1L))
                    .thenReturn(Optional.of(existing));
            when(budgetRepository.save(any(Budget.class))).thenAnswer(i -> i.getArgument(0));

            Map<String, Object> body = Map.of("categoryId", 1, "limitAmount", 6000.00);

            mockMvc.perform(post("/api/expenses/budget/user/1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("Budget set successfully"));
        }

        @Test
        @WithMockUser
        @DisplayName("→ 400 Bad Request when limit amount is zero")
        void zeroLimit_returns400() throws Exception {
            Map<String, Object> body = Map.of("categoryId", 1, "limitAmount", 0);

            mockMvc.perform(post("/api/expenses/budget/user/1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("Budget limit must be a positive number"));
        }

        @Test
        @WithMockUser
        @DisplayName("→ 400 Bad Request when limit amount is negative")
        void negativeLimit_returns400() throws Exception {
            Map<String, Object> body = Map.of("categoryId", 1, "limitAmount", -100);

            mockMvc.perform(post("/api/expenses/budget/user/1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @WithMockUser
        @DisplayName("→ 400 Bad Request when user not found")
        void userNotFound_returns400() throws Exception {
            when(userService.findById(99L)).thenReturn(Optional.empty());

            Map<String, Object> body = Map.of("categoryId", 1, "limitAmount", 5000.00);

            mockMvc.perform(post("/api/expenses/budget/user/99")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isBadRequest());
        }
    }

    @Nested
    @DisplayName("GET /api/expenses/budget/status/user/{userId}")
    class GetBudgetStatus {

        @Test
        @WithMockUser
        @DisplayName("→ 200 OK with budget status list")
        void returnsBudgetStatusList() throws Exception {
            Budget budget = new Budget();
            budget.setId(1L);
            budget.setLimitAmount(new BigDecimal("5000.00"));
            budget.setUser(sampleUser);
            budget.setCategory(foodCategory);

            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            when(budgetRepository.findByUser(sampleUser)).thenReturn(List.of(budget));
            when(expenseRepository.findByUserAndExpenseDateBetween(
                    eq(sampleUser), any(LocalDate.class), any(LocalDate.class)))
                    .thenReturn(List.of(sampleExpense));

            mockMvc.perform(get("/api/expenses/budget/status/user/1"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(1))
                    .andExpect(jsonPath("$[0].categoryName").value("Food"))
                    .andExpect(jsonPath("$[0].limit").value(5000.00))
                    .andExpect(jsonPath("$[0].spent").value(250.00));
        }

        @Test
        @WithMockUser
        @DisplayName("→ 200 OK with empty list when no budgets configured")
        void noBudgets_returnsEmptyList() throws Exception {
            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            when(budgetRepository.findByUser(sampleUser)).thenReturn(List.of());

            mockMvc.perform(get("/api/expenses/budget/status/user/1"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(0));
        }

        @Test
        @WithMockUser
        @DisplayName("→ 400 Bad Request when user not found")
        void userNotFound_returns400() throws Exception {
            when(userService.findById(99L)).thenReturn(Optional.empty());

            mockMvc.perform(get("/api/expenses/budget/status/user/99"))
                    .andExpect(status().isBadRequest());
        }
    }

    // ══════════════════════════════════════════════════════════════════
    //  RECURRING EXPENSES
    // ══════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("POST /api/expenses/recurring/user/{userId}")
    class AddRecurring {

        static Stream<Arguments> supportedFrequencies() {
            return Stream.of(
                    Arguments.of("DAILY", null, LocalDate.of(2025, 6, 2)),
                    Arguments.of("WEEKLY", null, LocalDate.of(2025, 6, 8)),
                    Arguments.of("MONTHLY", null, LocalDate.of(2025, 7, 1)),
                    Arguments.of("YEARLY", null, LocalDate.of(2026, 6, 1)),
                    Arguments.of("CUSTOM", 10, LocalDate.of(2025, 6, 11))
            );
        }

        @Test
        @WithMockUser
        @DisplayName("→ 200 OK on valid recurring expense setup")
        void validRecurring_returns200() throws Exception {
            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            when(categoryRepository.findById(1L)).thenReturn(Optional.of(foodCategory));
            when(recurringExpenseRepository.save(any(RecurringExpense.class)))
                    .thenAnswer(i -> i.getArgument(0));
            when(expenseService.createExpense(any(Expense.class), eq(sampleUser)))
                    .thenReturn(sampleExpense);

            Map<String, Object> body = Map.of(
                    "amount", 499.00,
                    "description", "Netflix",
                    "expenseDate", "2025-06-01",
                    "categoryId", 1
            );

            mockMvc.perform(post("/api/expenses/recurring/user/1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("Recurring Expense Setup Successfully"));
        }

        @ParameterizedTest(name = "{0} schedules the correct next occurrence")
        @MethodSource("supportedFrequencies")
        @WithMockUser
        void supportedFrequency_setsCorrectSchedule(String frequency, Integer intervalDays,
                                                    LocalDate expectedNextDueDate) throws Exception {
            when(categoryRepository.findById(1L)).thenReturn(Optional.of(foodCategory));
            when(recurringExpenseRepository.save(any(RecurringExpense.class)))
                    .thenAnswer(i -> i.getArgument(0));
            when(expenseService.createExpense(any(Expense.class), eq(sampleUser)))
                    .thenReturn(sampleExpense);

            Map<String, Object> body = new HashMap<>(Map.of(
                    "amount", 499.00,
                    "description", "Subscription",
                    "expenseDate", "2025-06-01",
                    "categoryId", 1,
                    "frequency", frequency
            ));
            if (intervalDays != null) body.put("intervalDays", intervalDays);

            mockMvc.perform(post("/api/expenses/recurring/user/1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isOk());

            ArgumentCaptor<RecurringExpense> subscription = ArgumentCaptor.forClass(RecurringExpense.class);
            verify(recurringExpenseRepository).save(subscription.capture());
            assertThat(subscription.getValue().getFrequency()).isEqualTo(frequency);
            assertThat(subscription.getValue().getIntervalDays()).isEqualTo(intervalDays);
            assertThat(subscription.getValue().getNextDueDate()).isEqualTo(expectedNextDueDate);
        }

        @Test
        @WithMockUser
        @DisplayName("→ 400 Bad Request when CUSTOM frequency has no positive day interval")
        void customFrequency_withoutPositiveInterval_returns400() throws Exception {
            when(categoryRepository.findById(1L)).thenReturn(Optional.of(foodCategory));
            Map<String, Object> body = Map.of(
                    "amount", 499.00, "description", "Subscription", "expenseDate", "2025-06-01",
                    "categoryId", 1, "frequency", "CUSTOM", "intervalDays", 0
            );

            mockMvc.perform(post("/api/expenses/recurring/user/1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value("Custom frequency requires a positive interval in days"));

            verify(recurringExpenseRepository, never()).save(any());
        }

        @Test
        @WithMockUser
        @DisplayName("→ 400 Bad Request when user not found")
        void userNotFound_returns400() throws Exception {
            when(userService.findById(99L)).thenReturn(Optional.empty());

            Map<String, Object> body = Map.of(
                    "amount", 499.00,
                    "description", "Netflix",
                    "expenseDate", "2025-06-01",
                    "categoryId", 1
            );

            mockMvc.perform(post("/api/expenses/recurring/user/99")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @WithMockUser
        @DisplayName("→ 400 Bad Request when category not found")
        void categoryNotFound_returns400() throws Exception {
            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            when(categoryRepository.findById(999L)).thenReturn(Optional.empty());

            Map<String, Object> body = Map.of(
                    "amount", 499.00,
                    "description", "Netflix",
                    "expenseDate", "2025-06-01",
                    "categoryId", 999
            );

            mockMvc.perform(post("/api/expenses/recurring/user/1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isBadRequest());
        }
    }

    @Nested
    @DisplayName("GET /api/expenses/recurring/user/{userId}")
    class GetSubscriptions {

        @Test
        @WithMockUser
        @DisplayName("→ 200 OK with list of subscriptions")
        void returnsSubscriptionList() throws Exception {
            RecurringExpense rec = new RecurringExpense();
            rec.setId(20L);
            rec.setAmount(new BigDecimal("499.00"));
            rec.setDescription("Netflix");
            rec.setFrequency("MONTHLY");
            rec.setNextDueDate(LocalDate.of(2025, 7, 1));
            rec.setCategory(foodCategory);
            rec.setUser(sampleUser);

            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            when(recurringExpenseRepository.findByUser(sampleUser)).thenReturn(List.of(rec));

            mockMvc.perform(get("/api/expenses/recurring/user/1"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(1))
                    .andExpect(jsonPath("$[0].id").value(20))
                    .andExpect(jsonPath("$[0].description").value("Netflix"))
                    .andExpect(jsonPath("$[0].frequency").value("MONTHLY"))
                    .andExpect(jsonPath("$[0].categoryName").value("Food"));
        }

        @Test
        @WithMockUser
        @DisplayName("→ custom subscriptions include their day interval")
        void customSubscription_includesIntervalDays() throws Exception {
            RecurringExpense rec = new RecurringExpense();
            rec.setId(22L);
            rec.setAmount(new BigDecimal("299.00"));
            rec.setDescription("Medication");
            rec.setFrequency("CUSTOM");
            rec.setIntervalDays(14);
            rec.setNextDueDate(LocalDate.of(2025, 6, 15));
            rec.setUser(sampleUser);

            when(recurringExpenseRepository.findByUser(sampleUser)).thenReturn(List.of(rec));

            mockMvc.perform(get("/api/expenses/recurring/user/1"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].frequency").value("CUSTOM"))
                    .andExpect(jsonPath("$[0].intervalDays").value(14));
        }

        @Test
        @WithMockUser
        @DisplayName("→ 200 OK with empty list when no subscriptions")
        void noSubscriptions_returnsEmptyList() throws Exception {
            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            when(recurringExpenseRepository.findByUser(sampleUser)).thenReturn(List.of());

            mockMvc.perform(get("/api/expenses/recurring/user/1"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(0));
        }

        @Test
        @WithMockUser
        @DisplayName("→ 200 OK — subscription with no category shows 'Uncategorized'")
        void noCategory_showsUncategorized() throws Exception {
            RecurringExpense rec = new RecurringExpense();
            rec.setId(21L);
            rec.setAmount(new BigDecimal("199.00"));
            rec.setDescription("Gym");
            rec.setFrequency("MONTHLY");
            rec.setNextDueDate(LocalDate.of(2025, 7, 1));
            rec.setCategory(null);
            rec.setUser(sampleUser);

            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            when(recurringExpenseRepository.findByUser(sampleUser)).thenReturn(List.of(rec));

            mockMvc.perform(get("/api/expenses/recurring/user/1"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].categoryName").value("Uncategorized"));
        }
    }

    @Nested
    @DisplayName("DELETE /api/expenses/recurring/{recId}")
    class DeleteSubscription {

        @Test
        @WithMockUser
        @DisplayName("→ 200 OK on successful cancellation")
        void validDeletion_returns200() throws Exception {
            doNothing().when(recurringExpenseRepository).deleteById(20L);

            mockMvc.perform(delete("/api/expenses/recurring/20"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("Subscription cancelled successfully"));

            verify(recurringExpenseRepository).deleteById(20L);
        }
    }

    @Nested
    @DisplayName("PUT /api/expenses/recurring/{recId}")
    class UpdateSubscription {

        @Test
        @WithMockUser
        @DisplayName("→ 200 OK when amount and description are updated")
        void validUpdateSubscription_returns200() throws Exception {
            RecurringExpense rec = new RecurringExpense();
            rec.setId(20L);
            rec.setAmount(new BigDecimal("499.00"));
            rec.setDescription("Netflix");
            rec.setFrequency("MONTHLY");
            rec.setNextDueDate(LocalDate.of(2025, 7, 1));
            rec.setUser(sampleUser);

            when(recurringExpenseRepository.findById(20L)).thenReturn(Optional.of(rec));
            when(recurringExpenseRepository.save(any(RecurringExpense.class)))
                    .thenAnswer(i -> i.getArgument(0));

            Map<String, Object> updates = new HashMap<>();
            updates.put("amount", 599.00);
            updates.put("description", "Netflix Premium");

            mockMvc.perform(put("/api/expenses/recurring/20")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(updates)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("Subscription updated successfully"));

            verify(recurringExpenseRepository).save(any(RecurringExpense.class));
        }

        @Test
        @WithMockUser
        @DisplayName("→ 200 OK when nextDueDate is updated")
        void updateNextDueDate_returns200() throws Exception {
            RecurringExpense rec = new RecurringExpense();
            rec.setId(20L);
            rec.setAmount(new BigDecimal("499.00"));
            rec.setDescription("Netflix");
            rec.setFrequency("MONTHLY");
            rec.setNextDueDate(LocalDate.of(2025, 7, 1));
            rec.setUser(sampleUser);

            when(recurringExpenseRepository.findById(20L)).thenReturn(Optional.of(rec));
            when(recurringExpenseRepository.save(any(RecurringExpense.class)))
                    .thenAnswer(i -> i.getArgument(0));

            Map<String, Object> updates = Map.of("nextDueDate", "2025-08-01");

            mockMvc.perform(put("/api/expenses/recurring/20")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(updates)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("Subscription updated successfully"));
        }

        @Test
        @WithMockUser
        @DisplayName("→ 400 Bad Request when subscription not found")
        void notFound_returns400() throws Exception {
            when(recurringExpenseRepository.findById(999L)).thenReturn(Optional.empty());

            mockMvc.perform(put("/api/expenses/recurring/999")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(
                                    Map.of("amount", 600.00))))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value("Subscription not found"));
        }
    }

    // ─────────────────────────── EXPORT & IMPORT & BUDGET DELETION TESTS ───────────────────────────

    @Nested
    @DisplayName("Export & Import & Budget Deletion Endpoints")
    class ExportImportBudgetDeletionTests {

        @Test
        @WithMockUser
        @DisplayName("GET /api/expenses/user/{userId}/export/csv → 200 OK with CSV file header")
        void exportCsv_returns200() throws Exception {
            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            when(exportService.exportExpensesToCsv(sampleUser)).thenReturn("ID,Date,Category\n".getBytes());

            mockMvc.perform(get("/api/expenses/user/1/export/csv"))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Content-Disposition", "attachment; filename=\"expenses.csv\""));
        }

        @Test
        @WithMockUser
        @DisplayName("GET /api/expenses/user/{userId}/export/json → 200 OK with JSON attachment")
        void exportJson_returns200() throws Exception {
            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            when(exportService.exportExpensesToJson(sampleUser)).thenReturn("[]".getBytes());

            mockMvc.perform(get("/api/expenses/user/1/export/json"))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Content-Disposition", "attachment; filename=\"expenses.json\""));
        }

        @Test
        @WithMockUser
        @DisplayName("GET /api/expenses/user/{userId}/export/pdf → 200 OK with PDF report attachment")
        void exportPdf_returns200() throws Exception {
            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            when(exportService.exportExpensesToPdf(sampleUser)).thenReturn("%PDF-1.4".getBytes());

            mockMvc.perform(get("/api/expenses/user/1/export/pdf"))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Content-Disposition", "attachment; filename=\"expenses.pdf\""));
        }

        @Test
        @WithMockUser
        @DisplayName("GET /api/expenses/user/{userId}/export/excel → 200 OK with Excel attachment")
        void exportExcel_returns200() throws Exception {
            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            when(exportService.exportExpensesToExcel(sampleUser)).thenReturn("PK".getBytes());

            mockMvc.perform(get("/api/expenses/user/1/export/excel"))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Content-Disposition", "attachment; filename=\"expenses.xlsx\""));
        }

        @Test
        @WithMockUser
        @DisplayName("DELETE /api/expenses/budget/{budgetId} → 200 OK on successful deletion")
        void deleteBudgetById_returns200() throws Exception {
            doNothing().when(budgetRepository).deleteById(5L);

            mockMvc.perform(delete("/api/expenses/budget/5"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("Budget limit deleted successfully"));
        }

        @Test
        @WithMockUser
        @DisplayName("POST /api/expenses/user/{userId}/import/csv → 200 OK on valid CSV file upload")
        void importCsv_returns200() throws Exception {
            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            when(importService.importExpensesFromCsv(any(), eq(sampleUser)))
                    .thenReturn(Map.of("message", "Imported 1 expense successfully."));

            String csvContent = "ID,Date,Category,Amount,Description\n1,2025-06-01,Food,150.00,Dinner\n";
            org.springframework.mock.web.MockMultipartFile file =
                    new org.springframework.mock.web.MockMultipartFile("file", "expenses.csv", "text/csv", csvContent.getBytes());

            mockMvc.perform(multipart("/api/expenses/user/1/import/csv").file(file))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("Imported 1 expense successfully."));
        }

        @Test
        @WithMockUser
        @DisplayName("POST /api/expenses/user/{userId}/import/json → 200 OK on valid JSON file upload")
        void importJson_returns200() throws Exception {
            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            when(importService.importExpensesFromJson(any(), eq(sampleUser)))
                    .thenReturn(Map.of("message", "Imported 2 expenses successfully"));

            String jsonContent = "[{\"amount\": 100.0, \"description\": \"Test\"}]";
            org.springframework.mock.web.MockMultipartFile file =
                    new org.springframework.mock.web.MockMultipartFile("file", "expenses.json", "application/json", jsonContent.getBytes());

            mockMvc.perform(multipart("/api/expenses/user/1/import/json").file(file))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("Imported 2 expenses successfully"));
        }

        @Test
        @WithMockUser
        @DisplayName("POST /api/expenses/user/{userId}/import/excel → 200 OK on valid Excel file upload")
        void importExcel_returns200() throws Exception {
            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            when(importService.importExpensesFromExcel(any(), eq(sampleUser)))
                    .thenReturn(Map.of("message", "Imported 3 expenses successfully."));

            org.springframework.mock.web.MockMultipartFile file =
                    new org.springframework.mock.web.MockMultipartFile("file", "expenses.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "dummy".getBytes());

            mockMvc.perform(multipart("/api/expenses/user/1/import/excel").file(file))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("Imported 3 expenses successfully."));
        }
    }
}
