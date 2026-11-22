package com.example.expensetracker.infrastructure.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import java.util.List;

/**
 * Type-safe configuration properties record for CORS allowed origin policies.
 *
 * @author Yogeshwaran
 */
@ConfigurationProperties(prefix = "app.cors")
public record CorsProperties(
        List<String> allowedOrigins
) {
    public CorsProperties {
        if (allowedOrigins == null) allowedOrigins = List.of();
    }
}
