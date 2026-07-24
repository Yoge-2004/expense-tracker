package com.example.expensetracker.cucumber;

import io.cucumber.spring.CucumberContextConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * Bridges Cucumber's context lifecycle with the Spring Boot test context.
 *
 * <p>{@code @CucumberContextConfiguration} tells cucumber-spring to use this class
 * to bootstrap the {@link org.springframework.context.ApplicationContext}.</p>
 */
@CucumberContextConfiguration
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
public class CucumberSpringConfig {
    // This class remains empty; its purpose is solely to host the context configuration annotations.
}
