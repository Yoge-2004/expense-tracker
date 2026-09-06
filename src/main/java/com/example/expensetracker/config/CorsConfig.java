package com.example.expensetracker.config;

import java.util.Arrays;
import java.util.List;
import org.jspecify.annotations.NonNull;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Cross-Origin Resource Sharing configuration.
 *
 * <p>Production origins must be explicitly configured with {@code CORS_ALLOWED_ORIGINS}.
 * Wildcard origin patterns are intentionally not used.</p>
 */
@Configuration
public class CorsConfig {

    private static final List<String> DEFAULT_ALLOWED_ORIGINS = List.of(
            "https://cozy-narwhal-3099ad.netlify.app"
    );

    @Value("${app.cors.allowed-origins:https://cozy-narwhal-3099ad.netlify.app}")
    private String[] allowedOrigins;

    private List<String> getCleanOrigins() {
        if (allowedOrigins == null) {
            return DEFAULT_ALLOWED_ORIGINS;
        }
        List<String> cleaned = Arrays.stream(allowedOrigins)
                .map(String::trim)
                .filter(s -> !s.isEmpty() && !"null".equalsIgnoreCase(s))
                .toList();
        return cleaned.isEmpty() ? DEFAULT_ALLOWED_ORIGINS : cleaned;
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        List<String> origins = getCleanOrigins();

        config.setAllowedOrigins(origins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        config.setAllowedHeaders(List.of("Authorization", "Cache-Control", "Content-Type", "Accept", "X-Requested-With", "Origin", "X-Currency"));
        config.setExposedHeaders(List.of("Authorization", "Content-Type", "Content-Disposition"));
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
                        .allowedHeaders("Authorization", "Cache-Control", "Content-Type", "Accept", "X-Requested-With", "Origin", "X-Currency")
                        .exposedHeaders("Authorization", "Content-Type", "Content-Disposition")
                        .allowCredentials(false)
                        .maxAge(3600);
            }
        };
    }
}
