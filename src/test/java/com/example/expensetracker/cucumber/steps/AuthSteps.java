package com.example.expensetracker.cucumber.steps;

import com.example.expensetracker.cucumber.context.ScenarioContext;
import io.cucumber.java.en.And;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import io.restassured.http.ContentType;
import io.restassured.response.Response;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Step definitions for {@code auth.feature}.
 *
 * <p>Covers user registration, login, and password reset. Also exposes
 * a shared "Given I am a registered and authenticated user" step that all
 * other feature files use as their Background step.</p>
 */
public class AuthSteps {

    @Autowired
    private ScenarioContext ctx;

    // ─── Shared Background step (used by all other features) ───────────────

    @Given("I am a registered and authenticated user")
    public void iAmRegisteredAndAuthenticated() {
        // Generate unique email per scenario to avoid H2 unique-constraint clashes
        String email    = "user-" + UUID.randomUUID() + "@test.com";
        String password = "Test@1234";
        String name     = "Test User";

        // Register
        Map<String, String> reg = new HashMap<>();
        reg.put("name",     name);
        reg.put("email",    email);
        reg.put("password", password);

        Response regResponse = ctx.request()
                .contentType(ContentType.JSON)
                .body(reg)
                .when()
                .post("/api/auth/register");

        assertThat(regResponse.statusCode())
                .as("Background registration failed").isEqualTo(201);

        Long userId = regResponse.jsonPath().getLong("id");

        // Login to get JWT
        Map<String, String> creds = new HashMap<>();
        creds.put("email",    email);
        creds.put("password", password);

        Response loginResponse = ctx.request()
                .contentType(ContentType.JSON)
                .body(creds)
                .when()
                .post("/api/auth/login");

        assertThat(loginResponse.statusCode())
                .as("Background login failed").isEqualTo(200);

        String token = loginResponse.jsonPath().getString("token");

        // Store for use in subsequent steps
        ctx.setUserId(userId);
        ctx.setAuthToken(token);
        ctx.setUserEmail(email);
        ctx.setUserPassword(password);
    }

    // ─── Registration steps ────────────────────────────────────────────────

    @Given("a user is registered with email {string} and password {string}")
    public void aUserIsRegistered(String email, String password) {
        Map<String, String> body = new HashMap<>();
        body.put("name",     "Seed User");
        body.put("email",    email);
        body.put("password", password);

        Response r = ctx.request()
                .contentType(ContentType.JSON)
                .body(body)
                .when()
                .post("/api/auth/register");

        // 201 = created, 400 = already exists (idempotent seed)
        assertThat(r.statusCode()).as("Seed registration failed").isIn(201, 400);
    }

    @When("I register with name {string}, email {string}, and password {string}")
    public void iRegister(String name, String email, String password) {
        Map<String, String> body = new HashMap<>();
        body.put("name",     name);
        body.put("email",    email);
        body.put("password", password);

        ctx.setLastResponse(
                ctx.request()
                        .contentType(ContentType.JSON)
                        .body(body)
                        .when()
                        .post("/api/auth/register")
        );
    }

    @When("I register with name {string}, email {string}, and password {string} without auth")
    public void iRegisterWithoutAuth(String name, String email, String password) {
        iRegister(name, email, password);
    }

    // ─── Login steps ──────────────────────────────────────────────────────

    @When("I login with email {string} and password {string}")
    public void iLogin(String email, String password) {
        Map<String, String> body = new HashMap<>();
        body.put("email",    email);
        body.put("password", password);

        ctx.setLastResponse(
                ctx.request()
                        .contentType(ContentType.JSON)
                        .body(body)
                        .when()
                        .post("/api/auth/login")
        );
    }

    @And("I can login with email {string} and new password {string}")
    public void iCanLoginWithNewPassword(String email, String newPassword) {
        Map<String, String> body = new HashMap<>();
        body.put("email",    email);
        body.put("password", newPassword);

        Response r = ctx.request()
                .contentType(ContentType.JSON)
                .body(body)
                .when()
                .post("/api/auth/login");

        assertThat(r.statusCode())
                .as("Expected login with new password to succeed (200)").isEqualTo(200);
        assertThat(r.jsonPath().getString("token"))
                .as("Expected a JWT token after password reset").isNotBlank();
    }

