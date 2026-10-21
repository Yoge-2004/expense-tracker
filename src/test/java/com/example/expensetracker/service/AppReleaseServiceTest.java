package com.example.expensetracker.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("AppReleaseService")
class AppReleaseServiceTest {

    @Test
    @DisplayName("reads the version, tag and page from a GitHub release")
    void parsesRelease() throws IOException {
        Optional<AppReleaseService.Release> release = AppReleaseService.parse(
                "{\"tag_name\":\"v1.0.5\",\"html_url\":\"https://github.com/o/r/releases/tag/v1.0.5\","
                        + "\"draft\":false,\"prerelease\":false,\"assets\":[]}");

        assertTrue(release.isPresent());
        assertEquals("1.0.5", release.get().version());
        assertEquals("v1.0.5", release.get().tag());
        assertEquals("https://github.com/o/r/releases/tag/v1.0.5", release.get().url());
    }

    @Test
    @DisplayName("ignores drafts and pre-releases")
    void skipsUnfinishedReleases() throws IOException {
        assertTrue(AppReleaseService.parse("{\"tag_name\":\"v1.0.5\",\"draft\":true}").isEmpty());
        assertTrue(AppReleaseService.parse("{\"tag_name\":\"v1.0.5\",\"prerelease\":true}").isEmpty());
    }

    @Test
    @DisplayName("ignores a release whose tag is not a version")
    void skipsNonVersionTags() throws IOException {
        assertTrue(AppReleaseService.parse("{\"tag_name\":\"nightly\"}").isEmpty());
        assertTrue(AppReleaseService.parse("{}").isEmpty());
    }

    @Test
    @DisplayName("a malformed response is an error the caller handles, not a bogus release")
    void rejectsGarbage() {
        assertThrows(JsonProcessingException.class, () -> AppReleaseService.parse("<html>rate limited</html>"));
    }
}
