package com.example.expensetracker.cucumber.steps;

import com.example.expensetracker.cucumber.context.ScenarioContext;
import io.cucumber.java.en.When;
import org.springframework.beans.factory.annotation.Autowired;

public class SystemFeaturesSteps {

    @Autowired
    private ScenarioContext ctx;

    @When("I send a GET request to {string}")
    public void iSendAGetRequestTo(String endpoint) {
        ctx.setLastResponse(
                ctx.request()
                        .header("Authorization", "Bearer " + ctx.getAuthToken())
                        .when()
                        .get(endpoint)
        );
    }

    @When("I send a POST request to {string} without body")
    public void iSendAPostRequestWithoutBody(String endpoint) {
        ctx.setLastResponse(
                ctx.request()
                        .header("Authorization", "Bearer " + ctx.getAuthToken())
                        .when()
                        .post(endpoint)
        );
    }

    @When("I export expenses as {string} for my user")
    public void iExportExpensesAs(String format) {
        ctx.setLastResponse(
                ctx.request()
                        .header("Authorization", "Bearer " + ctx.getAuthToken())
                        .when()
                        .get("/api/expenses/user/" + ctx.getUserId() + "/export/" + format)
        );
    }
}
