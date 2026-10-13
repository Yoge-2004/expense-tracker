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

    /** e.g. {@code Yoge-2004/expense-tracker-backend}.
     *  Ends in \z (absolute end of input) rather than $. NOTE for future readers:
     *  with {@code String.matches()} the two behave identically, because matches()
     *  must consume the whole input and a trailing newline is therefore rejected
     *  either way (verified on a real JVM: "a/b\n".matches(...$) is false). The
     *  difference only appears if these patterns are ever reused with find() or
     *  lookingAt(), where $ would tolerate one trailing line terminator and \z
     *  would not. \z is kept so the intent ("nothing may follow") is explicit and
     *  survives that kind of refactor. It is hardening, not a bug fix. */
    private static final String REPO_PATTERN = "^[A-Za-z0-9][A-Za-z0-9._-]*/[A-Za-z0-9][A-Za-z0-9._-]*\\z";
    /** e.g. {@code database/expense_tracker.sqlite.enc} — no traversal, no query chars.
     *  Same \z note as REPO_PATTERN above. */
    private static final String PATH_PATTERN = "^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*\\z";

    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(10);
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(120);

    private static final HttpClient HTTP = HttpClient.newBuilder()
            .connectTimeout(CONNECT_TIMEOUT)
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    private HuggingFaceFileClient() {}

    /** Uploads to a Space repository (the original, default behaviour). */
    public static void upload(String repo, String path, Path file, String token)
            throws IOException, InterruptedException {
        upload(REPO_TYPE_SPACE, repo, path, file, token);
    }

    public static void upload(String repoType, String repo, String path, Path file, String token)
            throws IOException, InterruptedException {
        String url = commitUrl(repoType, repo);
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
     * Creates the repository when it does not exist yet. Only datasets and models
     * can be created this way (a Space needs an SDK and is created in the Hub UI),
     * so a Space is a no-op. "Already exists" (HTTP 409) counts as success.
     */
    public static void ensureRepo(String repoType, String repo, boolean isPrivate, String token)
            throws IOException, InterruptedException {
        if ("spaces".equals(apiSegment(repoType))) {
            return;
        }
        HttpRequest request = HttpRequest.newBuilder(URI.create("https://huggingface.co/api/repos/create"))
                .timeout(REQUEST_TIMEOUT)
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(createRepoBody(repoType, repo, isPrivate)))
                .build();
        HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
        int status = response.statusCode();
        if ((status >= 200 && status < 300) || status == 409) {
            return;
        }
        if (status == 403) {
            throw new IllegalStateException("Hugging Face refused to create " + repo + " (HTTP 403): HF_TOKEN needs "
                    + "permission to create repositories. Create the private " + repoType
                    + " repository by hand, or use a token that can create repos.");
        }
        throw new IllegalStateException("Hugging Face repository creation failed (HTTP " + status + "): "
                + response.body());
    }

    /** JSON body for POST /api/repos/create. Package-private so it is unit-testable offline. */
    static String createRepoBody(String repoType, String repo, boolean isPrivate) {
        String validated = requireRepo(repo);
        int slash = validated.indexOf('/');
        String type = "datasets".equals(apiSegment(repoType)) ? "dataset" : "model";
        return "{\"type\":\"" + type + "\",\"name\":\"" + jsonEscape(validated.substring(slash + 1))
                + "\",\"organization\":\"" + jsonEscape(validated.substring(0, slash))
                + "\",\"private\":" + isPrivate + "}";
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

    /** Downloads from a Space repository (the repo type {@link #upload} writes to by default). */
    public static boolean download(String repo, String path, Path destination, String token)
            throws IOException, InterruptedException {
        return download(REPO_TYPE_SPACE, repo, path, destination, token);
    }

    public static boolean download(String repoType, String repo, String path, Path destination, String token)
            throws IOException, InterruptedException {
        String url = resolveUrl(repoType, repo, path);
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

    public static final String REPO_TYPE_SPACE = "space";
    public static final String REPO_TYPE_DATASET = "dataset";
    public static final String REPO_TYPE_MODEL = "model";

    /** Hub API collection segment for a repo type: spaces, datasets or models. */
    static String apiSegment(String repoType) {
        String type = repoType == null ? REPO_TYPE_SPACE : repoType.trim().toLowerCase(java.util.Locale.ROOT);
        return switch (type) {
            case REPO_TYPE_SPACE, "" -> "spaces";
            case REPO_TYPE_DATASET -> "datasets";
            case REPO_TYPE_MODEL -> "models";
            default -> throw new IllegalArgumentException("Invalid Hugging Face repository type");
        };
    }

    /** Commit endpoint for the repo type, e.g. https://huggingface.co/api/spaces/owner/name/commit/main. */
    static String commitUrl(String repoType, String repo) {
        return "https://huggingface.co/api/" + apiSegment(repoType) + "/" + requireRepo(repo) + "/commit/main";
    }

    /**
     * File URL for the repo type. The Hub only omits the type prefix for model
     * repositories; Spaces live under /spaces/ and datasets under /datasets/.
     * Fetching a Space file without that prefix asks for a model repo that does
     * not exist and always answers 404.
     */
    static String resolveUrl(String repoType, String repo, String path) {
        String prefix = switch (apiSegment(repoType)) {
            case "spaces" -> "spaces/";
            case "datasets" -> "datasets/";
            default -> "";
        };
        return "https://huggingface.co/" + prefix + requireRepo(repo) + "/resolve/main/"
                + requirePath(path) + "?download=true";
    }

    /** Package-private (not private) so validation can be unit-tested directly,
     *  with zero risk of a test accidentally reaching the network. */
    static String requireRepo(String repo) {
        if (repo == null || !repo.matches(REPO_PATTERN)) {
            throw new IllegalArgumentException("Invalid Hugging Face repository identifier");
        }
        return repo;
    }

    static String requirePath(String path) {
        if (path == null || !path.matches(PATH_PATTERN) || path.contains("..")) {
            throw new IllegalArgumentException("Invalid Hugging Face file path");
        }
        return path;
    }

    /** Escapes a string for embedding inside a JSON string literal.
     *  Package-private (not private) specifically so it can be unit-tested
     *  directly — its only other caller path is {@link #upload}, which
     *  requires a real network round-trip to observe the result. */
    static String jsonEscape(String value) {
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
