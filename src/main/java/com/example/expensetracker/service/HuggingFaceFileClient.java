package com.example.expensetracker.service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;

/** Minimal Hugging Face Hub upload/download client for the encrypted database snapshot. */
public final class HuggingFaceFileClient {
    private static final HttpClient HTTP = HttpClient.newHttpClient();
    private HuggingFaceFileClient() {}

    public static void upload(String repo, String path, Path file, String token) throws Exception {
        String url = "https://huggingface.co/api/spaces/" + repo + "/upload/" + path;
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/octet-stream")
                .PUT(HttpRequest.BodyPublishers.ofByteArray(Files.readAllBytes(file)))
                .build();
        HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("Hugging Face upload failed (HTTP " + response.statusCode() + "): " + response.body());
        }
    }

    public static boolean download(String repo, String path, Path destination, String token) throws Exception {
        String url = "https://huggingface.co/" + repo + "/resolve/main/" + path + "?download=true";
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .header("Authorization", "Bearer " + token).GET().build();
        HttpResponse<byte[]> response = HTTP.send(request, HttpResponse.BodyHandlers.ofByteArray());
        if (response.statusCode() == 404) return false;
        if (response.statusCode() != 200) throw new IllegalStateException("Hugging Face download failed (HTTP " + response.statusCode() + ")");
        Files.write(destination, response.body());
        return true;
    }
}
