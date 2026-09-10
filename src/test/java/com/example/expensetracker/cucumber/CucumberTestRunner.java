package com.example.expensetracker.cucumber;

import org.junit.platform.suite.api.Suite;

/**
 * JUnit Platform suite runner that triggers the Cucumber engine.
 *
 * The class name CucumberTestRunner matches the surefire include pattern
 * (CucumberTestRunner.java) configured in pom.xml.
 *
 * All Cucumber configuration (glue package, feature path, plugins, engine
 * selection) is handled via junit-platform.properties to avoid version-specific
 * annotation API differences across JUnit Platform releases.
 */
@Suite
public class CucumberTestRunner {
}
