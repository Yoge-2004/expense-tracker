package com.example.expensetracker.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifies that essential HTTP security headers (CSP, HSTS, X-Frame-Options,
 * X-Content-Type-Options, Referrer-Policy, Permissions-Policy) are correctly
 * configured and present in HTTP responses.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("HTTP Security Headers & CSP Configuration Tests")
class SecurityHeadersTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("Verify X-Content-Type-Options is set to nosniff")
    void testXContentTypeOptionsHeader() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Content-Type-Options", "nosniff"));
    }

    @Test
    @DisplayName("Verify X-Frame-Options is SAMEORIGIN")
    void testXFrameOptionsHeader() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Frame-Options", "SAMEORIGIN"));
    }

    @Test
    @DisplayName("Verify Referrer-Policy is strict-origin-when-cross-origin")
    void testReferrerPolicyHeader() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(header().string("Referrer-Policy", "strict-origin-when-cross-origin"));
    }

    @Test
    @DisplayName("Verify Permissions-Policy disables dangerous browser APIs")
    void testPermissionsPolicyHeader() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(header().string("Permissions-Policy", "geolocation=(), camera=(), microphone=(), payment=()"));
    }

    @Test
    @DisplayName("Verify Content-Security-Policy is enforced with valid directives")
    void testContentSecurityPolicyHeader() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(header().exists("Content-Security-Policy"))
                .andExpect(header().string("Content-Security-Policy", containsString("default-src 'self'")))
                .andExpect(header().string("Content-Security-Policy", containsString("script-src 'self'")))
                .andExpect(header().string("Content-Security-Policy", containsString("https://cdn.jsdelivr.net")))
                .andExpect(header().string("Content-Security-Policy", containsString("https://accounts.google.com")))
                .andExpect(header().string("Content-Security-Policy", containsString("frame-ancestors 'self'")));
    }

    @Test
    @DisplayName("Verify Strict-Transport-Security (HSTS) header is returned over HTTPS requests")
    void testHstsHeaderOverHttps() throws Exception {
        mockMvc.perform(get("/api/health").secure(true))
                .andExpect(status().isOk())
                .andExpect(header().exists("Strict-Transport-Security"))
                .andExpect(header().string("Strict-Transport-Security", containsString("max-age=31536000")))
                .andExpect(header().string("Strict-Transport-Security", containsString("includeSubDomains")));
    }
}
