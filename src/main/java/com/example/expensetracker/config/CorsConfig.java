package com.example.expensetracker.config;

import org.jspecify.annotations.NonNull;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import org.springframework.beans.factory.annotation.Value;

/**
 * Cross-Origin Resource Sharing (CORS) configuration for the Expense Tracker application.
 *
 * <p>This configuration class allows the frontend application (served at
 * {@code http://127.0.0.1:5500} or the configured production domain) to communicate
 * with the backend REST API by registering appropriate CORS mappings.</p>
 *
 * @author Yogeshwaran
 * @version 1.0
 * @see org.springframework.web.servlet.config.annotation.WebMvcConfigurer
 */
@Configuration
public class CorsConfig {

    @Value("${app.cors.allowed-origins:http://127.0.0.1:5500,http://localhost:5500,http://localhost:3000}")
    private String[] allowedOrigins;

    /**
     * Creates and registers a {@link WebMvcConfigurer} bean that configures
     * CORS mappings for the entire application.
     *
     * @return a {@link WebMvcConfigurer} instance with CORS rules applied
     */
    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {

            /**
             * Registers CORS mappings for all API endpoints.
             *
             * @param registry the {@link CorsRegistry} used to register CORS configurations
             */
            @Override
            public void addCorsMappings(@NonNull CorsRegistry registry) {
                registry.addMapping("/**")
                        .allowedOrigins(allowedOrigins)
                        .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                        .allowedHeaders("*")
                        .allowCredentials(true);
            }
        };
    }
}
