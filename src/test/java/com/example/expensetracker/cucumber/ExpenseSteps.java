package com.example.expensetracker.cucumber;

import com.example.expensetracker.cucumber.CucumberSpringConfig.TestContext;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

/**
 * Step definitions for the expense management feature.
 *
 * <p>These steps create categories, expenses, budgets, and verify CRUD operations
 * through the authenticated API. All requests include the Bearer token stored in
 * the shared {@link TestContext} from the login/registration step.</p>
 */
public class ExpenseSteps {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private TestContext ctx;

    @Given("I am logged in as user {string} with password {string}")
    public void loggedInAs(String email, String password) throws Exception {
        // Register the user (ignore 400 if already exists from a prior scenario)
        Map<String, Object> regBody = new LinkedHashMap<>();
        regBody.put("name", "Test User");
        regBody.put("username", "testuser_" + System.currentTimeMillis());
        regBody.put("email", email);
        regBody.put("password", password);
        regBody.put("currency", "INR");

        try {
            mockMvc.perform(post("/api/auth/register")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(regBody)))
                    .andReturn();
        } catch (Exception ignored) { }

        // Log in to get a JWT token
        Map<String, Object> loginBody = new LinkedHashMap<>();
        loginBody.put("email", email);
        loginBody.put("password", password);

        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginBody)))
                .andReturn();

        // Guard against login failure — if the token is missing, subsequent steps will fail
        // with a clear message rather than an NPE.
        if (result.getResponse().getStatus() != 200) {
            throw new IllegalStateException("Login failed in Background step: status="
                    + result.getResponse().getStatus() + " body="
                    + result.getResponse().getContentAsString());
        }
        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        if (!json.has("token") || json.get("token").asText().isBlank()) {
            throw new IllegalStateException("Login response missing token: " + json);
        }
        ctx.authToken = json.get("token").asText();
        ctx.userId = json.has("userId") ? json.get("userId").asLong() : null;
        ctx.email = email;
    }

    @Given("the category {string} exists for my user")
    public void categoryExists(String categoryName) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", categoryName);

        MvcResult result = mockMvc.perform(post("/api/categories/user/" + ctx.userId)
                        .header("Authorization", "Bearer " + ctx.authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andReturn();

        // CategoryController returns 201 CREATED on success, 409 CONFLICT if duplicate.
        int status = result.getResponse().getStatus();
        if (status == 201) {
            JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
            ctx.categoryId = json.get("id").asLong();
        } else if (status == 409 || status == 400) {
            // Category already exists — fetch the list to find its ID
            MvcResult listResult = mockMvc.perform(get("/api/categories/user/" + ctx.userId)
                            .header("Authorization", "Bearer " + ctx.authToken))
                    .andReturn();
            JsonNode cats = objectMapper.readTree(listResult.getResponse().getContentAsString());
            for (JsonNode cat : cats) {
                if (categoryName.equalsIgnoreCase(cat.get("name").asText())) {
                    ctx.categoryId = cat.get("id").asLong();
                    return;
                }
            }
        } else {
            throw new IllegalStateException("Category creation failed: status=" + status
                    + " body=" + result.getResponse().getContentAsString());
        }
    }

    @When("I create an expense with amount {double} description {string} date {string} and category {string}")
    public void createExpense(double amount, String description, String date, String categoryName) throws Exception {
        assertNotNull(ctx.categoryId, "Category must be created before expense — step order issue");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("amount", BigDecimal.valueOf(amount));
        body.put("description", description);
        body.put("expenseDate", date);
        body.put("categoryId", ctx.categoryId);

        MvcResult result = mockMvc.perform(post("/api/expenses/user/" + ctx.userId)
                        .header("Authorization", "Bearer " + ctx.authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andReturn();

        ctx.lastResponse = result;
        // ExpenseController returns 201 CREATED on success
        if (result.getResponse().getStatus() == 201) {
            JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
            ctx.expenseId = json.has("id") ? json.get("id").asLong() : null;
        }
    }

    @Then("the expense should be saved with amount {double}")
    public void verifyExpenseAmount(double expectedAmount) throws Exception {
        assertNotNull(ctx.lastResponse, "No response captured");
        JsonNode json = objectMapper.readTree(ctx.lastResponse.getResponse().getContentAsString());
        assertEquals(expectedAmount, json.get("amount").asDouble(), 0.001);
    }

    @Then("the expense should have description {string}")
    public void verifyExpenseDescription(String expectedDescription) throws Exception {
        assertNotNull(ctx.lastResponse, "No response captured");
        JsonNode json = objectMapper.readTree(ctx.lastResponse.getResponse().getContentAsString());
        assertEquals(expectedDescription, json.get("description").asText());
    }

    @Given("I have {int} expenses")
    public void haveExpenses(int count) throws Exception {
        categoryExists("Test Category");
        for (int i = 0; i < count; i++) {
            createExpense(10.00 * (i + 1), "Expense " + (i + 1), "2026-09-0" + (i + 1), "Test Category");
        }
    }

    @When("I request all expenses for my user")
    public void requestAllExpenses() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/expenses/user/" + ctx.userId)
                        .header("Authorization", "Bearer " + ctx.authToken))
                .andReturn();
        ctx.lastResponse = result;
    }

    @Then("the response should contain {int} expenses")
    public void verifyExpenseCount(int expectedCount) throws Exception {
        assertNotNull(ctx.lastResponse, "No response captured");
        JsonNode json = objectMapper.readTree(ctx.lastResponse.getResponse().getContentAsString());
        assertTrue(json.isArray(), "Expected an array of expenses");
        assertEquals(expectedCount, json.size(),
                "Expected " + expectedCount + " expenses but got " + json.size());
    }

    @Given("I have an expense with amount {double} and description {string}")
    public void haveAnExpense(double amount, String description) throws Exception {
        categoryExists("Test Category");
        createExpense(amount, description, "2026-09-10", "Test Category");
    }

    @When("I update that expense with amount {double} and description {string}")
    public void updateExpense(double amount, String description) throws Exception {
        assertNotNull(ctx.expenseId, "No expense to update — create one first");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("amount", BigDecimal.valueOf(amount));
        body.put("description", description);
        body.put("expenseDate", "2026-09-10");
        body.put("categoryId", ctx.categoryId);

        MvcResult result = mockMvc.perform(put("/api/expenses/" + ctx.expenseId + "/user/" + ctx.userId)
                        .header("Authorization", "Bearer " + ctx.authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andReturn();
        ctx.lastResponse = result;
    }

    @When("I delete that expense")
    public void deleteExpense() throws Exception {
        assertNotNull(ctx.expenseId, "No expense to delete — create one first");
        MvcResult result = mockMvc.perform(delete("/api/expenses/" + ctx.expenseId + "/user/" + ctx.userId)
                        .header("Authorization", "Bearer " + ctx.authToken))
                .andReturn();
        ctx.lastResponse = result;
    }

    @Then("the expense should no longer exist")
    public void verifyExpenseDeleted() throws Exception {
        // Attempt to fetch the deleted expense's list and confirm it's not there.
        MvcResult result = mockMvc.perform(get("/api/expenses/user/" + ctx.userId)
                        .header("Authorization", "Bearer " + ctx.authToken))
                .andReturn();
        JsonNode expenses = objectMapper.readTree(result.getResponse().getContentAsString());
        for (JsonNode exp : expenses) {
            if (ctx.expenseId != null && ctx.expenseId.equals(exp.has("id") ? exp.get("id").asLong() : null)) {
                fail("Expense " + ctx.expenseId + " should have been deleted but still appears in the list");
            }
        }
    }

    @Given("another user has an expense with id {int}")
    public void anotherUserHasExpense(int expenseId) {
        // No-op: just record the ID. The next step will try to update it and expect 403.
        ctx.expenseId = (long) expenseId;
    }

    @When("I try to update expense {int}")
    public void tryUpdateForeignExpense(int expenseId) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("amount", BigDecimal.valueOf(999));
        body.put("description", "Hijack attempt");
        body.put("expenseDate", "2026-09-10");
        body.put("categoryId", 1);

        MvcResult result = mockMvc.perform(put("/api/expenses/" + expenseId + "/user/" + ctx.userId)
                        .header("Authorization", "Bearer " + ctx.authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andReturn();
        ctx.lastResponse = result;
    }

    @When("I set a budget of {double} for category {string}")
    public void setBudget(double amount, String categoryName) throws Exception {
        assertNotNull(ctx.categoryId, "Category must exist before setting budget");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("categoryId", ctx.categoryId);
        body.put("limitAmount", BigDecimal.valueOf(amount));
        body.put("period", "MONTHLY");

        MvcResult result = mockMvc.perform(post("/api/expenses/budget/user/" + ctx.userId)
                        .header("Authorization", "Bearer " + ctx.authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andReturn();
        ctx.lastResponse = result;
    }
}
