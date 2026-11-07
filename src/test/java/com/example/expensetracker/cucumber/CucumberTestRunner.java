package com.example.expensetracker.cucumber;

import org.junit.platform.suite.api.ConfigurationParameter;
import org.junit.platform.suite.api.IncludeEngines;
import org.junit.platform.suite.api.SelectClasspathResource;
import org.junit.platform.suite.api.Suite;

import static io.cucumber.junit.platform.engine.Constants.GLUE_PROPERTY_NAME;

/**
 * JUnit Platform suite runner that triggers the Cucumber engine.
 *
 * <p>Explicitly defines the cucumber engine, features classpath resource,
 * and the step-definition glue package.</p>
 */
@Suite
@IncludeEngines("cucumber")
@SelectClasspathResource("features")
@ConfigurationParameter(key = GLUE_PROPERTY_NAME, value = "com.example.expensetracker.cucumber")
public class CucumberTestRunner {
}
