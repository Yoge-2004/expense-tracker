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

public class SavingsGoalSteps {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private TestContext ctx;

    @When("I create a savings goal named {string} with target amount {double}")
    public void createSavingsGoal(String name, double targetAmount) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", name);
        body.put("targetAmount", BigDecimal.valueOf(targetAmount));
        body.put("currentAmount", BigDecimal.ZERO);
        body.put("targetDate", LocalDate.now().plusMonths(6).toString());
        body.put("status", "ACTIVE");
        body.put("isRecurring", false);

        MvcResult res = mockMvc.perform(post("/api/savings/goals/user/" + ctx.userId)
                        .header("Authorization", "Bearer " + ctx.authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andReturn();

        ctx.lastResponse = res;
        ctx.lastResponseBody = res.getResponse().getContentAsByteArray();

        if (res.getResponse().getStatus() == 201) {
            JsonNode json = objectMapper.readTree(ctx.lastResponseBody);
            ctx.goalId = json.get("id").asLong();
        }
    }

    @Then("the savings goal should have name {string}")
    public void verifyGoalName(String expectedName) throws Exception {
        JsonNode json = objectMapper.readTree(ctx.lastResponseBody);
        assertEquals(expectedName, json.get("name").asText());
    }

    @Then("the savings goal should have target amount {double}")
    public void verifyGoalTargetAmount(double expectedTarget) throws Exception {
        JsonNode json = objectMapper.readTree(ctx.lastResponseBody);
        assertEquals(expectedTarget, json.get("targetAmount").asDouble(), 0.001);
    }

    @Then("the savings goal should have current amount {double}")
    public void verifyGoalCurrentAmount(double expectedCurrent) throws Exception {
        JsonNode json = objectMapper.readTree(ctx.lastResponseBody);
        assertEquals(expectedCurrent, json.get("currentAmount").asDouble(), 0.001);
    }

    @Given("I have a savings goal named {string} with target amount {double} and current amount {double}")
    public void haveSavingsGoal(String name, double targetAmount, double currentAmount) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", name);
        body.put("targetAmount", BigDecimal.valueOf(targetAmount));
        body.put("currentAmount", BigDecimal.valueOf(currentAmount));
        body.put("targetDate", LocalDate.now().plusMonths(6).toString());
        body.put("status", "ACTIVE");
        body.put("isRecurring", false);

        MvcResult res = mockMvc.perform(post("/api/savings/goals/user/" + ctx.userId)
                        .header("Authorization", "Bearer " + ctx.authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andReturn();

        JsonNode json = objectMapper.readTree(res.getResponse().getContentAsString());
        ctx.goalId = json.get("id").asLong();
    }

    @When("I deposit {double} towards my savings goal")
    public void depositToGoal(double depositAmount) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("amount", BigDecimal.valueOf(depositAmount));

        MvcResult res = mockMvc.perform(post("/api/savings/goals/" + ctx.goalId + "/deposit/user/" + ctx.userId)
                        .header("Authorization", "Bearer " + ctx.authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andReturn();

        ctx.lastResponse = res;
        ctx.lastResponseBody = res.getResponse().getContentAsByteArray();
    }

    @Then("the savings goal progress percentage should be {double}")
    public void verifyGoalProgress(double expectedProgress) throws Exception {
        JsonNode json = objectMapper.readTree(ctx.lastResponseBody);
        assertEquals(expectedProgress, json.get("progressPercentage").asDouble(), 0.01);
    }

    @Then("the savings goal status should be {string}")
    public void verifyGoalStatus(String expectedStatus) throws Exception {
        JsonNode json = objectMapper.readTree(ctx.lastResponseBody);
        assertEquals(expectedStatus, json.get("status").asText());
    }

    @When("I delete that savings goal")
    public void deleteSavingsGoal() throws Exception {
        MvcResult res = mockMvc.perform(delete("/api/savings/goals/" + ctx.goalId + "/user/" + ctx.userId)
                        .header("Authorization", "Bearer " + ctx.authToken))
                .andReturn();
        ctx.lastResponse = res;
    }

    @Then("the savings goal should no longer exist")
    public void verifyGoalDeleted() throws Exception {
        MvcResult res = mockMvc.perform(get("/api/savings/goals/user/" + ctx.userId)
                        .header("Authorization", "Bearer " + ctx.authToken))
                .andReturn();
        JsonNode arr = objectMapper.readTree(res.getResponse().getContentAsString());
        for (JsonNode item : arr) {
            assertNotEquals(ctx.goalId, item.get("id").asLong(), "Deleted savings goal was still found in user list");
        }
    }
}
