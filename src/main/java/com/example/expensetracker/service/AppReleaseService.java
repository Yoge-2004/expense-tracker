package com.example.expensetracker.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Finds the newest published version of the mobile app. Releases are GitHub Releases (the APK workflow publishes
 * one per version), so this asks GitHub for the latest non-draft, non-prerelease release of the repository.
 */
@Slf4j
@Service
public class AppReleaseService {

    /** The newest release: {@code version} without any leading "v", the original {@code tag}, and its page. */
    public record Release(String version, String tag, String url) {
    }

    private static final Pattern REPO = Pattern.compile("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$");
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    @Value("${app.release.repo:Yoge-2004/expense-tracker}")
    private String repo;

    /** The newest release, or empty when there is none or GitHub could not be reached. Never throws. */
    public Optional<Release> latest() {
        if (repo == null || !REPO.matcher(repo).matches()) {
            log.warn("app.release.repo is not a valid owner/name; skipping the app update check.");
            return Optional.empty();
        }
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create("https://api.github.com/repos/" + repo + "/releases/latest"))
                    .timeout(Duration.ofSeconds(15))
                    .header("Accept", "application/vnd.github+json")
                    .header("User-Agent", "expense-tracker-backend")
                    .GET()
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.warn("GitHub returned HTTP {} for the latest app release.", response.statusCode());
                return Optional.empty();
            }
            return parse(response.body());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Optional.empty();
        } catch (Exception e) {
            log.warn("Could not check the latest app release: {}", e.getMessage());
            return Optional.empty();
        }
    }

    static Optional<Release> parse(String json) throws IOException {
        JsonNode node = MAPPER.readTree(json);
        if (node == null || node.path("draft").asBoolean(false) || node.path("prerelease").asBoolean(false)) {
            return Optional.empty();
        }
        String tag = node.path("tag_name").asText("").trim();
        String version = tag.replaceFirst("^[vV]", "");
        if (tag.isEmpty() || !AppVersion.isValid(version)) {
            return Optional.empty();
        }
        return Optional.of(new Release(version, tag, node.path("html_url").asText("")));
    }
}
