package com.example.expensetracker.infrastructure.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;



/**
 * Cross-Origin Resource Sharing (CORS) configuration.
 *
 * <p>Origin reflection is deliberately omitted to prevent unauthorized sites
 * from mounting authenticated credential theft or CSRF against local deployments.
 * Wildcard origin patterns are intentionally not used for public cloud hosting domains.</p>
 */
@Configuration
public class CorsConfig {

    private static final List<String> DEFAULT_ALLOWED_ORIGINS = List.of(
            "https://cozy-narwhal-3099ad.netlify.app",
            "http://localhost:8080",
            "http://localhost:8081",
            "http://localhost:19006",
            "http://localhost:3000",
            "http://localhost:5173",
            "http://localhost:5500",
            "http://localhost:63342",
            "http://127.0.0.1:8080",
            "http://127.0.0.1:8081",
            "http://127.0.0.1:5500",
            "http://127.0.0.1:63342",
            "http://10.0.2.2:8080"
    );

    @Value("${app.cors.allowed-origins:https://cozy-narwhal-3099ad.netlify.app}")
    private String[] allowedOrigins;

    private final CorsProperties corsProperties;

    public CorsConfig(@org.springframework.beans.factory.annotation.Autowired(required = false) CorsProperties corsProperties) {
        this.corsProperties = (corsProperties != null) ? corsProperties : new CorsProperties(List.of());
    }

    private List<String> getCleanOrigins() {
        Set<String> origins = new LinkedHashSet<>(DEFAULT_ALLOWED_ORIGINS);
        if (corsProperties.allowedOrigins() != null) {
            corsProperties.allowedOrigins().stream()
                    .flatMap(s -> Arrays.stream(s.split(",")))
                    .map(String::trim)
                    .filter(CorsConfig::isExplicitOrigin)
                    .forEach(origins::add);
        }
        if (allowedOrigins != null) {
            Arrays.stream(allowedOrigins)
                    .flatMap(s -> Arrays.stream(s.split(",")))
                    .map(String::trim)
                    .filter(CorsConfig::isExplicitOrigin)
                    .forEach(origins::add);
        }
        return new ArrayList<>(origins);
    }

    private static boolean isExplicitOrigin(String value) {
        return value != null && !value.isBlank() && !"null".equalsIgnoreCase(value)
                && !value.contains("*") && (value.startsWith("https://") || value.startsWith("http://"));
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        List<String> origins = getCleanOrigins();

        config.setAllowedOrigins(origins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        config.setAllowedHeaders(List.of(
                "Authorization", "Cache-Control", "Content-Type", "Accept",
                "X-Requested-With", "Origin", "X-Currency", "X-Browser-Session", "X-XSRF-TOKEN"));
        config.setExposedHeaders(List.of("Authorization", "Content-Type", "Content-Disposition", "Content-Length"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

}
