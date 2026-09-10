package com.example.expensetracker.cucumber;

import com.example.expensetracker.cucumber.CucumberSpringConfig.TestContext;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.cucumber.java.Before;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Step definitions for the authentication feature.
 *
 * <p>These steps drive the real Spring Boot application via MockMvc. Registration and
 * login produce a JWT token that is stored in the shared {@link TestContext} and used
 * by subsequent steps (e.g. creating expenses) as a Bearer token.</p>
 */
public class AuthSteps {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private TestContext ctx;

    @Before
    public void resetContext() {
        ctx.reset();
    }

    @Given("the application is running with a test database")
    public void applicationRunning() {
        // No-op — @SpringBootTest in CucumberSpringConfig already started the app with H2.
    }

    @When("I register with name {string} username {string} email {string} password {string} and currency {string}")
    public void register(String name, String username, String email, String password, String currency) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", name);
        body.put("username", username);
        body.put("email", email);
        body.put("password", password);
        body.put("currency", currency);

        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andReturn();

        ctx.lastResponse = result;
        if (result.getResponse().getStatus() == 200) {
            JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
            ctx.authToken = json.has("token") ? json.get("token").asText() : null;
            ctx.userId = json.has("userId") ? json.get("userId").asLong() : null;
            ctx.email = email;
        }
    }

    @Given("a user with email {string} already exists")
    public void userAlreadyExists(String email) throws Exception {
        register("Existing User", "existing_" + System.currentTimeMillis(), email, "SecurePass123", "INR");
        // Reset the context — the registration above was setup, not the test action.
        ctx.reset();
        ctx.email = email;
    }

    @Given("a user with email {string} and password {string} already exists")
    public void userAlreadyExistsWithPassword(String email, String password) throws Exception {
        register("Login User", "loginuser_" + System.currentTimeMillis(), email, password, "INR");
        // Reset but keep the email so the login step knows which account to use.
        String savedEmail = email;
        ctx.reset();
        ctx.email = savedEmail;
    }

    @When("I log in with email {string} and password {string}")
    public void login(String email, String password) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("email", email);
        body.put("password", password);

        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andReturn();

        ctx.lastResponse = result;
        if (result.getResponse().getStatus() == 200) {
            JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
            ctx.authToken = json.has("token") ? json.get("token").asText() : null;
            ctx.userId = json.has("userId") ? json.get("userId").asLong() : null;
            ctx.email = email;
        }
    }

    @When("I request expenses for user {int} without authentication")
    public void requestWithoutAuth(int userId) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/expenses/user/" + userId))
                .andReturn();
        ctx.lastResponse = result;
    }

    @Then("the response status should be {int}")
    public void verifyStatus(int expectedStatus) throws Exception {
        assertNotNull(ctx.lastResponse, "No response was captured — a prior step may have failed");
        assertEquals(expectedStatus, ctx.lastResponse.getResponse().getStatus(),
                "Response body: " + ctx.lastResponse.getResponse().getContentAsString());
    }

    @Then("the response should contain a token")
    public void verifyToken() throws Exception {
        assertNotNull(ctx.lastResponse, "No response captured");
        JsonNode json = objectMapper.readTree(ctx.lastResponse.getResponse().getContentAsString());
        assertTrue(json.has("token"), "Response should contain a 'token' field");
        assertNotNull(json.get("token").asText(), "Token should not be null");
        assertFalse(json.get("token").asText().isBlank(), "Token should not be blank");
    }

    @Then("the response should contain userId")
    public void verifyUserId() throws Exception {
        assertNotNull(ctx.lastResponse, "No response captured");
        JsonNode json = objectMapper.readTree(ctx.lastResponse.getResponse().getContentAsString());
        assertTrue(json.has("userId"), "Response should contain a 'userId' field");
        assertTrue(json.get("userId").asLong() > 0, "userId should be a positive number");
    }

    @Then("the response message should contain {string}")
    public void verifyMessageContains(String fragment) throws Exception {
        assertNotNull(ctx.lastResponse, "No response captured");
        String body = ctx.lastResponse.getResponse().getContentAsString();
        // The error response may be JSON with a "message" field, or plain text.
        if (body.trim().startsWith("{")) {
            JsonNode json = objectMapper.readTree(body);
            String message = json.has("message") ? json.get("message").asText() : "";
            assertTrue(message.toLowerCase().contains(fragment.toLowerCase()),
                    "Expected message to contain '" + fragment + "' but was: " + message);
        } else {
            assertTrue(body.toLowerCase().contains(fragment.toLowerCase()),
                    "Expected body to contain '" + fragment + "' but was: " + body);
        }
    }
}
