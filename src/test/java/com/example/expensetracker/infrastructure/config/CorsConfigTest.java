package com.example.expensetracker.infrastructure.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CorsConfigTest {

    @Test
    void devProfileIncludesLocalhostAndProductionOrigins() {
        MockEnvironment devEnv = new MockEnvironment();
        devEnv.setActiveProfiles("dev");
        CorsConfig config = new CorsConfig(new CorsProperties(List.of("https://custom.example.com")), devEnv);

        CorsConfiguration cors = extractCors(config.corsConfigurationSource());

        assertThat(cors.getAllowedOrigins())
                .contains("https://cozy-narwhal-3099ad.netlify.app", "https://custom.example.com", "http://localhost:5173");
    }

    @Test
    void prodProfileExcludesLocalhostAndFiltersWildcardOrInvalidOrigins() {
        MockEnvironment prodEnv = new MockEnvironment();
        prodEnv.setActiveProfiles("prod");
        CorsConfig config = new CorsConfig(
                new CorsProperties(List.of("https://*.evil.com", "null", "ftp://bad.example.com", " https://app.example.com ")),
                prodEnv);
        ReflectionTestUtils.setField(config, "allowedOrigins", new String[]{"https://cozy-narwhal-3099ad.netlify.app"});

        CorsConfiguration cors = extractCors(config.corsConfigurationSource());

        assertThat(cors.getAllowedOrigins())
                .containsExactlyInAnyOrder("https://cozy-narwhal-3099ad.netlify.app", "https://app.example.com")
                .noneMatch(origin -> origin.contains("localhost") || origin.contains("127.0.0.1") || origin.contains("*"));
        assertThat(cors.getAllowCredentials()).isTrue();
    }

    private static CorsConfiguration extractCors(CorsConfigurationSource source) {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/users/1");
        CorsConfiguration cors = source.getCorsConfiguration(request);
        assertThat(cors).isNotNull();
        return cors;
    }
}