    @And("I try to login with my original credentials")
    public void iTryLoginWithOriginalCredentials() {
        iLogin(ctx.getUserEmail(), ctx.getUserPassword());
    }

    @When("I login with email {string} and password {string} without auth")
    public void iLoginWithoutAuth(String email, String password) {
        iLogin(email, password);
    }

    // ─── Password Reset steps ─────────────────────────────────────────────

    @When("I reset the password for {string} to {string}")
    public void iResetPassword(String email, String newPassword) {
        Map<String, String> body = new HashMap<>();
        body.put("email",       email);
        body.put("newPassword", newPassword);

        ctx.setLastResponse(
                ctx.request()
                        .contentType(ContentType.JSON)
                        .body(body)
                        .when()
                        .put("/api/auth/reset-password")
        );
    }

    @When("I send a reset password request without an email")
    public void iSendResetWithoutEmail() {
        Map<String, String> body = new HashMap<>();
        body.put("newPassword", "somePassword");
        // email field intentionally omitted

        ctx.setLastResponse(
                ctx.request()
                        .contentType(ContentType.JSON)
                        .body(body)
                        .when()
                        .put("/api/auth/reset-password")
        );
    }

    // ─── Assertion steps ──────────────────────────────────────────────────

    @Then("the response status code should be {int}")
    public void theResponseStatusShouldBe(int expectedStatus) {
        assertThat(ctx.getLastResponse().statusCode())
                .as("Unexpected HTTP status code").isEqualTo(expectedStatus);
    }

    @And("the response should contain a JWT token")
    public void theResponseShouldContainJwt() {
        String token = ctx.getLastResponse().jsonPath().getString("token");
        assertThat(token).as("JWT token should be present and non-empty").isNotBlank();
    }

    @And("the response should contain a userId")
    public void theResponseShouldContainUserId() {
        Object userId = ctx.getLastResponse().jsonPath().get("userId");
        assertThat(userId).as("userId should be present in response").isNotNull();
    }

    @And("the response should contain a name")
    public void theResponseShouldContainName() {
        String name = ctx.getLastResponse().jsonPath().getString("name");
        assertThat(name).as("name should be present in response").isNotBlank();
    }

    @And("the response should contain field {string} with value {string}")
    public void theResponseShouldContainField(String field, String expectedValue) {
        String actual = ctx.getLastResponse().jsonPath().getString(field);
        assertThat(actual)
                .as("Field '%s' mismatch", field)
                .isEqualTo(expectedValue);
    }

    @And("the response should contain an id")
    public void theResponseShouldContainId() {
        Object id = ctx.getLastResponse().jsonPath().get("id");
        assertThat(id).as("Response should contain an 'id' field").isNotNull();
    }

    @And("the response should contain message {string}")
    public void theResponseShouldContainMessage(String expectedMessage) {
        String actual = ctx.getLastResponse().jsonPath().getString("message");
        assertThat(actual)
                .as("Response message mismatch").isEqualTo(expectedMessage);
    }

    @And("the response body should contain {string}")
    public void theResponseBodyShouldContain(String text) {
        assertThat(ctx.getLastResponse().getBody().asString())
                .as("Response body should contain: " + text).contains(text);
    }

    @And("the response body should not contain {string}")
    public void theResponseBodyShouldNotContain(String text) {
        assertThat(ctx.getLastResponse().getBody().asString())
                .as("Response body should NOT contain: " + text).doesNotContain(text);
    }

    @And("the response should be an empty list")
    public void theResponseShouldBeEmptyList() {
        assertThat(ctx.getLastResponse().jsonPath().getList("$"))
                .as("Response body should be an empty JSON array").isEmpty();
    }

    @And("the response should not be empty")
    public void theResponseShouldNotBeEmpty() {
        assertThat(ctx.getLastResponse().jsonPath().getList("$"))
                .as("Response body should not be empty").isNotEmpty();
    }
}
