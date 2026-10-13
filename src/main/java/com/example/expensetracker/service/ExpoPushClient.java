package com.example.expensetracker.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Sends push notifications to phones through Expo's push service. No signing or credentials are needed
 * for Expo push tokens, only an HTTPS POST. Payload building and response parsing are package-private
 * static methods so they can be unit-tested without touching the network.
 */
public final class ExpoPushClient {

    private static final String ENDPOINT = "https://exp.host/--/api/v2/push/send";
    private static final int MAX_BATCH = 100;   // Expo accepts at most 100 messages per request
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private static final Pattern TOKEN = Pattern.compile("^Expo(nent)?PushToken\\[[A-Za-z0-9_\\-]+]$");

    private ExpoPushClient() {}

    public static boolean isValidToken(String token) {
        return token != null && TOKEN.matcher(token).matches();
    }

    /** JSON array of messages, one per token. */
    static String buildPayload(List<String> tokens, String title, String body, String route) throws IOException {
        ArrayNode messages = MAPPER.createArrayNode();
        for (String token : tokens) {
            ObjectNode message = messages.addObject();
            message.put("to", token);
            message.put("title", title);
            message.put("body", body);
            message.put("sound", "default");
            if (route != null && !route.isBlank()) {
                message.putObject("data").put("route", route);
            }
        }
        return MAPPER.writeValueAsString(messages);
    }

    /** Tokens that Expo says no longer belong to an installed app (they should be forgotten). */
    static List<String> unregisteredTokens(List<String> tokens, String responseBody) throws IOException {
        List<String> dead = new ArrayList<>();
        JsonNode data = MAPPER.readTree(responseBody).path("data");
        for (int i = 0; i < data.size() && i < tokens.size(); i++) {
            JsonNode ticket = data.get(i);
            if ("error".equals(ticket.path("status").asText())
                    && "DeviceNotRegistered".equals(ticket.path("details").path("error").asText())) {
                dead.add(tokens.get(i));
            }
        }
        return dead;
    }

    /**
     * Sends one notification to every token.
     *
     * @return the tokens Expo reported as unregistered
     */
    public static List<String> send(List<String> tokens, String title, String body, String route)
            throws IOException, InterruptedException {
        List<String> dead = new ArrayList<>();
        for (int from = 0; from < tokens.size(); from += MAX_BATCH) {
            List<String> batch = tokens.subList(from, Math.min(from + MAX_BATCH, tokens.size()));
            HttpRequest request = HttpRequest.newBuilder(URI.create(ENDPOINT))
                    .timeout(Duration.ofSeconds(15))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(buildPayload(batch, title, body, route)))
                    .build();
            HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                throw new IOException("Expo push service answered HTTP " + response.statusCode());
            }
            dead.addAll(unregisteredTokens(batch, response.body()));
        }
        return dead;
    }
}
