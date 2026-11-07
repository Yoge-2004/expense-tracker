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
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

public class BudgetSteps {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private TestContext ctx;

    private Long resolveCategoryId(String categoryName) throws Exception {
        MvcResult listResult = mockMvc.perform(get("/api/categories/user/" + ctx.userId)
                        .header("Authorization", "Bearer " + ctx.authToken))
                .andReturn();
        JsonNode cats = objectMapper.readTree(listResult.getResponse().getContentAsString());
        for (JsonNode cat : cats) {
            if (categoryName.equalsIgnoreCase(cat.get("name").asText())) {
                return cat.get("id").asLong();
            }
        }
        return ctx.categoryId;
    }


    @When("I set a budget of {double} for category {string} with period {string}")
    public void setBudget(double limit, String categoryName, String period) throws Exception {
        Long catId = resolveCategoryId(categoryName);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("categoryId", catId);
        body.put("limitAmount", BigDecimal.valueOf(limit));
        body.put("period", period);

        MvcResult res = mockMvc.perform(post("/api/expenses/budget/user/" + ctx.userId)
                        .header("Authorization", "Bearer " + ctx.authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andReturn();

        ctx.lastResponse = res;
        ctx.lastResponseBody = res.getResponse().getContentAsByteArray();
    }

    @Given("I have a budget of {double} for category {string} with period {string}")
    public void haveBudget(double limit, String categoryName, String period) throws Exception {
        setBudget(limit, categoryName, period);
        assertEquals(200, ctx.lastResponse.getResponse().getStatus(),
                "Prerequisite budget setup failed: " + new String(ctx.lastResponseBody));
    }

    @Then("the budget response message should be {string}")
    public void verifyBudgetResponseMessage(String expected) throws Exception {
        JsonNode json = objectMapper.readTree(ctx.lastResponseBody);
        assertTrue(json.has("message"), "Response JSON missing 'message' property");
        assertEquals(expected, json.get("message").asText());
    }

    @When("I request the budget status for my user")
    public void requestBudgetStatus() throws Exception {
        MvcResult res = mockMvc.perform(get("/api/expenses/budget/status/user/" + ctx.userId)
                        .header("Authorization", "Bearer " + ctx.authToken))
                .andReturn();
        ctx.lastResponse = res;
        ctx.lastResponseBody = res.getResponse().getContentAsByteArray();
    }

    @Then("the budget for category {string} should have limit {double}")
    public void verifyBudgetLimit(String categoryName, double expectedLimit) throws Exception {
        JsonNode json = objectMapper.readTree(ctx.lastResponseBody);
        assertTrue(json.isArray(), "Expected array of budget statuses");
        boolean found = false;
        for (JsonNode item : json) {
            if (categoryName.equalsIgnoreCase(item.get("categoryName").asText())) {
                found = true;
                assertEquals(expectedLimit, item.get("limit").asDouble(), 0.01);
                break;
            }
        }
        assertTrue(found, "Category '" + categoryName + "' not found in budget status: " + json);
    }

    @Given("I record an expense of {double} under category {string} on today's date")
    public void recordExpenseToday(double amount, String categoryName) throws Exception {
        Long catId = resolveCategoryId(categoryName);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("amount", BigDecimal.valueOf(amount));
        body.put("description", "Budget test expense");
        body.put("expenseDate", LocalDate.now().toString());
        body.put("categoryId", catId);

        MvcResult res = mockMvc.perform(post("/api/expenses/user/" + ctx.userId)
                        .header("Authorization", "Bearer " + ctx.authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andReturn();

        assertEquals(201, res.getResponse().getStatus(),
                "Failed to record expense: " + res.getResponse().getContentAsString());
    }

    @Then("the budget for category {string} should have spent {double}")
    public void verifyBudgetSpentExact(String categoryName, double expectedSpent) throws Exception {
        JsonNode json = objectMapper.readTree(ctx.lastResponseBody);
        assertTrue(json.isArray());
        for (JsonNode item : json) {
            if (categoryName.equalsIgnoreCase(item.get("categoryName").asText())) {
                double spent = item.get("spent").asDouble();
                assertEquals(expectedSpent, spent, 0.01, "Expected spent = " + expectedSpent + ", got: " + spent);
                return;
            }
        }
        fail("Category '" + categoryName + "' not found in budget status: " + json);
    }

    @Then("the budget for category {string} should have percentage utilization of {double}")
    public void verifyBudgetPercentageExact(String categoryName, double expectedPct) throws Exception {
        JsonNode json = objectMapper.readTree(ctx.lastResponseBody);
        assertTrue(json.isArray());
        for (JsonNode item : json) {
            if (categoryName.equalsIgnoreCase(item.get("categoryName").asText())) {
                double pct = item.get("percentage").asDouble();
                assertEquals(expectedPct, pct, 0.01, "Expected percentage = " + expectedPct + ", got: " + pct);
                return;
            }
        }
        fail("Category '" + categoryName + "' not found in budget status: " + json);
    }

    @Then("the budget for category {string} should have spent at least {double}")
    public void verifyBudgetSpent(String categoryName, double minSpent) throws Exception {
        JsonNode json = objectMapper.readTree(ctx.lastResponseBody);
        assertTrue(json.isArray());
        for (JsonNode item : json) {
            if (categoryName.equalsIgnoreCase(item.get("categoryName").asText())) {
                double spent = item.get("spent").asDouble();
                assertTrue(spent >= minSpent, "Expected spent >= " + minSpent + ", got: " + spent);
                return;
            }
        }
        fail("Category '" + categoryName + "' not found in budget status: " + json);
    }

    @Then("the budget for category {string} should have percentage utilization of at least {double}")
    public void verifyBudgetPercentage(String categoryName, double minPct) throws Exception {
        JsonNode json = objectMapper.readTree(ctx.lastResponseBody);
        assertTrue(json.isArray());
        for (JsonNode item : json) {
            if (categoryName.equalsIgnoreCase(item.get("categoryName").asText())) {
                double pct = item.get("percentage").asDouble();
                assertTrue(pct >= minPct, "Expected percentage >= " + minPct + ", got: " + pct);
                return;
            }
        }
        fail("Category '" + categoryName + "' not found in budget status: " + json);
    }

    @When("I delete the budget for category {string}")
    public void deleteBudgetByCategory(String categoryName) throws Exception {
        MvcResult res = mockMvc.perform(
                delete("/api/expenses/budget/user/" + ctx.userId + "/category/" + ctx.categoryId)
                        .header("Authorization", "Bearer " + ctx.authToken))
                .andReturn();
        ctx.lastResponse = res;
        ctx.lastResponseBody = res.getResponse().getContentAsByteArray();
    }

    @Then("the budget status should not contain category {string}")
    public void verifyCategoryNotInBudgetStatus(String categoryName) throws Exception {
        JsonNode json = objectMapper.readTree(ctx.lastResponseBody);
        assertTrue(json.isArray());
        for (JsonNode item : json) {
            assertNotEquals(categoryName, item.get("categoryName").asText(),
                    "Category '" + categoryName + "' should not be present in budget status");
        }
    }

    @When("I set a custom budget of {double} for category {string} with interval {int} days")
    public void setCustomBudget(double limit, String categoryName, int intervalDays) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("categoryId", ctx.categoryId);
        body.put("limitAmount", BigDecimal.valueOf(limit));
        body.put("period", "CUSTOM");
        body.put("intervalDays", intervalDays);
        body.put("startDate", LocalDate.now().toString());
        body.put("endDate", LocalDate.now().plusDays(intervalDays).toString());

        MvcResult res = mockMvc.perform(post("/api/expenses/budget/user/" + ctx.userId)
                        .header("Authorization", "Bearer " + ctx.authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andReturn();

        ctx.lastResponse = res;
        ctx.lastResponseBody = res.getResponse().getContentAsByteArray();
    }

    @Then("the budget for category {string} should have period {string}")
    public void verifyBudgetPeriod(String categoryName, String expectedPeriod) throws Exception {
        JsonNode json = objectMapper.readTree(ctx.lastResponseBody);
        assertTrue(json.isArray());
        for (JsonNode item : json) {
            if (categoryName.equalsIgnoreCase(item.get("categoryName").asText())) {
                assertEquals(expectedPeriod, item.get("period").asText());
                return;
            }
        }
        fail("Category '" + categoryName + "' not found in budget status: " + json);
    }

    @Given("another user {string} has a category named {string}")
    public void anotherUserHasCategory(String otherEmail, String catName) throws Exception {
        String currentToken = ctx.authToken;
        Long currentUserId = ctx.userId;

        // Register victim
        Map<String, Object> regBody = Map.of(
                "name", "Budget Victim",
                "username", "bvictim_" + System.currentTimeMillis(),
                "email", otherEmail,
                "password", "VictimPass123!",
                "currency", "INR"
        );
        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(regBody)))
                .andExpect(status().isCreated());

        MvcResult loginResult = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("email", otherEmail, "password", "VictimPass123!"))))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode loginJson = objectMapper.readTree(loginResult.getResponse().getContentAsString());
        String otherToken = loginJson.get("token").asText();
        Long otherUserId = loginJson.get("userId").asLong();

        MvcResult catResult = mockMvc.perform(post("/api/categories/user/" + otherUserId)
                .header("Authorization", "Bearer " + otherToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("name", catName))))
                .andExpect(status().isCreated())
                .andReturn();
        Long otherCatId = objectMapper.readTree(catResult.getResponse().getContentAsString()).get("id").asLong();

        ctx.foreignUserId = otherUserId;
        ctx.foreignCategoryId = otherCatId;
        ctx.authToken = currentToken;
        ctx.userId = currentUserId;
    }

    @When("I try to set a budget of {double} on that foreign category")
    public void trySetBudgetOnForeignCategory(double limit) throws Exception {
        assertNotNull(ctx.foreignCategoryId, "No foreign category present");
        Map<String, Object> body = Map.of(
                "categoryId", ctx.foreignCategoryId,
                "limitAmount", BigDecimal.valueOf(limit),
                "period", "MONTHLY"
        );

        MvcResult res = mockMvc.perform(post("/api/expenses/budget/user/" + ctx.userId)
                        .header("Authorization", "Bearer " + ctx.authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andReturn();

        ctx.lastResponse = res;
        ctx.lastResponseBody = res.getResponse().getContentAsByteArray();
    }
}
