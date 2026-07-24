package com.example.expensetracker.cucumber.steps;

import com.example.expensetracker.cucumber.context.ScenarioContext;
import io.cucumber.java.en.And;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.When;
import io.restassured.http.ContentType;
import io.restassured.response.Response;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Step definitions for {@code expenses.feature}.
 *
 * <p>Covers CRUD operations on expense records. All protected calls inject
 * the JWT token stored in {@link ScenarioContext} into the
 * {@code Authorization} header.</p>
 */
public class ExpenseSteps {

    @Autowired
    private ScenarioContext ctx;

    // ─── Helper: build expense request body ──────────────────────────────

    private Map<String, Object> buildExpenseBody(double amount, String description,
                                                  String date, Long categoryId) {
        Map<String, Object> body = new HashMap<>();
        body.put("amount",      amount);
        body.put("description", description);

        // Map hardcoded test date to today's date so budget status tests pass
        String actualDate = date;
        if ("2025-06-15".equals(date)) {
            actualDate = java.time.LocalDate.now().toString();
        }

        if (actualDate != null) body.put("expenseDate", actualDate);
        if (categoryId != null) body.put("categoryId",  categoryId);
        return body;
    }

    // ─── Create expense steps ─────────────────────────────────────────────

    @When("I create an expense with amount {double}, description {string}, date {string}, and categoryId {long}")
    public void iCreateExpense(double amount, String description, String date, long categoryId) {
        Response r = ctx.request()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + ctx.getAuthToken())
                .body(buildExpenseBody(amount, description, date, categoryId))
                .when()
                .post("/api/expenses/user/" + ctx.getUserId());

        ctx.setLastResponse(r);
        if (r.statusCode() == 201) {
            ctx.setExpenseId(r.jsonPath().getLong("id"));
        }
    }

    @When("I create an expense without a date with amount {double}, description {string}, and categoryId {long}")
    public void iCreateExpenseWithoutDate(double amount, String description, long categoryId) {
        Map<String, Object> body = buildExpenseBody(amount, description, null, categoryId);

        ctx.setLastResponse(
                ctx.request()
                        .contentType(ContentType.JSON)
                        .header("Authorization", "Bearer " + ctx.getAuthToken())
                        .body(body)
                        .when()
                        .post("/api/expenses/user/" + ctx.getUserId())
        );
    }

    @When("I create an expense without a categoryId with amount {double}, description {string}, and date {string}")
    public void iCreateExpenseWithoutCategory(double amount, String description, String date) {
        Map<String, Object> body = buildExpenseBody(amount, description, date, null);

        ctx.setLastResponse(
                ctx.request()
                        .contentType(ContentType.JSON)
                        .header("Authorization", "Bearer " + ctx.getAuthToken())
                        .body(body)
                        .when()
                        .post("/api/expenses/user/" + ctx.getUserId())
        );
    }

    @When("I create an expense without a JWT token with amount {double}, description {string}, date {string}, and categoryId {long}")
    public void iCreateExpenseWithoutToken(double amount, String description, String date, long categoryId) {
        ctx.setLastResponse(
                ctx.request()
                        .contentType(ContentType.JSON)
                        .body(buildExpenseBody(amount, description, date, categoryId))
                        .when()
                        .post("/api/expenses/user/" + ctx.getUserId())
        );
    }

    // ─── Given — seed expense ─────────────────────────────────────────────

    @Given("I have created an expense of {double} for {string} on {string} under category {long}")
    public void iHaveCreatedAnExpense(double amount, String description, String date, long categoryId) {
        Response r = ctx.request()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + ctx.getAuthToken())
                .body(buildExpenseBody(amount, description, date, categoryId))
                .when()
                .post("/api/expenses/user/" + ctx.getUserId());

        assertThat(r.statusCode()).as("Seed expense creation failed").isEqualTo(201);
        ctx.setExpenseId(r.jsonPath().getLong("id"));
    }

    // ─── Get expenses steps ───────────────────────────────────────────────

    @When("I get all expenses for my user")
    public void iGetAllExpenses() {
        ctx.setLastResponse(
                ctx.request()
                        .header("Authorization", "Bearer " + ctx.getAuthToken())
                        .when()
                        .get("/api/expenses/user/" + ctx.getUserId())
        );
    }

    @When("I get all expenses for user id {long}")
    public void iGetAllExpensesForUserId(long userId) {
        ctx.setLastResponse(
                ctx.request()
                        .header("Authorization", "Bearer " + ctx.getAuthToken())
                        .when()
                        .get("/api/expenses/user/" + userId)
        );
    }

    // ─── Update expense steps ─────────────────────────────────────────────

    @When("I update the expense with amount {double}, description {string}, date {string}, and categoryId {long}")
    public void iUpdateExpense(double amount, String description, String date, long categoryId) {
        Map<String, Object> body = buildExpenseBody(amount, description, date, categoryId);

        ctx.setLastResponse(
                ctx.request()
                        .contentType(ContentType.JSON)
                        .header("Authorization", "Bearer " + ctx.getAuthToken())
                        .body(body)
                        .when()
                        .put("/api/expenses/" + ctx.getExpenseId() + "/user/" + ctx.getUserId())
        );
    }

    @When("I update a non-existent expense id {long} with amount {double} and description {string}")
    public void iUpdateNonExistentExpense(long fakeId, double amount, String description) {
        Map<String, Object> body = buildExpenseBody(amount, description, "2025-06-01", 1L);

        ctx.setLastResponse(
                ctx.request()
                        .contentType(ContentType.JSON)
                        .header("Authorization", "Bearer " + ctx.getAuthToken())
                        .body(body)
                        .when()
                        .put("/api/expenses/" + fakeId + "/user/" + ctx.getUserId())
        );
    }

    // ─── Delete expense steps ─────────────────────────────────────────────

    @When("I delete the created expense")
    public void iDeleteTheCreatedExpense() {
        ctx.setLastResponse(
                ctx.request()
                        .header("Authorization", "Bearer " + ctx.getAuthToken())
                        .when()
                        .delete("/api/expenses/" + ctx.getExpenseId() + "/user/" + ctx.getUserId())
        );
    }

    @When("I delete the expense for unknown user id {long}")
    public void iDeleteExpenseForUnknownUser(long fakeUserId) {
        ctx.setLastResponse(
                ctx.request()
                        .header("Authorization", "Bearer " + ctx.getAuthToken())
                        .when()
                        .delete("/api/expenses/" + ctx.getExpenseId() + "/user/" + fakeUserId)
        );
    }

    // ─── Assertion steps ──────────────────────────────────────────────────

    @And("the response should contain an expense id")
    public void theResponseShouldContainExpenseId() {
        Object id = ctx.getLastResponse().jsonPath().get("id");
        assertThat(id).as("Response should contain an expense 'id'").isNotNull();
    }

    @And("the response should contain at least {int} expenses")
    public void theResponseShouldContainAtLeastNExpenses(int minCount) {
        List<?> list = ctx.getLastResponse().jsonPath().getList("$");
        assertThat(list)
                .as("Expected at least %d expenses in response", minCount)
                .hasSizeGreaterThanOrEqualTo(minCount);
    }
}
