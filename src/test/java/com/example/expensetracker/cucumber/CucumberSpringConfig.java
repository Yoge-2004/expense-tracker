package com.example.expensetracker.cucumber;

import io.cucumber.java.Before;
import io.cucumber.spring.CucumberContextConfiguration;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Shared Spring context configuration for all Cucumber step-definition classes.
 *
 * <p>Uses {@code @SpringBootTest} with {@code @AutoConfigureMockMvc} so that every
 * step has access to a real {@link MockMvc} for issuing HTTP requests against the
 * running application. The test profile uses H2 in-memory (configured in
 * {@code src/test/resources/application.properties}) so tests are hermetic.</p>
 *
 * <p>The {@link TestContext} field holds cross-step state (auth token, user ID,
 * last response, etc.) and is autowired into every step-definition class.</p>
 */
@CucumberContextConfiguration
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class CucumberSpringConfig {

    @Autowired
    public MockMvc mockMvc;

    @Autowired
    public ObjectMapper objectMapper;

    @Autowired
    public TestContext testContext;

    @Autowired
    public JdbcTemplate jdbcTemplate;

    /**
     * Guarantees hermetic test isolation across Cucumber scenarios.
     * Deletes all user-generated records prior to each scenario run while
     * preserving system baseline data (e.g. global categories with user_id IS NULL).
     */
    @Before(order = 0)
    public void cleanDatabase() {
        String[] tables = {
            "expenses",
            "incomes",
            "budget",
            "savings_goals",
            "recurring_expense",
            "loan_adjustments",
            "monthly_report_logs",
            "app_notifications",
            "device_tokens",
            "notification_preferences",
            "password_reset_otp",
            "ml_feedback",
            "webauthn_credentials",
            "webauthn_challenges",
            "user_appearance",
            "admin_audit_logs"
        };
        for (String table : tables) {
            try {
                jdbcTemplate.execute("DELETE FROM " + table);
            } catch (Exception ignored) {
            }
        }
        try {
            jdbcTemplate.execute("DELETE FROM categories WHERE user_id IS NOT NULL");
        } catch (Exception ignored) {
        }
        try {
            jdbcTemplate.execute("DELETE FROM users");
        } catch (Exception ignored) {
        }

        testContext.reset();
    }

    /**
     * Shared mutable state across all Given/When/Then steps in a scenario.
     * Cucumber creates a fresh Spring context per scenario (with {@code @SpringBootTest}
     * the context is cached and re-used, but the {@link TestContext} bean's state is
     * reset in a {@code @Before} hook).
     */
    @org.springframework.stereotype.Component
    public static class TestContext {
        public String authToken;
        public Long userId;
        public String email;
        public Long expenseId;
        public Long categoryId;
        public Long incomeId;
        public Long goalId;
        public Long budgetId;
        public Long foreignUserId;
        public Long foreignExpenseId;
        public Long foreignCategoryId;
        public Long foreignGoalId;
        public Long foreignIncomeId;
        public MvcResult lastResponse;
        public byte[] lastResponseBody;

        public void reset() {
            authToken = null;
            userId = null;
            email = null;
            expenseId = null;
            categoryId = null;
            incomeId = null;
            goalId = null;
            budgetId = null;
            foreignUserId = null;
            foreignExpenseId = null;
            foreignCategoryId = null;
            foreignGoalId = null;
            foreignIncomeId = null;
            lastResponse = null;
            lastResponseBody = null;
        }
    }
}
