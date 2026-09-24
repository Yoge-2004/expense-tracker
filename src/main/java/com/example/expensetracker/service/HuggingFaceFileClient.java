package com.example.expensetracker.service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Base64;

/**
 * Minimal Hugging Face Hub client for the encrypted database snapshot.
 *
 * <p>Hardening notes:</p>
 * <ul>
 *   <li>Repository and path segments are validated against strict patterns
 *       before being interpolated into request URLs or the NDJSON body, closing
 *       JSON-injection and URL-manipulation paths.</li>
 *   <li>The NDJSON payload escapes JSON string content explicitly.</li>
 *   <li>Connect and request timeouts bound every call so a stalled Hub cannot
 *       pin virtual threads (this service runs on {@code spring.threads.virtual.enabled}).</li>
 * </ul>
 */
public final class HuggingFaceFileClient {

    /** e.g. {@code Yoge-2004/expense-tracker-backend} */
    private static final String REPO_PATTERN = "^[A-Za-z0-9][A-Za-z0-9._-]*/[A-Za-z0-9][A-Za-z0-9._-]*$";
    /** e.g. {@code database/expense_tracker.sqlite.enc} — no traversal, no query chars */
    private static final String PATH_PATTERN = "^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$";

    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(10);
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(120);

    private static final HttpClient HTTP = HttpClient.newBuilder()
            .connectTimeout(CONNECT_TIMEOUT)
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    private HuggingFaceFileClient() {}

    public static void upload(String repo, String path, Path file, String token)
            throws IOException, InterruptedException {
        String url = "https://huggingface.co/api/spaces/" + requireRepo(repo) + "/commit/main";
        String content = Base64.getEncoder().encodeToString(Files.readAllBytes(file));
        String body = "{\"key\":\"header\",\"value\":{\"summary\":\"Update encrypted Expense Tracker snapshot\"}}\n"
                + "{\"key\":\"file\",\"value\":{\"content\":\"" + content
                + "\",\"encoding\":\"base64\",\"path\":\"" + jsonEscape(requirePath(path)) + "\"}}\n";
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(REQUEST_TIMEOUT)
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/x-ndjson")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
        HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            String responseBody = response.body();
            if (response.statusCode() == 403) {
                throw new IllegalStateException("Hugging Face upload rejected (HTTP 403): The configured HF_TOKEN "
                        + "lacks direct write permission to commit to " + repo
                        + ". Configure a User Access Token with 'Write' role in Space Secrets.");
            }
            throw new IllegalStateException("Hugging Face upload failed (HTTP "
                    + response.statusCode() + "): " + responseBody);
        }
    }

    /**
     * Inspects token validity and permissions with the Hugging Face whoami API.
     */
    public static String inspectToken(String token) {
        if (token == null || token.isBlank()) {
            return "HF_TOKEN is missing or blank.";
        }
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create("https://huggingface.co/api/whoami-v2"))
                    .timeout(CONNECT_TIMEOUT)
                    .header("Authorization", "Bearer " + token)
                    .GET()
                    .build();
            HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 401) {
                return "HF_TOKEN is INVALID or EXPIRED (HTTP 401).";
            }
            if (response.statusCode() == 200) {
                String body = response.body();
                boolean isWrite = body.contains("\"role\":\"write\"") || body.contains("repo.content.write");
                boolean isRead = body.contains("\"role\":\"read\"");
                if (isWrite) {
                    return "HF_TOKEN is VALID with WRITE scope.";
                } else if (isRead) {
                    return "HF_TOKEN has READ-ONLY scope. Direct write/backup requires a token with 'Write' role.";
                } else {
                    return "HF_TOKEN is valid (response: " + body + ")";
                }
            }
            return "Hugging Face whoami returned HTTP " + response.statusCode();
        } catch (Exception e) {
            return "Failed to verify HF_TOKEN with Hugging Face API: " + e.getMessage();
        }
    }

    public static boolean download(String repo, String path, Path destination, String token)
            throws IOException, InterruptedException {
        String url = "https://huggingface.co/" + requireRepo(repo) + "/resolve/main/"
                + requirePath(path) + "?download=true";
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(REQUEST_TIMEOUT)
                .header("Authorization", "Bearer " + token)
                .GET().build();
        HttpResponse<byte[]> response = HTTP.send(request, HttpResponse.BodyHandlers.ofByteArray());
        if (response.statusCode() == 404) {
            return false;
        }
        if (response.statusCode() != 200) {
            throw new IllegalStateException("Hugging Face download failed (HTTP " + response.statusCode() + ")");
        }
        Files.write(destination, response.body());
        return true;
    }

    private static String requireRepo(String repo) {
        if (repo == null || !repo.matches(REPO_PATTERN)) {
            throw new IllegalArgumentException("Invalid Hugging Face repository identifier");
        }
        return repo;
    }

    private static String requirePath(String path) {
        if (path == null || !path.matches(PATH_PATTERN) || path.contains("..")) {
            throw new IllegalArgumentException("Invalid Hugging Face file path");
        }
        return path;
    }

    /** Escapes a string for embedding inside a JSON string literal. */
    private static String jsonEscape(String value) {
        StringBuilder sb = new StringBuilder(value.length() + 8);
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
                }
            }
        }
        return sb.toString();
    }
}
