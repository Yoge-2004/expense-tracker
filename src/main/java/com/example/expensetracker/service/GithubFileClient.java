package com.example.expensetracker.service;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

/** Minimal GitHub Contents API client for the encrypted binary database snapshot. */
public final class GithubFileClient {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final HttpClient HTTP = HttpClient.newBuilder().build();
    private GithubFileClient() {}

    public static CommitResult upsert(String repo, String path, Path file, String token, String message) throws Exception {
        String api = "https://api.github.com/repos/" + repo + "/contents/" + path;
        String sha = null;
        HttpRequest get = HttpRequest.newBuilder(URI.create(api))
                .header("Authorization", "Bearer " + token)
                .header("Accept", "application/vnd.github+json")
                .GET().build();
        HttpResponse<String> existing = HTTP.send(get, HttpResponse.BodyHandlers.ofString());
        if (existing.statusCode() == 200) sha = JSON.readTree(existing.body()).path("sha").asText(null);
        else if (existing.statusCode() != 404) return new CommitResult(false, existing.statusCode(), null, existing.body());

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("message", message);
        payload.put("content", Base64.getEncoder().encodeToString(Files.readAllBytes(file)));
        if (sha != null) payload.put("sha", sha);
        payload.put("branch", "main");
        HttpRequest put = HttpRequest.newBuilder(URI.create(api))
                .header("Authorization", "Bearer " + token)
                .header("Accept", "application/vnd.github+json")
                .header("X-GitHub-Api-Version", "2022-11-28")
                .header("Content-Type", "application/json")
                .PUT(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(payload))).build();
        HttpResponse<String> response = HTTP.send(put, HttpResponse.BodyHandlers.ofString());
        String commit = response.statusCode() >= 200 && response.statusCode() < 300
                ? JSON.readTree(response.body()).path("commit").path("sha").asText(null) : null;
        return new CommitResult(response.statusCode() >= 200 && response.statusCode() < 300,
                response.statusCode(), commit, response.body());
    }

    public record CommitResult(boolean success, int statusCode, String commitSha, String message) {}
}
