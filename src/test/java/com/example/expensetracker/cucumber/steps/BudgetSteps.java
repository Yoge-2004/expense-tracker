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
 * Step definitions for {@code budget.feature}.
 *
 * <p>Covers setting a monthly budget per category and querying the
 * current-month budget utilisation status.</p>
 *
 * <p>Important: the budget controller returns {@code {"error":"..."}} (not
 * {@code {"message":"..."}}) for positive-number validation failures, so a
 * separate {@code #theResponseShouldContainErrorMessage} step is provided.</p>
 */
public class BudgetSteps {

    @Autowired
    private ScenarioContext ctx;

    // ─── Set budget steps ─────────────────────────────────────────────────

    @Given("I have set a budget of {double} for category id {long}")
    public void iHaveSetABudget(double limit, long categoryId) {
        Map<String, Object> body = new HashMap<>();
        body.put("categoryId",  categoryId);
        body.put("limitAmount", limit);

        Response r = ctx.request()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + ctx.getAuthToken())
                .body(body)
                .when()
                .post("/api/expenses/budget/user/" + ctx.getUserId());

        assertThat(r.statusCode()).as("Seed budget creation failed").isEqualTo(200);
    }

    @When("I set a budget of {double} for category id {long}")
    public void iSetABudget(double limit, long categoryId) {
        Map<String, Object> body = new HashMap<>();
        body.put("categoryId",  categoryId);
        body.put("limitAmount", limit);

        ctx.setLastResponse(
                ctx.request()
                        .contentType(ContentType.JSON)
                        .header("Authorization", "Bearer " + ctx.getAuthToken())
                        .body(body)
                        .when()
                        .post("/api/expenses/budget/user/" + ctx.getUserId())
        );
    }

    @When("I set a budget of {double} for category id {long} with user id {long}")
    public void iSetABudgetForUnknownUser(double limit, long categoryId, long userId) {
        Map<String, Object> body = new HashMap<>();
        body.put("categoryId",  categoryId);
        body.put("limitAmount", limit);

        ctx.setLastResponse(
                ctx.request()
                        .contentType(ContentType.JSON)
                        .header("Authorization", "Bearer " + ctx.getAuthToken())
                        .body(body)
                        .when()
                        .post("/api/expenses/budget/user/" + userId)
        );
    }

    // ─── Get budget status steps ──────────────────────────────────────────

    @When("I get the budget status for my user")
    public void iGetBudgetStatus() {
        ctx.setLastResponse(
                ctx.request()
                        .header("Authorization", "Bearer " + ctx.getAuthToken())
                        .when()
                        .get("/api/expenses/budget/status/user/" + ctx.getUserId())
        );
    }

    // ─── Assertion steps ──────────────────────────────────────────────────

    @And("the budget status should contain category {string}")
    public void theBudgetStatusShouldContainCategory(String categoryName) {
        List<String> names = ctx.getLastResponse().jsonPath().getList("categoryName");
        assertThat(names)
                .as("Budget status should include category '%s'", categoryName)
                .contains(categoryName);
    }

    @And("the budget status for {string} should have limit {double}")
    public void theBudgetLimitFor(String categoryName, double expectedLimit) {
        List<Map<String, Object>> statuses = ctx.getLastResponse().jsonPath().getList("$");

        double actualLimit = statuses.stream()
                .filter(s -> categoryName.equals(s.get("categoryName")))
                .map(s -> Double.parseDouble(s.get("limit").toString()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Category '" + categoryName + "' not found in budget status"));

        assertThat(actualLimit)
                .as("Budget limit for category '%s'", categoryName)
                .isEqualTo(expectedLimit);
    }

    @And("the budget status for {string} should have spent greater than {int}")
    public void theBudgetSpentForShouldBeGreaterThan(String categoryName, int minSpent) {
        List<Map<String, Object>> statuses = ctx.getLastResponse().jsonPath().getList("$");

        double actualSpent = statuses.stream()
                .filter(s -> categoryName.equals(s.get("categoryName")))
                .map(s -> Double.parseDouble(s.get("spent").toString()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Category '" + categoryName + "' not found in budget status"));

        assertThat(actualSpent)
                .as("Spent amount for '%s' should be > %d", categoryName, minSpent)
                .isGreaterThan(minSpent);
    }

    @And("the budget status for {string} should have percentage greater than {int}")
    public void theBudgetPercentageForShouldBeGreaterThan(String categoryName, int minPercentage) {
        List<Map<String, Object>> statuses = ctx.getLastResponse().jsonPath().getList("$");

        double actualPercentage = statuses.stream()
                .filter(s -> categoryName.equals(s.get("categoryName")))
                .map(s -> Double.parseDouble(s.get("percentage").toString()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Category '" + categoryName + "' not found in budget status"));

        assertThat(actualPercentage)
                .as("Budget percentage for '%s' should be > %d%%", categoryName, minPercentage)
                .isGreaterThan(minPercentage);
    }

    /**
     * Asserts the {@code "error"} key in the response body.
     *
     * <p>The budget controller returns {@code {"error":"Budget limit must be a positive number"}}
     * (not {@code {"message":"..."}}) when the limit amount fails the positivity check —
     * this is distinct from the standard {@link AuthSteps#theResponseShouldContainMessage}
     * which checks the {@code "message"} key.</p>
     */
    @And("the response should contain error message {string}")
    public void theResponseShouldContainErrorMessage(String expectedError) {
        String actual = ctx.getLastResponse().jsonPath().getString("error");
        assertThat(actual)
                .as("Response 'error' field mismatch").isEqualTo(expectedError);
    }

    @When("I send a DELETE request to delete budget limit for category {long}")
    public void iSendADeleteRequestToDeleteBudgetLimitForCategory(long categoryId) {
        ctx.setLastResponse(
                ctx.request()
                        .header("Authorization", "Bearer " + ctx.getAuthToken())
                        .when()
                        .delete("/api/expenses/budget/user/" + ctx.getUserId() + "/category/" + categoryId)
        );
    }
}
