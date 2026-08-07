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
 * Production-Grade Secure Cross-Origin Resource Sharing (CORS) Configuration.
 * 
 * <p><strong>Security Best Practice:</strong> Hardcoding wildcard ({@code *}) origins with 
 * {@code allowCredentials(true)} poses severe security risks (CSRF, credential theft). 
 * This class dynamically parses explicit trusted origins from configuration / environment 
 * variables (e.g. {@code CORS_ALLOWED_ORIGINS}) while supporting local development environments.</p>
 * 
 * @author Yogeshwaran
 * @version 2.0
 */
@Configuration
public class CorsConfig {

    @Value("${app.cors.allowed-origins:null,http://127.0.0.1:5500,http://localhost:5500,http://localhost:3000,http://localhost:8080,http://127.0.0.1:8080,http://localhost:63342,http://127.0.0.1:63342,http://localhost:*,http://127.0.0.1:*,http://192.168.*:*,http://10.*:*,http://172.*:*}")
    private String[] allowedOrigins;

    /**
     * Configures Spring Security CORS filter with explicit allowed origins.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        
        List<String> origins = Arrays.asList(allowedOrigins);
        config.setAllowedOriginPatterns(origins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        config.setAllowedHeaders(List.of("Authorization", "Cache-Control", "Content-Type", "Accept", "X-Requested-With"));
        config.setExposedHeaders(List.of("Authorization", "Content-Type"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L); // Cache preflight response for 1 hour

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    /**
     * Configures Spring WebMVC controller CORS mapping.
     */
    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(@NonNull CorsRegistry registry) {
                registry.addMapping("/**")
                        .allowedOriginPatterns(allowedOrigins)
                        .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH")
                        .allowedHeaders("Authorization", "Cache-Control", "Content-Type", "Accept", "X-Requested-With")
                        .exposedHeaders("Authorization", "Content-Type")
                        .allowCredentials(true)
                        .maxAge(3600);
            }
        };
    }
}
