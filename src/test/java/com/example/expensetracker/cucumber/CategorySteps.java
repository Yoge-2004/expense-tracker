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

/**
 * Step definitions for the category management feature.
 *
 * <p>Drives category CRUD and validation operations through MockMvc against
 * the running application context.</p>
 */
public class CategorySteps {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private TestContext ctx;

    @Given("I do not have a category named {string}")
    public void ensureCategoryDoesNotExist(String name) throws Exception {
        if (ctx.userId == null || ctx.authToken == null) {
            return;
        }
        MvcResult listResult = mockMvc.perform(get("/api/categories/user/" + ctx.userId)
                        .header("Authorization", "Bearer " + ctx.authToken))
                .andReturn();
        if (listResult.getResponse().getStatus() == 200) {
            JsonNode cats = objectMapper.readTree(listResult.getResponse().getContentAsString());
            for (JsonNode cat : cats) {
                if (name.equalsIgnoreCase(cat.get("name").asText())) {
                    mockMvc.perform(delete("/api/categories/" + cat.get("id").asLong() + "/user/" + ctx.userId)
                            .header("Authorization", "Bearer " + ctx.authToken));
                }
            }
        }
    }

    @When("I create a category named {string}")
    public void createCategory(String name) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", name);

        MvcResult result = mockMvc.perform(post("/api/categories/user/" + ctx.userId)
                        .header("Authorization", "Bearer " + ctx.authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andReturn();

        ctx.lastResponse = result;
        if (result.getResponse().getStatus() == 201) {
            JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
            ctx.categoryId = json.has("id") ? json.get("id").asLong() : null;
        }
    }

    @Then("the category should have name {string}")
    public void verifyCategoryName(String expectedName) throws Exception {
        assertNotNull(ctx.lastResponse, "No response captured");
        JsonNode json = objectMapper.readTree(ctx.lastResponse.getResponse().getContentAsString());
        assertEquals(expectedName, json.get("name").asText());
    }

    @Given("I have a category named {string}")
    public void haveCategory(String name) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", name);

        MvcResult result = mockMvc.perform(post("/api/categories/user/" + ctx.userId)
                        .header("Authorization", "Bearer " + ctx.authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andReturn();

        int status = result.getResponse().getStatus();
        if (status == 201) {
            JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
            ctx.categoryId = json.get("id").asLong();
        } else {
            // Already exists - find its ID
            MvcResult listResult = mockMvc.perform(get("/api/categories/user/" + ctx.userId)
                            .header("Authorization", "Bearer " + ctx.authToken))
                    .andReturn();
            JsonNode cats = objectMapper.readTree(listResult.getResponse().getContentAsString());
            for (JsonNode cat : cats) {
                if (name.equalsIgnoreCase(cat.get("name").asText())) {
                    ctx.categoryId = cat.get("id").asLong();
                    return;
                }
            }
            fail("Category '" + name + "' could not be created or found: status=" + status);
        }
    }

    @When("I request all global categories")
    public void requestGlobalCategories() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/categories/global")
                        .header("Authorization", "Bearer " + ctx.authToken))
                .andReturn();
        ctx.lastResponse = result;
    }

    @Then("the response should contain global category {string}")
    public void verifyContainsGlobalCategory(String expectedName) throws Exception {
        assertNotNull(ctx.lastResponse, "No response captured");
        JsonNode list = objectMapper.readTree(ctx.lastResponse.getResponse().getContentAsString());
        assertTrue(list.isArray(), "Expected array response");
        boolean found = false;
        for (JsonNode item : list) {
            if (expectedName.equalsIgnoreCase(item.get("name").asText())) {
                found = true;
                break;
            }
        }
        assertTrue(found, "Global category '" + expectedName + "' not found in: " + list);
    }

    @When("I request all personal categories")
    public void requestPersonalCategories() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/categories/user/" + ctx.userId)
                        .header("Authorization", "Bearer " + ctx.authToken))
                .andReturn();
        ctx.lastResponse = result;
    }

    @Then("the response should contain category {string}")
    public void verifyContainsCategory(String expectedName) throws Exception {
        assertNotNull(ctx.lastResponse, "No response captured");
        JsonNode list = objectMapper.readTree(ctx.lastResponse.getResponse().getContentAsString());
        assertTrue(list.isArray(), "Expected array response");
        boolean found = false;
        for (JsonNode item : list) {
            if (expectedName.equalsIgnoreCase(item.get("name").asText())) {
                found = true;
                break;
            }
        }
        assertTrue(found, "Category '" + expectedName + "' not found in: " + list);
    }

    @When("I delete that category")
    public void deleteCategory() throws Exception {
        assertNotNull(ctx.categoryId, "Category ID must be set before deletion");
        MvcResult result = mockMvc.perform(delete("/api/categories/" + ctx.categoryId + "/user/" + ctx.userId)
                        .header("Authorization", "Bearer " + ctx.authToken))
                .andReturn();
        ctx.lastResponse = result;
    }

    @Then("that category should no longer exist")
    public void verifyCategoryDeleted() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/categories/user/" + ctx.userId)
                        .header("Authorization", "Bearer " + ctx.authToken))
                .andReturn();
        JsonNode cats = objectMapper.readTree(result.getResponse().getContentAsString());
        for (JsonNode cat : cats) {
            if (cat.get("id").asLong() == ctx.categoryId) {
                fail("Category with id " + ctx.categoryId + " still exists in: " + cats);
            }
        }
    }

    @Given("I have an expense of {double} under category {string}")
    public void haveExpenseUnderCategory(double amount, String categoryName) throws Exception {
        assertNotNull(ctx.categoryId, "Category must be created before expense");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("amount", BigDecimal.valueOf(amount));
        body.put("description", "Test expense for category deletion lock");
        body.put("expenseDate", LocalDate.now().toString());
        body.put("categoryId", ctx.categoryId);

        MvcResult result = mockMvc.perform(post("/api/expenses/user/" + ctx.userId)
                        .header("Authorization", "Bearer " + ctx.authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andReturn();

        assertEquals(201, result.getResponse().getStatus(),
                "Failed to create prerequisite expense: " + result.getResponse().getContentAsString());
        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        ctx.expenseId = json.get("id").asLong();
    }
}
