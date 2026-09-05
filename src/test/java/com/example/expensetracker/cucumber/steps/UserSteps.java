package com.example.expensetracker.cucumber.steps;

import com.example.expensetracker.cucumber.context.ScenarioContext;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.When;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Step definitions for {@code users.feature}.
 *
 * <p>Covers account deletion and verifies cascading removal of associated data.</p>
 */
public class UserSteps {

    private final ScenarioContext ctx;

    @Autowired
    public UserSteps(ScenarioContext ctx) {
        this.ctx = ctx;
    }

    // ─── Given steps ──────────────────────────────────────────────────────────

    @Given("I have noted my email and password")
    public void iHaveNotedMyEmailAndPassword() {
        // Credentials are already in the scenario context from the Background step —
        // this step exists purely for readability in the feature file.
    }

    // ─── Delete account steps ─────────────────────────────────────────────────

    @When("I delete my account")
    public void iDeleteMyAccount() {
        ctx.setLastResponse(
                ctx.request()
                        .header("Authorization", "Bearer " + ctx.getAuthToken())
                        .contentType("application/json")
                        .body("{\"password\":\"" + ctx.getUserPassword() + "\"}")
                        .when()
                        .delete("/api/users/" + ctx.getUserId())
        );
    }

    @When("I delete my account without a password")
    public void iDeleteMyAccountWithoutPassword() {
        ctx.setLastResponse(
                ctx.request()
                        .header("Authorization", "Bearer " + ctx.getAuthToken())
                        .contentType("application/json")
                        .when()
                        .delete("/api/users/" + ctx.getUserId())
        );
    }

    @When("I delete my account with wrong password {string}")
    public void iDeleteMyAccountWithWrongPassword(String wrongPassword) {
        ctx.setLastResponse(
                ctx.request()
                        .header("Authorization", "Bearer " + ctx.getAuthToken())
                        .contentType("application/json")
                        .body("{\"password\":\"" + wrongPassword + "\"}")
                        .when()
                        .delete("/api/users/" + ctx.getUserId())
        );
    }

    @When("I delete the account for user id {long}")
    public void iDeleteAccountForUserId(long userId) {
        ctx.setLastResponse(
                ctx.request()
                        .header("Authorization", "Bearer " + ctx.getAuthToken())
                        .when()
                        .delete("/api/users/" + userId)
        );
    }

    @When("I delete the account for user id {long} without a JWT token")
    public void iDeleteAccountWithoutToken(long userId) {
        ctx.setLastResponse(
                ctx.request()
                        .when()
                        .delete("/api/users/" + userId)
        );
    }
}
