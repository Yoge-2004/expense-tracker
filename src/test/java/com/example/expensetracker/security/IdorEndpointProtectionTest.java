package com.example.expensetracker.security;

import com.example.expensetracker.controller.*;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.BudgetRepository;
import com.example.expensetracker.repository.RecurringExpenseRepository;
import com.example.expensetracker.service.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Collections;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = {
        UserController.class,
        ExpenseController.class,
        IncomeController.class,
        SavingsGoalController.class,
        CategoryController.class,
        ReportController.class
})
@AutoConfigureMockMvc(addFilters = false)
@Import(UserSecurity.class)
@DisplayName("BOLA / IDOR Protection Tests Across Resource Controllers")
class IdorEndpointProtectionTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean private UserService userService;
    @MockitoBean private com.example.expensetracker.repository.UserRepository userRepository;
    @MockitoBean private ExpenseService expenseService;
    @MockitoBean private IncomeService incomeService;
    @MockitoBean private SavingsGoalService savingsGoalService;
    @MockitoBean private CategoryService categoryService;
    @MockitoBean private com.example.expensetracker.repository.CategoryRepository categoryRepository;
    @MockitoBean private com.example.expensetracker.repository.ExpenseRepository expenseRepository;
    @MockitoBean private MonthlyReportService monthlyReportService;
    @MockitoBean private ExportService exportService;
    @MockitoBean private ImportService importService;
    @MockitoBean private BudgetRepository budgetRepository;
    @MockitoBean private RecurringExpenseRepository recurringExpenseRepository;
    @MockitoBean private JwtService jwtService;
    @MockitoBean private CustomUserDetailsService customUserDetailsService;
    @MockitoBean private JwtAuthenticationFilter jwtAuthenticationFilter;
    @MockitoBean private PasswordEncoder passwordEncoder;

    private static final Long AUTHENTICATED_USER_ID = 1L;
    private static final Long ATTACKER_TARGET_USER_ID = 2L;

    @BeforeEach
    void setUp() {
        User authenticatedUser = new User();
        authenticatedUser.setId(AUTHENTICATED_USER_ID);
        authenticatedUser.setEmail("victim@example.com");

        CustomUserDetails userDetails = new CustomUserDetails(authenticatedUser);
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(userDetails, null, Collections.emptyList());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("UserController: Rejects accessing profile of another user with 403 Forbidden")
    void getUserProfile_otherUser_returns403() throws Exception {
        mockMvc.perform(get("/api/users/{userId}", ATTACKER_TARGET_USER_ID))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.error").value("Forbidden"))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("You do not have permission to access or modify resources belonging to another user.")));
    }

    @Test
    @DisplayName("UserController: Rejects updating security pin of another user with 403 Forbidden")
    void updateSecurityPin_otherUser_returns403() throws Exception {
        mockMvc.perform(put("/api/users/{userId}/security-pin", ATTACKER_TARGET_USER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"securityPin\":\"123456\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }

    @Test
    @DisplayName("UserController: Rejects deleting another user's account with 403 Forbidden")
    void deleteAccount_otherUser_returns403() throws Exception {
        mockMvc.perform(delete("/api/users/{userId}", ATTACKER_TARGET_USER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"Secret@123\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }

    @Test
    @DisplayName("ExpenseController: Rejects querying expenses of another user with 403 Forbidden")
    void getExpenses_otherUser_returns403() throws Exception {
        mockMvc.perform(get("/api/expenses/user/{userId}", ATTACKER_TARGET_USER_ID))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }

    @Test
    @DisplayName("ExpenseController: Rejects creating expense under another user ID with 403 Forbidden")
    void createExpense_otherUser_returns403() throws Exception {
        mockMvc.perform(post("/api/expenses/user/{userId}", ATTACKER_TARGET_USER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\":500,\"expenseDate\":\"2026-08-01\",\"categoryId\":1}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }

    @Test
    @DisplayName("ExpenseController: Rejects exporting another user's expenses with 403 Forbidden")
    void exportExpenses_otherUser_returns403() throws Exception {
        mockMvc.perform(get("/api/expenses/user/{userId}/export/csv", ATTACKER_TARGET_USER_ID))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }

    @Test
    @DisplayName("IncomeController: Rejects querying incomes of another user with 403 Forbidden")
    void getIncomes_otherUser_returns403() throws Exception {
        mockMvc.perform(get("/api/incomes/user/{userId}", ATTACKER_TARGET_USER_ID))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }

    @Test
    @DisplayName("SavingsGoalController: Rejects querying savings goals of another user with 403 Forbidden")
    void getSavingsGoals_otherUser_returns403() throws Exception {
        mockMvc.perform(get("/api/savings/goals/user/{userId}", ATTACKER_TARGET_USER_ID))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }

    @Test
    @DisplayName("CategoryController: Rejects querying categories of another user with 403 Forbidden")
    void getCategories_otherUser_returns403() throws Exception {
        mockMvc.perform(get("/api/categories/user/{userId}", ATTACKER_TARGET_USER_ID))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }

    @Test
    @DisplayName("ReportController: Rejects generating monthly report of another user with 403 Forbidden")
    void getMonthlyReport_otherUser_returns403() throws Exception {
        mockMvc.perform(get("/api/reports/monthly/user/{userId}", ATTACKER_TARGET_USER_ID))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }
}
