package com.example.expensetracker.config;

import org.jspecify.annotations.NonNull;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

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
 * Wildcard origin patterns are intentionally not used.</p>
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
            "http://127.0.0.1:8080",
            "http://127.0.0.1:8081",
            "http://10.0.2.2:8080"
    );

    @Value("${app.cors.allowed-origins:https://cozy-narwhal-3099ad.netlify.app}")
    private String[] allowedOrigins;

    private List<String> getCleanOrigins() {
        Set<String> origins = new LinkedHashSet<>(DEFAULT_ALLOWED_ORIGINS);
        if (allowedOrigins != null) {
            Arrays.stream(allowedOrigins)
                    .flatMap(s -> Arrays.stream(s.split(",")))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty() && !"null".equalsIgnoreCase(s))
                    .forEach(origins::add);
        }
        return new ArrayList<>(origins);
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        List<String> origins = getCleanOrigins();

        config.setAllowedOrigins(origins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        config.setAllowedHeaders(List.of(
                "Authorization", "Cache-Control", "Content-Type", "Accept",
                "X-Requested-With", "Origin", "X-Currency"));
        config.setExposedHeaders(List.of("Authorization", "Content-Type", "Content-Disposition", "Content-Length"));
        config.setAllowCredentials(false);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(@NonNull CorsRegistry registry) {
                List<String> origins = getCleanOrigins();

                registry.addMapping("/**")
                        .allowedOrigins(origins.toArray(new String[0]))
                        .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH")
                        .allowedHeaders("Authorization", "Cache-Control", "Content-Type",
                                "Accept", "X-Requested-With", "Origin", "X-Currency")
                        .exposedHeaders("Authorization", "Content-Type", "Content-Disposition", "Content-Length")
                        .allowCredentials(false)
                        .maxAge(3600);
            }
        };
    }
}
