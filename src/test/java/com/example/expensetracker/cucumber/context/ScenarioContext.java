package com.example.expensetracker.cucumber.context;

import io.cucumber.spring.ScenarioScope;
import io.restassured.response.Response;
import org.springframework.stereotype.Component;

/**
 * Scenario-scoped Spring bean that carries shared state across step definitions
 * within a single Cucumber scenario. A fresh instance is created at the start
 * of every scenario and discarded at the end — no state leaks between scenarios.
 */
@Component
@ScenarioScope
public class ScenarioContext {

    @org.springframework.boot.test.web.server.LocalServerPort
    private int port;

    private Response lastResponse;
    private String   authToken;
    private Long     userId;
    private String   userEmail;
    private String   userPassword;
    private Long     expenseId;
    private Long     categoryId;
    private Long     recurringExpenseId;

    public Response getLastResponse()                { return lastResponse; }
    public void     setLastResponse(Response r)      { this.lastResponse = r; }

    public String   getAuthToken()                   { return authToken; }
    public void     setAuthToken(String t)           { this.authToken = t; }

    public Long     getUserId()                      { return userId; }
    public void     setUserId(Long id)               { this.userId = id; }

    public String   getUserEmail()                   { return userEmail; }
    public void     setUserEmail(String e)           { this.userEmail = e; }

    public String   getUserPassword()                { return userPassword; }
    public void     setUserPassword(String p)        { this.userPassword = p; }

    public Long     getExpenseId()                   { return expenseId; }
    public void     setExpenseId(Long id)            { this.expenseId = id; }

    public Long     getCategoryId()                  { return categoryId; }
    public void     setCategoryId(Long id)           { this.categoryId = id; }

    public Long     getRecurringExpenseId()          { return recurringExpenseId; }
    public void     setRecurringExpenseId(Long id)   { this.recurringExpenseId = id; }

    public void reset() {
        this.lastResponse = null;
        this.authToken = null;
        this.userId = null;
        this.userEmail = null;
        this.userPassword = null;
        this.expenseId = null;
        this.categoryId = null;
        this.recurringExpenseId = null;
    }

    public io.restassured.specification.RequestSpecification request() {
        return io.restassured.RestAssured.given()
                .baseUri("http://localhost")
                .port(port);
    }
}
