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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

public class IncomeSteps {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private TestContext ctx;

    @When("I create an income with amount {double} source {string} description {string} date {string}")
    public void createIncome(double amount, String source, String description, String date) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("amount", BigDecimal.valueOf(amount));
        body.put("source", source);
        body.put("description", description);
        body.put("incomeDate", date);
        body.put("isRecurring", false);

        MvcResult res = mockMvc.perform(post("/api/incomes/user/{userId}", ctx.userId)
                        .header("Authorization", "Bearer " + ctx.authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andReturn();

        ctx.lastResponse = res;
        ctx.lastResponseBody = res.getResponse().getContentAsByteArray();

        if (res.getResponse().getStatus() == 201) {
            JsonNode json = objectMapper.readTree(ctx.lastResponseBody);
            ctx.incomeId = json.get("id").asLong();
        }
    }

    @Then("the income should be saved with amount {double}")
    public void verifyIncomeAmount(double expected) throws Exception {
        JsonNode json = objectMapper.readTree(ctx.lastResponseBody);
        assertEquals(expected, json.get("amount").asDouble(), 0.001);
    }

    @Then("the income should have source {string}")
    public void verifyIncomeSource(String expected) throws Exception {
        JsonNode json = objectMapper.readTree(ctx.lastResponseBody);
        assertEquals(expected, json.get("source").asText());
    }

    @Given("I have {int} income records")
    public void haveIncomes(int count) throws Exception {
        for (int i = 1; i <= count; i++) {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("amount", BigDecimal.valueOf(100.0 * i));
            body.put("source", "Source " + i);
            body.put("description", "Income batch " + i);
            body.put("incomeDate", "2026-09-0" + (i % 9 + 1));
            body.put("isRecurring", false);

            mockMvc.perform(post("/api/incomes/user/{userId}", ctx.userId)
                            .header("Authorization", "Bearer " + ctx.authToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andReturn();
        }
    }

    @When("I request all incomes for my user")
    public void requestAllIncomes() throws Exception {
        MvcResult res = mockMvc.perform(get("/api/incomes/user/{userId}", ctx.userId)
                        .header("Authorization", "Bearer " + ctx.authToken))
                .andReturn();
        ctx.lastResponse = res;
        ctx.lastResponseBody = res.getResponse().getContentAsByteArray();
    }

    @Then("the response should contain {int} incomes")
    public void verifyIncomeCountExact(int count) throws Exception {
        JsonNode json = objectMapper.readTree(ctx.lastResponseBody);
        assertTrue(json.isArray(), "Expected an array response");
        assertEquals(count, json.size(), "Expected exactly " + count + " incomes, got " + json.size());
    }

    @Then("the response should contain at least {int} incomes")
    public void verifyIncomeCountAtLeast(int min) throws Exception {
        JsonNode json = objectMapper.readTree(ctx.lastResponseBody);
        assertTrue(json.isArray(), "Expected an array response");
        assertTrue(json.size() >= min, "Expected at least " + min + " incomes, got " + json.size());
    }

    @Given("I have an income with amount {double} and source {string}")
    public void haveAnIncome(double amount, String source) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("amount", BigDecimal.valueOf(amount));
        body.put("source", source);
        body.put("description", "Initial record");
        body.put("incomeDate", "2026-09-05");
        body.put("isRecurring", false);

        MvcResult res = mockMvc.perform(post("/api/incomes/user/{userId}", ctx.userId)
                        .header("Authorization", "Bearer " + ctx.authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andReturn();

        JsonNode json = objectMapper.readTree(res.getResponse().getContentAsString());
        ctx.incomeId = json.get("id").asLong();
    }

    @When("I update that income with amount {double} and source {string}")
    public void updateIncome(double amount, String source) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("amount", BigDecimal.valueOf(amount));
        body.put("source", source);
        body.put("description", "Updated record");
        body.put("incomeDate", "2026-09-05");
        body.put("isRecurring", false);

        MvcResult res = mockMvc.perform(put("/api/incomes/{id}/user/{userId}", ctx.incomeId, ctx.userId)
                        .header("Authorization", "Bearer " + ctx.authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andReturn();

        ctx.lastResponse = res;
        ctx.lastResponseBody = res.getResponse().getContentAsByteArray();
    }

    @When("I delete that income")
    public void deleteIncome() throws Exception {
        MvcResult res = mockMvc.perform(delete("/api/incomes/{id}/user/{userId}", ctx.incomeId, ctx.userId)
                        .header("Authorization", "Bearer " + ctx.authToken))
                .andReturn();
        ctx.lastResponse = res;
    }

    @Then("the income should no longer exist")
    public void verifyIncomeDeleted() throws Exception {
        MvcResult res = mockMvc.perform(get("/api/incomes/user/{userId}", ctx.userId)
                        .header("Authorization", "Bearer " + ctx.authToken))
                .andReturn();
        JsonNode arr = objectMapper.readTree(res.getResponse().getContentAsString());
        for (JsonNode item : arr) {
            assertNotEquals(ctx.incomeId, item.get("id").asLong(), "Deleted income was still found in user list");
        }
    }

    @When("I request the monthly cash flow summary for year {int} and month {int}")
    public void requestCashFlowSummary(int year, int month) throws Exception {
        MvcResult res = mockMvc.perform(get("/api/incomes/summary/user/{userId}", ctx.userId)
                        .param("year", String.valueOf(year))
                        .param("month", String.valueOf(month))
                        .header("Authorization", "Bearer " + ctx.authToken))
                .andReturn();
        ctx.lastResponse = res;
        ctx.lastResponseBody = res.getResponse().getContentAsByteArray();
    }

    @Then("the cash flow total income should be {double}")
    public void verifyCashFlowTotalIncomeExact(double expected) throws Exception {
        JsonNode json = objectMapper.readTree(ctx.lastResponseBody);
        double totalIncome = json.get("totalIncome").asDouble();
        assertEquals(expected, totalIncome, 0.01,
                "Expected total income = " + expected + ", got: " + totalIncome + " Response JSON: " + new String(ctx.lastResponseBody));
    }

    @Then("the cash flow total income should be at least {double}")
    public void verifyCashFlowTotalIncome(double minAmount) throws Exception {
        JsonNode json = objectMapper.readTree(ctx.lastResponseBody);
        double totalIncome = json.get("totalIncome").asDouble();
        assertTrue(totalIncome >= minAmount, "Expected total income >= " + minAmount + ", got: " + totalIncome);
    }

    @Given("another user {string} has an income record with amount {double} and source {string}")
    public void anotherUserHasIncome(String otherEmail, double amount, String source) throws Exception {
        String currentToken = ctx.authToken;
        Long currentUserId = ctx.userId;

        // Register victim
        Map<String, Object> regBody = Map.of(
                "name", "Income Victim",
                "username", "ivictim_" + System.currentTimeMillis(),
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

        Map<String, Object> body = Map.of(
                "amount", BigDecimal.valueOf(amount),
                "source", source,
                "description", "Victim Private Income",
                "incomeDate", "2026-09-01",
                "isRecurring", false
        );

        MvcResult res = mockMvc.perform(post("/api/incomes/user/{userId}", otherUserId)
                        .header("Authorization", "Bearer " + otherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andReturn();

        Long foreignId = objectMapper.readTree(res.getResponse().getContentAsString()).get("id").asLong();

        ctx.foreignUserId = otherUserId;
        ctx.foreignIncomeId = foreignId;
        ctx.authToken = currentToken;
        ctx.userId = currentUserId;
    }

    @When("I try to update that foreign income")
    public void tryUpdateForeignIncome() throws Exception {
        assertNotNull(ctx.foreignIncomeId, "No foreign income record");
        Map<String, Object> body = Map.of(
                "amount", BigDecimal.valueOf(9999.0),
                "source", "Hijack Source",
                "description", "Tampered",
                "incomeDate", "2026-09-01",
                "isRecurring", false
        );

        MvcResult res = mockMvc.perform(put("/api/incomes/{id}/user/{userId}", ctx.foreignIncomeId, ctx.userId)
                        .header("Authorization", "Bearer " + ctx.authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andReturn();

        ctx.lastResponse = res;
        ctx.lastResponseBody = res.getResponse().getContentAsByteArray();
    }

    @When("I try to delete that foreign income")
    public void tryDeleteForeignIncome() throws Exception {
        assertNotNull(ctx.foreignIncomeId, "No foreign income record");
        MvcResult res = mockMvc.perform(delete("/api/incomes/{id}/user/{userId}", ctx.foreignIncomeId, ctx.userId)
                        .header("Authorization", "Bearer " + ctx.authToken))
                .andReturn();

        ctx.lastResponse = res;
        ctx.lastResponseBody = res.getResponse().getContentAsByteArray();
    }
}
