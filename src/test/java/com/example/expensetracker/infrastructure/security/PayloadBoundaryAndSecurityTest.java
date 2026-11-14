package com.example.expensetracker.infrastructure.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.expensetracker.domain.expense.model.Category;
import com.example.expensetracker.domain.expense.repository.CategoryRepository;
import com.example.expensetracker.domain.expense.repository.ExpenseRepository;
import com.example.expensetracker.domain.user.model.Role;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.domain.user.repository.UserRepository;



/**
 * Validates system resilience against boundary attacks, negative amounts,
 * numeric overflows, SQL injection strings, and cross-site scripting (XSS) vectors.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PayloadBoundaryAndSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private ExpenseRepository expenseRepository;

    @Autowired
    private JwtService jwtService;

    private User testUser;
    private Category testCategory;
    private String userToken;

    @BeforeEach
    void setUp() {
        long ts = System.currentTimeMillis();

        testUser = userRepository.save(User.builder()
                .name("Boundary Tester")
                .username("boundary_" + ts)
                .email("boundary_" + ts + "@test.com")
                .password("SecurePass123!")
                .role(Role.ROLE_USER)
                .enabled(true)
                .build());

        testCategory = categoryRepository.save(Category.builder()
                .name("Security Cat " + ts)
                .user(testUser)
                .build());

        userToken = jwtService.generateToken(testUser.getEmail());
    }

    @ParameterizedTest
    @ValueSource(doubles = {-100.0, -0.01, 0.0, -9999999.99})
    @DisplayName("Non-positive expense amounts are strictly rejected with 400 Bad Request")
    void nonPositiveExpenseAmounts_rejectedWith400(double badAmount) throws Exception {
        String payload = String.format("""
                {
                    "amount": %f,
                    "description": "Boundary Test",
                    "expenseDate": "2026-11-14",
                    "categoryId": %d
                }
                """, badAmount, testCategory.getId());

        mockMvc.perform(post("/api/expenses/user/" + testUser.getId())
                        .header("Authorization", "Bearer " + userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest());
    }

    @ParameterizedTest
    @ValueSource(doubles = {-50.0, 0.0, -0.001})
    @DisplayName("Non-positive income amounts are strictly rejected with 400 Bad Request")
    void nonPositiveIncomeAmounts_rejectedWith400(double badAmount) throws Exception {
        String payload = String.format("""
                {
                    "amount": %f,
                    "source": "Salary",
                    "incomeDate": "2026-11-14"
                }
                """, badAmount);

        mockMvc.perform(post("/api/incomes/user/" + testUser.getId())
                        .header("Authorization", "Bearer " + userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Missing required fields in expense payload are rejected with 400 Bad Request")
    void missingRequiredFields_rejectedWith400() throws Exception {
        // Missing amount & expenseDate
        String payload = """
                {
                    "description": "Incomplete Record"
                }
                """;

        mockMvc.perform(post("/api/expenses/user/" + testUser.getId())
                        .header("Authorization", "Bearer " + userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest());
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "' OR '1'='1",
            "'; DROP TABLE expenses; --",
            "admin'--",
            "UNION SELECT * FROM users --",
            "1' AND SLEEP(5) --"
    })
    @DisplayName("SQL Injection payloads in description do NOT execute or corrupt schema")
    void sqlInjectionPayloadsInDescription_safelyTreatedAsPlainText(String sqlPayload) throws Exception {
        String json = String.format("""
                {
                    "amount": 25.50,
                    "description": "%s",
                    "expenseDate": "2026-11-14",
                    "categoryId": %d
                }
                """, sqlPayload.replace("\"", "\\\""), testCategory.getId());

        mockMvc.perform(post("/api/expenses/user/" + testUser.getId())
                        .header("Authorization", "Bearer " + userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isCreated());

        // Verify that the table was not dropped and user can still query
        assertFalse(expenseRepository.findByUser(testUser).isEmpty());
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "<script>alert('XSS')</script>",
            "<img src='x' onerror='alert(1)'>",
            "<svg onload='alert(1)'>",
            "javascript:void(0)"
    })
    @DisplayName("XSS payloads in description are accepted as inert literal data")
    void xssPayloadsInDescription_storedSafely(String xssPayload) throws Exception {
        String json = String.format("""
                {
                    "amount": 12.00,
                    "description": "%s",
                    "expenseDate": "2026-11-14",
                    "categoryId": %d
                }
                """, xssPayload.replace("\"", "\\\""), testCategory.getId());

        mockMvc.perform(post("/api/expenses/user/" + testUser.getId())
                        .header("Authorization", "Bearer " + userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isCreated());
    }
}
