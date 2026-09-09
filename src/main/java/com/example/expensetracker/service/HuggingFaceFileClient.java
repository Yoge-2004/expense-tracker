package com.example.expensetracker.service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;

/** Minimal Hugging Face Hub client for the encrypted database snapshot. */
public final class HuggingFaceFileClient {
    private static final HttpClient HTTP = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NORMAL).build();
    private HuggingFaceFileClient() {}

    public static void upload(String repo, String path, Path file, String token) throws Exception {
        String url = "https://huggingface.co/api/spaces/" + repo + "/commit/main";
        String content = Base64.getEncoder().encodeToString(Files.readAllBytes(file));
        String body = "{\"key\":\"header\",\"value\":{\"summary\":\"Update encrypted Expense Tracker database snapshot\"}}\n"
                + "{\"key\":\"file\",\"value\":{\"content\":\"" + content + "\",\"encoding\":\"base64\",\"path\":\"" + path + "\"}}\n";
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/x-ndjson")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
        HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("Hugging Face upload failed (HTTP " + response.statusCode() + "): " + response.body());
        }
    }

    public static boolean download(String repo, String path, Path destination, String token) throws Exception {
        String url = "https://huggingface.co/" + repo + "/resolve/main/" + path + "?download=true";
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .header("Authorization", "Bearer " + token)
                .GET().build();
        HttpResponse<byte[]> response = HTTP.send(request, HttpResponse.BodyHandlers.ofByteArray());
        if (response.statusCode() == 404) return false;
        if (response.statusCode() != 200) {
            throw new IllegalStateException("Hugging Face download failed (HTTP " + response.statusCode() + ")");
        }
        Files.write(destination, response.body());
        return true;
    }
}
