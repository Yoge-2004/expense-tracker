package com.example.expensetracker.cucumber.steps;

import com.example.expensetracker.cucumber.context.ScenarioContext;
import io.cucumber.java.en.And;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.When;
import io.restassured.http.ContentType;
import io.restassured.response.Response;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Step definitions for {@code recurring.feature}.
 *
 * <p>Covers adding, listing, updating, and cancelling recurring monthly
 * expense subscriptions.</p>
 */
public class RecurringExpenseSteps {

    @Autowired
    private ScenarioContext ctx;

    // ─── Helper: build recurring expense body ────────────────────────────

    private Map<String, Object> buildRecurringBody(double amount, String description,
                                                    String startDate, long categoryId) {
        Map<String, Object> body = new HashMap<>();
        body.put("amount",      amount);
        body.put("description", description);
        body.put("expenseDate", startDate);
        body.put("categoryId",  categoryId);
        return body;
    }

    // ─── Given — seed subscription ────────────────────────────────────────

    @Given("I have added a recurring expense of {double} for {string} starting {string} under category {long}")
    public void iHaveAddedARecurringExpense(double amount, String description, String date, long categoryId) {
        Response r = ctx.request()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + ctx.getAuthToken())
                .body(buildRecurringBody(amount, description, date, categoryId))
                .when()
                .post("/api/expenses/recurring/user/" + ctx.getUserId());

        assertThat(r.statusCode()).as("Seed recurring expense creation failed").isEqualTo(200);

        // Retrieve the created subscription id from the list
        Response listR = ctx.request()
                .header("Authorization", "Bearer " + ctx.getAuthToken())
                .when()
                .get("/api/expenses/recurring/user/" + ctx.getUserId());

        List<Map<String, Object>> subs = listR.jsonPath().getList("$");
        subs.stream()
                .filter(s -> description.equals(s.get("description")))
                .map(s -> Long.parseLong(s.get("id").toString()))
                .findFirst()
                .ifPresent(ctx::setRecurringExpenseId);
    }

    // ─── Add recurring expense steps ──────────────────────────────────────

    @When("I add a recurring expense of {double} for {string} starting {string} under category {long}")
    public void iAddARecurringExpense(double amount, String description, String date, long categoryId) {
        Response r = ctx.request()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + ctx.getAuthToken())
                .body(buildRecurringBody(amount, description, date, categoryId))
                .when()
                .post("/api/expenses/recurring/user/" + ctx.getUserId());

        ctx.setLastResponse(r);

        if (r.statusCode() == 200) {
            Response listR = ctx.request()
                    .header("Authorization", "Bearer " + ctx.getAuthToken())
                    .when()
                    .get("/api/expenses/recurring/user/" + ctx.getUserId());

            List<Map<String, Object>> subs = listR.jsonPath().getList("$");
            subs.stream()
                    .filter(s -> description.equals(s.get("description")))
                    .map(s -> Long.parseLong(s.get("id").toString()))
                    .findFirst()
                    .ifPresent(ctx::setRecurringExpenseId);
        }
    }

    @When("I add a recurring expense of {double} for {string} starting {string} under category {long} for user id {long}")
    public void iAddRecurringForUnknownUser(double amount, String description,
                                             String date, long categoryId, long userId) {
        ctx.setLastResponse(
                ctx.request()
                        .contentType(ContentType.JSON)
                        .header("Authorization", "Bearer " + ctx.getAuthToken())
                        .body(buildRecurringBody(amount, description, date, categoryId))
                        .when()
                        .post("/api/expenses/recurring/user/" + userId)
        );
    }

    // ─── Get subscriptions steps ──────────────────────────────────────────

    @When("I get all subscriptions for my user")
    public void iGetAllSubscriptions() {
        ctx.setLastResponse(
                ctx.request()
                        .header("Authorization", "Bearer " + ctx.getAuthToken())
                        .when()
                        .get("/api/expenses/recurring/user/" + ctx.getUserId())
        );
    }

    // ─── Update subscription steps ────────────────────────────────────────

    @When("I update the subscription with amount {double} and description {string}")
    public void iUpdateSubscription(double amount, String description) {
        Map<String, Object> body = new HashMap<>();
        body.put("amount",      amount);
        body.put("description", description);

        ctx.setLastResponse(
                ctx.request()
                        .contentType(ContentType.JSON)
                        .header("Authorization", "Bearer " + ctx.getAuthToken())
                        .body(body)
                        .when()
                        .put("/api/expenses/recurring/" + ctx.getRecurringExpenseId())
        );
    }

    @When("I update the subscription next due date to {string}")
    public void iUpdateSubscriptionDueDate(String newDueDate) {
        Map<String, Object> body = new HashMap<>();
        body.put("nextDueDate", newDueDate);

        ctx.setLastResponse(
                ctx.request()
                        .contentType(ContentType.JSON)
                        .header("Authorization", "Bearer " + ctx.getAuthToken())
                        .body(body)
                        .when()
                        .put("/api/expenses/recurring/" + ctx.getRecurringExpenseId())
        );
    }

    @When("I update a non-existent subscription id {long} with amount {double}")
    public void iUpdateNonExistentSubscription(long fakeId, double amount) {
        Map<String, Object> body = new HashMap<>();
        body.put("amount", amount);

        ctx.setLastResponse(
                ctx.request()
                        .contentType(ContentType.JSON)
                        .header("Authorization", "Bearer " + ctx.getAuthToken())
                        .body(body)
                        .when()
                        .put("/api/expenses/recurring/" + fakeId)
        );
    }

    // ─── Cancel subscription steps ────────────────────────────────────────

    @When("I cancel the subscription")
    public void iCancelTheSubscription() {
        ctx.setLastResponse(
                ctx.request()
                        .header("Authorization", "Bearer " + ctx.getAuthToken())
                        .when()
                        .delete("/api/expenses/recurring/" + ctx.getRecurringExpenseId())
        );
    }

    // ─── Assertion steps ──────────────────────────────────────────────────

    @And("the subscriptions list should contain {string}")
    public void theSubscriptionsListShouldContain(String description) {
        List<String> descriptions = ctx.getLastResponse().jsonPath().getList("description");
        assertThat(descriptions)
                .as("Subscriptions list should contain '%s'", description)
                .contains(description);
    }

    @And("each subscription should contain fields {string}, {string}, {string}, {string}, {string}, {string}")
    public void eachSubscriptionShouldContainFields(String f1, String f2, String f3,
                                                     String f4, String f5, String f6) {
        List<String> requiredFields = Arrays.asList(f1, f2, f3, f4, f5, f6);
        List<Map<String, Object>> subs = ctx.getLastResponse().jsonPath().getList("$");

        assertThat(subs).as("Subscription list should not be empty").isNotEmpty();

        for (Map<String, Object> sub : subs) {
            for (String field : requiredFields) {
                assertThat(sub).as("Subscription entry should contain field '%s'", field)
                        .containsKey(field);
                assertThat(sub.get(field)).as("Field '%s' should not be null", field)
                        .isNotNull();
            }
        }
    }
}
