package com.example.expensetracker.cucumber.steps;

import com.example.expensetracker.cucumber.context.ScenarioContext;
import io.cucumber.java.en.Given;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

public class DiagnosticSteps {

    @Autowired
    private ScenarioContext ctx;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Given("I diagnostic check")
    public void diagnosticCheck() {
        System.out.println("DIAGNOSTIC: ctx is " + (ctx == null ? "NULL" : "NOT NULL"));
        System.out.println("DIAGNOSTIC: jdbcTemplate is " + (jdbcTemplate == null ? "NULL" : "NOT NULL"));
    }
}
