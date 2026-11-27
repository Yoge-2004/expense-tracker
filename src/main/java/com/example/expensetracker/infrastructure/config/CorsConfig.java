package com.example.expensetracker.infrastructure.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
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
 * from mounting authenticated credential theft or CSRF against deployments.
 * Local development origins (localhost / 127.0.0.1 / Android emulator) are only
 * included when the {@code prod} profile is not active.</p>
 */
@Configuration
public class CorsConfig {

    private static final String PRODUCTION_WEB_ORIGIN = "https://cozy-narwhal-3099ad.netlify.app";

    private static final List<String> DEV_ALLOWED_ORIGINS = List.of(
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
    private String[] allowedOrigins = new String[]{PRODUCTION_WEB_ORIGIN};

    private final CorsProperties corsProperties;
    private final Environment environment;

    @Autowired
    public CorsConfig(
            @Autowired(required = false) CorsProperties corsProperties,
            @Autowired(required = false) Environment environment) {
        this.corsProperties = (corsProperties != null) ? corsProperties : new CorsProperties(List.of());
        this.environment = environment;
    }

    public CorsConfig(CorsProperties corsProperties) {
        this(corsProperties, null);
    }

    private List<String> getCleanOrigins() {
        Set<String> origins = new LinkedHashSet<>();
        origins.add(PRODUCTION_WEB_ORIGIN);
        if (!isProductionProfile()) {
            origins.addAll(DEV_ALLOWED_ORIGINS);
        }
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

    private boolean isProductionProfile() {
        return environment != null && environment.acceptsProfiles(Profiles.of("prod"));
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
