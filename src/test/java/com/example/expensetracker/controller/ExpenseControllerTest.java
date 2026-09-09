package com.example.expensetracker.controller;

import com.example.expensetracker.dto.ExpenseDto;
import com.example.expensetracker.dto.ExpenseRequest;
import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.BudgetRepository;
import com.example.expensetracker.repository.CategoryRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.RecurringExpenseRepository;
import com.example.expensetracker.service.ExpenseService;
import com.example.expensetracker.service.ExportService;
import com.example.expensetracker.service.ImportService;
import com.example.expensetracker.service.UserService;
import com.example.expensetracker.security.JwtService;
import com.example.expensetracker.security.UserSecurity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ExpenseController.class)
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
                        .contentType("application/json")
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
                        .contentType("application/json")
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
                        .contentType("application/json")
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
                        .contentType("application/json")
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
                        .contentType("application/json")
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
