package com.example.expensetracker.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Verifies Google Sign-In ID tokens against Google's own tokeninfo endpoint.
 *
 * <p>Previously, {@code /api/auth/oauth/google} trusted whatever {@code email}
 * and {@code name} the client sent in the request body — meaning anyone could
 * log in as, or silently create, any account just by naming an email address.
 * No token was ever checked.</p>
 *
 * <p>This class fixes that: it only trusts an {@code email} that Google itself
 * has cryptographically signed and confirmed as verified, for a token issued
 * specifically for this application's OAuth client ID. The client-supplied
 * email/name in the request body are no longer used anywhere.</p>
 */
@Component
public class GoogleIdTokenVerifier {

    /**
     * This application's Google OAuth 2.0 Client ID, obtained from
     * https://console.cloud.google.com/apis/credentials.
     *
     * <p>If left blank, Google Sign-In is disabled server-side (fails closed)
     * rather than silently accepting tokens meant for a different app.</p>
     */
    @Value("${google.oauth.client-id:}")
    private String expectedClientId;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private final ObjectMapper objectMapper = new ObjectMapper();

    public record VerifiedIdentity(String email, String name) {}

    public VerifiedIdentity verify(String idToken) {
        if (idToken == null || idToken.isBlank()) {
            throw new BadCredentialsException("Google sign-in failed: no credential supplied.");
        }

        if (expectedClientId == null || expectedClientId.isBlank()) {
            throw new BadCredentialsException(
                    "Google sign-in is not configured on this server yet (missing GOOGLE_OAUTH_CLIENT_ID).");
        }

        JsonNode payload;
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://oauth2.googleapis.com/tokeninfo?id_token=" + idToken))
                    .timeout(Duration.ofSeconds(5))
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                throw new BadCredentialsException("Google sign-in failed: token could not be verified.");
            }
            payload = objectMapper.readTree(response.body());
        } catch (IOException e) {
            throw new BadCredentialsException("Google sign-in failed: could not reach Google's verification service.");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BadCredentialsException("Google sign-in failed: verification was interrupted.");
        }

        // Confirms this token was issued for OUR app, not replayed from some
        // other Google-authenticated client. This is the check the old code skipped.
        String aud = payload.path("aud").asText("");
        if (!expectedClientId.equals(aud)) {
            throw new BadCredentialsException("Google sign-in failed: token was not issued for this application.");
        }

        boolean emailVerified = payload.path("email_verified").asBoolean(false);
        String email = payload.path("email").isMissingNode() ? null : payload.path("email").asText();
        if (email == null || email.isBlank() || !emailVerified) {
            throw new BadCredentialsException("Google sign-in failed: email not verified by Google.");
        }

        String name = payload.path("name").asText("");
        if (name.isBlank()) {
            name = email.split("@")[0];
        }

        return new VerifiedIdentity(email, name);
    }
}
