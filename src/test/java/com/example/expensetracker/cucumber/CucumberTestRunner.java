package com.example.expensetracker.cucumber;

import org.junit.platform.suite.api.ConfigurationParameter;
import org.junit.platform.suite.api.IncludeEngines;
import org.junit.platform.suite.api.SelectClasspathResource;
import org.junit.platform.suite.api.Suite;

import static io.cucumber.junit.platform.engine.Constants.GLUE_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.PLUGIN_PROPERTY_NAME;

/**
 * JUnit Platform Suite entry point for all Cucumber feature tests.
 *
 * <p>Discovers every {@code .feature} file under {@code src/test/resources/features},
 * links them to step definitions in the {@code cucumber} package, and writes
 * HTML + JSON + JUnit XML reports to {@code target/cucumber-reports/}.</p>
 *
 * <p>Run with: {@code mvn test -Dtest=CucumberTestRunner}</p>
 */
@Suite
@IncludeEngines("cucumber")
@SelectClasspathResource("features")
@ConfigurationParameter(key = GLUE_PROPERTY_NAME,   value = "com.example.expensetracker.cucumber")
@ConfigurationParameter(key = PLUGIN_PROPERTY_NAME, value = "pretty, html:target/cucumber-reports/report.html, json:target/cucumber-reports/report.json, junit:target/cucumber-reports/report.xml")
public class CucumberTestRunner {
    // Suite marker class — no code needed here.
}
