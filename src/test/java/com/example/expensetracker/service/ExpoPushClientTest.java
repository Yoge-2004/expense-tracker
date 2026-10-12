package com.example.expensetracker.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("ExpoPushClient — payload and response handling (no network)")
class ExpoPushClientTest {

    @Test
    @DisplayName("only Expo push tokens are accepted")
    void tokenValidation() {
        assertTrue(ExpoPushClient.isValidToken("ExponentPushToken[abc_DEF-123]"));
        assertTrue(ExpoPushClient.isValidToken("ExpoPushToken[abc123]"));
        assertFalse(ExpoPushClient.isValidToken("fcm-raw-token"));
        assertFalse(ExpoPushClient.isValidToken("ExponentPushToken[]"));
        assertFalse(ExpoPushClient.isValidToken("ExponentPushToken[a b]"));
        assertFalse(ExpoPushClient.isValidToken(null));
    }

    @Test
    @DisplayName("one message per token, with the route in data and no data block when there is none")
    void payload() throws Exception {
        String json = ExpoPushClient.buildPayload(
                List.of("ExponentPushToken[a]", "ExponentPushToken[b]"), "Budget", "84% used", "budgets");
        assertTrue(json.startsWith("["));
        assertTrue(json.contains("\"to\":\"ExponentPushToken[a]\""));
        assertTrue(json.contains("\"to\":\"ExponentPushToken[b]\""));
        assertTrue(json.contains("\"title\":\"Budget\""));
        assertTrue(json.contains("\"data\":{\"route\":\"budgets\"}"));

        String noRoute = ExpoPushClient.buildPayload(List.of("ExponentPushToken[a]"), "T", "B", null);
        assertFalse(noRoute.contains("\"data\""));
    }

    @Test
    @DisplayName("titles with quotes and newlines are escaped, not injected into the JSON")
    void payloadEscapesText() throws Exception {
        String json = ExpoPushClient.buildPayload(List.of("ExponentPushToken[a]"), "He said \"hi\"", "line1\nline2", null);
        assertTrue(json.contains("He said \\\"hi\\\""));
        assertTrue(json.contains("line1\\nline2"));
    }

    @Test
    @DisplayName("tokens Expo reports as DeviceNotRegistered are returned so they can be forgotten")
    void unregisteredTokens() throws Exception {
        List<String> tokens = List.of("ExponentPushToken[a]", "ExponentPushToken[b]", "ExponentPushToken[c]");
        String response = "{\"data\":[{\"status\":\"ok\",\"id\":\"1\"},"
                + "{\"status\":\"error\",\"message\":\"x\",\"details\":{\"error\":\"DeviceNotRegistered\"}},"
                + "{\"status\":\"error\",\"message\":\"y\",\"details\":{\"error\":\"MessageRateExceeded\"}}]}";
        assertEquals(List.of("ExponentPushToken[b]"), ExpoPushClient.unregisteredTokens(tokens, response));
    }
}
