package com.example.expensetracker.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Character-level tests for {@link HuggingFaceFileClient}'s repo/path
 * validation and JSON escaping — the three private-turned-package-private
 * pure functions that guard against URL manipulation and JSON injection
 * before any request is built. These are tested directly (no reflection,
 * matching this codebase's convention of never reaching into private
 * internals) and never touch the network: {@code requireRepo}/{@code
 * requirePath} validate and throw before {@link HuggingFaceFileClient#upload}
 * or {@link HuggingFaceFileClient#download} would build a URL or open a
 * connection, so calling them directly here is both a faithful test of the
 * real validation path and impossible to make flaky via network access.
 */
class HuggingFaceFileClientTest {

    @Nested
    @DisplayName("requireRepo — REPO_PATTERN: ^[A-Za-z0-9][A-Za-z0-9._-]*/[A-Za-z0-9][A-Za-z0-9._-]*$")
    class RequireRepoTests {

        @Test
        @DisplayName("null is rejected")
        void nullRejected() {
            assertThrows(IllegalArgumentException.class, () -> HuggingFaceFileClient.requireRepo(null));
        }

        @Test
        @DisplayName("empty string is rejected (needs at least one char per segment)")
        void emptyStringRejected() {
            assertThrows(IllegalArgumentException.class, () -> HuggingFaceFileClient.requireRepo(""));
        }

        @Test
        @DisplayName("minimal valid single-char/single-char repo passes")
        void minimalValidRepoPasses() {
            assertEquals("a/b", HuggingFaceFileClient.requireRepo("a/b"));
        }

        @Test
        @DisplayName("the real production default (Yoge-2004/expense-tracker-backend) passes")
        void realProductionDefaultPasses() {
            assertEquals("Yoge-2004/expense-tracker-backend",
                    HuggingFaceFileClient.requireRepo("Yoge-2004/expense-tracker-backend"));
        }

        @Test
        @DisplayName("dots, underscores and hyphens are allowed after the first character of each segment")
        void dotsUnderscoresHyphensAllowed() {
            assertEquals("my-org_1/my.repo-name_2",
                    HuggingFaceFileClient.requireRepo("my-org_1/my.repo-name_2"));
        }

        @Test
        @DisplayName("missing the mandatory slash is rejected")
        void missingSlashRejected() {
            assertThrows(IllegalArgumentException.class, () -> HuggingFaceFileClient.requireRepo("noslash"));
        }

        @Test
        @DisplayName("a segment starting with a hyphen is rejected (first char must be alphanumeric)")
        void segmentStartingWithHyphenRejected() {
            assertThrows(IllegalArgumentException.class, () -> HuggingFaceFileClient.requireRepo("-abc/def"));
        }

        @Test
        @DisplayName("a segment starting with a dot is rejected (first char must be alphanumeric)")
        void segmentStartingWithDotRejected() {
            assertThrows(IllegalArgumentException.class, () -> HuggingFaceFileClient.requireRepo(".abc/def"));
        }

        @Test
        @DisplayName("a segment starting with an underscore is rejected (first char must be alphanumeric)")
        void segmentStartingWithUnderscoreRejected() {
            assertThrows(IllegalArgumentException.class, () -> HuggingFaceFileClient.requireRepo("_abc/def"));
        }

        @Test
        @DisplayName("trailing slash with nothing after it is rejected (second segment needs >=1 char)")
        void trailingSlashWithNothingAfterRejected() {
            assertThrows(IllegalArgumentException.class, () -> HuggingFaceFileClient.requireRepo("abc/"));
        }

        @Test
        @DisplayName("leading slash with nothing before it is rejected (first segment needs >=1 char)")
        void leadingSlashWithNothingBeforeRejected() {
            assertThrows(IllegalArgumentException.class, () -> HuggingFaceFileClient.requireRepo("/abc"));
        }

        @Test
        @DisplayName("a second slash (three-segment path) is rejected — exactly one slash is structural")
        void secondSlashRejected() {
            assertThrows(IllegalArgumentException.class, () -> HuggingFaceFileClient.requireRepo("a/b/c"));
        }

        @Test
        @DisplayName("an embedded space character anywhere is rejected")
        void embeddedSpaceRejected() {
            assertThrows(IllegalArgumentException.class, () -> HuggingFaceFileClient.requireRepo("a b/c"));
            assertThrows(IllegalArgumentException.class, () -> HuggingFaceFileClient.requireRepo("a/c d"));
        }

        @Test
        @DisplayName("leading or trailing whitespace around an otherwise-valid repo is rejected, not trimmed")
        void surroundingWhitespaceRejectedNotTrimmed() {
            assertThrows(IllegalArgumentException.class, () -> HuggingFaceFileClient.requireRepo(" a/b"));
            assertThrows(IllegalArgumentException.class, () -> HuggingFaceFileClient.requireRepo("a/b "));
        }

        @Test
        @DisplayName(
                "a single trailing newline or carriage return is rejected, not trimmed away. (This "
                + "holds with either $ or \\z under String.matches(), which needs a full match — "
                + "verified on a real JVM; \\z is used so the intent stays explicit if the patterns "
                + "are ever reused with find(), where $ WOULD tolerate one trailing terminator.)")
        void trailingNewlineRejectedNotTolerated() {
            assertThrows(IllegalArgumentException.class, () -> HuggingFaceFileClient.requireRepo("a/b\n"));
            assertThrows(IllegalArgumentException.class, () -> HuggingFaceFileClient.requireRepo("a/b\r"));
        }

        @Test
        @DisplayName("a non-ASCII letter (e.g. accented e) is rejected — charset is strictly [A-Za-z0-9._-]")
        void nonAsciiLetterRejected() {
            assertThrows(IllegalArgumentException.class, () -> HuggingFaceFileClient.requireRepo("caf\u00e9/repo"));
        }

        @Test
        @DisplayName("a tab or newline embedded mid-string is rejected")
        void embeddedControlCharsRejected() {
            assertThrows(IllegalArgumentException.class, () -> HuggingFaceFileClient.requireRepo("a\tb/c"));
            assertThrows(IllegalArgumentException.class, () -> HuggingFaceFileClient.requireRepo("a\nb/c"));
        }

        @Test
        @DisplayName("percent-encoded traversal-style sequences are rejected ('%' is not in the charset)")
        void percentEncodedSequenceRejected() {
            assertThrows(IllegalArgumentException.class,
                    () -> HuggingFaceFileClient.requireRepo("..%2f..%2f/etc"));
        }

        @Test
        @DisplayName("a single '@' character is rejected — not in the allowed charset")
        void atSymbolRejected() {
            assertThrows(IllegalArgumentException.class, () -> HuggingFaceFileClient.requireRepo("a@b/c"));
        }

        @Test
        @DisplayName(
                "'..' embedded inside a single segment is syntactically valid here — structurally harmless "
                + "since exactly one literal slash is permitted, so it can never form a genuine traversal segment")
        void embeddedDoubleDotWithinSegmentIsAllowed() {
            assertEquals("ab..cd/ef..gh", HuggingFaceFileClient.requireRepo("ab..cd/ef..gh"));
        }
    }

    @Nested
    @DisplayName("requirePath — PATH_PATTERN: ^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$ plus an explicit '..' ban")
    class RequirePathTests {

        @Test
        @DisplayName("null is rejected")
        void nullRejected() {
            assertThrows(IllegalArgumentException.class, () -> HuggingFaceFileClient.requirePath(null));
        }

        @Test
        @DisplayName("empty string is rejected")
        void emptyStringRejected() {
            assertThrows(IllegalArgumentException.class, () -> HuggingFaceFileClient.requirePath(""));
        }

        @Test
        @DisplayName("a single-segment filename passes")
        void singleSegmentFilenamePasses() {
            assertEquals("file.enc", HuggingFaceFileClient.requirePath("file.enc"));
        }

        @Test
        @DisplayName("the real production default path (database/expense_tracker.sqlite.enc) passes")
        void realProductionDefaultPathPasses() {
            assertEquals("database/expense_tracker.sqlite.enc",
                    HuggingFaceFileClient.requirePath("database/expense_tracker.sqlite.enc"));
        }

        @Test
        @DisplayName("multiple slash-separated segments are allowed (unlike requireRepo)")
        void multipleSegmentsAllowed() {
            assertEquals("a/b/c/d.enc", HuggingFaceFileClient.requirePath("a/b/c/d.enc"));
        }

        @Test
        @DisplayName("a leading slash is rejected (first char of the whole path must be alphanumeric/./_/-)")
        void leadingSlashRejected() {
            assertThrows(IllegalArgumentException.class, () -> HuggingFaceFileClient.requirePath("/etc/passwd"));
        }

        @Test
        @DisplayName("a trailing slash is rejected (implies an empty trailing segment)")
        void trailingSlashRejected() {
            assertThrows(IllegalArgumentException.class, () -> HuggingFaceFileClient.requirePath("abc/"));
        }

        @Test
        @DisplayName("a double slash (empty segment in the middle) is rejected")
        void doubleSlashRejected() {
            assertThrows(IllegalArgumentException.class, () -> HuggingFaceFileClient.requirePath("a//b"));
        }

        @Test
        @DisplayName(
                "'..' as its own path segment IS accepted by PATH_PATTERN's character class alone (dots are "
                + "allowed characters) — traversal prevention here depends entirely on the separate "
                + "explicit contains(\"..\") check, not the regex. This pins that down so a future edit "
                + "can't silently drop the real guard while the regex still looks fine on its own.")
        void doubleDotSegmentMatchesRegexButIsBlockedByExplicitCheck() {
            assertTrue("a/../etc".matches("^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$"),
                    "sanity check: the regex alone does not exclude '..' segments");
            assertThrows(IllegalArgumentException.class, () -> HuggingFaceFileClient.requirePath("a/../etc"));
        }

        @Test
        @DisplayName("'..' at the very start of the path is rejected")
        void doubleDotAtStartRejected() {
            assertThrows(IllegalArgumentException.class, () -> HuggingFaceFileClient.requirePath("../etc/passwd"));
        }

        @Test
        @DisplayName("'..' at the very end of the path is rejected")
        void doubleDotAtEndRejected() {
            assertThrows(IllegalArgumentException.class, () -> HuggingFaceFileClient.requirePath("a/b/.."));
        }

        @Test
        @DisplayName(
                "two consecutive dots inside one filename (not forming a directory-traversal segment) are "
                + "still rejected — the contains(\"..\") check is a broad substring match, not slash-aware, "
                + "so it errs toward over-rejecting a legitimate-looking filename rather than under-rejecting "
                + "an actual traversal attempt. Pinned down as current, intentional behavior.")
        void innocuousDoubleDotInFilenameStillRejected() {
            assertThrows(IllegalArgumentException.class, () -> HuggingFaceFileClient.requirePath("file..bak"));
        }

        @Test
        @DisplayName("a single dot segment ('.') is allowed by the pattern (only '..' is explicitly banned)")
        void singleDotSegmentAllowed() {
            assertEquals("a/./b", HuggingFaceFileClient.requirePath("a/./b"));
        }

        @Test
        @DisplayName("an embedded space is rejected")
        void embeddedSpaceRejected() {
            assertThrows(IllegalArgumentException.class, () -> HuggingFaceFileClient.requirePath("a b/c"));
        }

        @Test
        @DisplayName("a null byte embedded in the path is rejected")
        void embeddedNullByteRejected() {
            assertThrows(IllegalArgumentException.class, () -> HuggingFaceFileClient.requirePath("a\u0000b/c"));
        }

        @Test
        @DisplayName("a backslash is rejected — only forward slash is a valid separator")
        void backslashRejected() {
            assertThrows(IllegalArgumentException.class, () -> HuggingFaceFileClient.requirePath("a\\b"));
        }
    }

    @Nested
    @DisplayName("jsonEscape — exact character-by-character JSON string escaping")
    class JsonEscapeTests {

        @Test
        @DisplayName("empty string maps to empty string")
        void emptyStringMapsToEmpty() {
            assertEquals("", HuggingFaceFileClient.jsonEscape(""));
        }

        @Test
        @DisplayName("a string with no special characters is returned completely unchanged")
        void plainStringUnchanged() {
            assertEquals("database/expense_tracker.sqlite.enc",
                    HuggingFaceFileClient.jsonEscape("database/expense_tracker.sqlite.enc"));
        }

        @Test
        @DisplayName("a double quote becomes backslash-quote")
        void doubleQuoteEscaped() {
            assertEquals("\\\"", HuggingFaceFileClient.jsonEscape("\""));
        }

        @Test
        @DisplayName("a single backslash becomes two backslashes")
        void backslashEscaped() {
            assertEquals("\\\\", HuggingFaceFileClient.jsonEscape("\\"));
        }

        @Test
        @DisplayName("a real newline becomes the two literal characters backslash-n")
        void newlineEscaped() {
            assertEquals("\\n", HuggingFaceFileClient.jsonEscape("\n"));
        }

        @Test
        @DisplayName("a real carriage return becomes the two literal characters backslash-r")
        void carriageReturnEscaped() {
            assertEquals("\\r", HuggingFaceFileClient.jsonEscape("\r"));
        }

        @Test
        @DisplayName("a real tab becomes the two literal characters backslash-t")
        void tabEscaped() {
            assertEquals("\\t", HuggingFaceFileClient.jsonEscape("\t"));
        }

        @Test
        @DisplayName("U+001F (last control char below the escape boundary) becomes \\u001f")
        void lastControlCharBelowBoundaryEscaped() {
            assertEquals("\\u001f", HuggingFaceFileClient.jsonEscape("\u001f"));
        }

        @Test
        @DisplayName("U+0000 (NUL) becomes \\u0000, zero-padded to exactly 4 hex digits")
        void nulCharacterEscapedWithFullPadding() {
            assertEquals("\\u0000", HuggingFaceFileClient.jsonEscape("\u0000"));
        }

        @Test
        @DisplayName("U+0001 becomes \\u0001 — exercises the zero-padding for a single non-zero hex digit")
        void controlChar0x01ZeroPadded() {
            assertEquals("\\u0001", HuggingFaceFileClient.jsonEscape("\u0001"));
        }

        @Test
        @DisplayName(
                "U+0020 (space, the first character AT the escape boundary, not below it) is left completely "
                + "literal and unescaped — pins the exact off-by-one boundary between 0x1F and 0x20")
        void spaceAtBoundaryNotEscaped() {
            assertEquals(" ", HuggingFaceFileClient.jsonEscape(" "));
        }

        @Test
        @DisplayName(
                "U+007F (DEL) is left literal and unescaped — this matches the JSON spec (RFC 8259) exactly: "
                + "only U+0000-U+001F MUST be escaped, and DEL is legal unescaped even though it's a control "
                + "character semantically. Confirms the boundary check is '< 0x20', not 'is a control char'.")
        void delCharacterNotEscaped() {
            assertEquals("\u007f", HuggingFaceFileClient.jsonEscape("\u007f"));
        }

        @Test
        @DisplayName("a non-ASCII Unicode character (accented letter) passes through completely unchanged")
        void unicodeLetterUnchanged() {
            assertEquals("caf\u00e9", HuggingFaceFileClient.jsonEscape("caf\u00e9"));
        }

        @Test
        @DisplayName("a Unicode character outside the Basic Multilingual Plane (surrogate pair) is preserved intact")
        void surrogatePairPreservedIntact() {
            String emoji = "\uD83C\uDF89"; // U+1F389 PARTY POPPER, encoded as a UTF-16 surrogate pair
            assertEquals(emoji, HuggingFaceFileClient.jsonEscape(emoji));
        }

        @Test
        @DisplayName(
                "multiple special characters in sequence are each escaped independently with no "
                + "cross-contamination between adjacent escapes")
        void multipleSpecialCharsInSequence() {
            // a " b \ c \n d  ->  a \" b \\ c \n d   (escapes shown as literal 2-char sequences)
            assertEquals("a \\\" b \\\\ c \\n d", HuggingFaceFileClient.jsonEscape("a \" b \\ c \n d"));
        }

        @Test
        @DisplayName("a backslash immediately followed by a quote is escaped as two independent units, not merged")
        void backslashImmediatelyFollowedByQuote() {
            // input: \"  (backslash then quote, 2 chars) -> output: \\\"  (4 chars: \\ then \")
            assertEquals("\\\\\\\"", HuggingFaceFileClient.jsonEscape("\\\""));
        }

        @Test
        @DisplayName("three consecutive backslashes each become their own doubled pair, in order")
        void threeConsecutiveBackslashes() {
            assertEquals("\\\\\\\\\\\\", HuggingFaceFileClient.jsonEscape("\\\\\\"));
        }
    }

    @Nested
    @DisplayName("repo type URLs — Spaces and datasets live under their own prefix on the Hub")
    class RepoTypeUrls {

        @Test
        @DisplayName("a Space file is resolved under /spaces/ (the bare path is a model repo and always 404s)")
        void spaceResolveUrlHasSpacesPrefix() {
            assertEquals(
                    "https://huggingface.co/spaces/Yoge-2004/expense-tracker-backend/resolve/main/"
                            + "database/expense_tracker.sqlite.enc?download=true",
                    HuggingFaceFileClient.resolveUrl("space", "Yoge-2004/expense-tracker-backend",
                            "database/expense_tracker.sqlite.enc"));
        }

        @Test
        @DisplayName("a null or blank repo type means space, so existing deployments keep working")
        void nullAndBlankDefaultToSpace() {
            assertEquals("spaces", HuggingFaceFileClient.apiSegment(null));
            assertEquals("spaces", HuggingFaceFileClient.apiSegment("  "));
            assertEquals("spaces", HuggingFaceFileClient.apiSegment("SPACE"));
        }

        @Test
        @DisplayName("dataset repos use /datasets/ for files and /api/datasets/ for commits")
        void datasetUrls() {
            assertEquals("https://huggingface.co/datasets/a/b/resolve/main/x.enc?download=true",
                    HuggingFaceFileClient.resolveUrl("dataset", "a/b", "x.enc"));
            assertEquals("https://huggingface.co/api/datasets/a/b/commit/main",
                    HuggingFaceFileClient.commitUrl("dataset", "a/b"));
        }

        @Test
        @DisplayName("model repos have no prefix on file URLs")
        void modelUrlsHaveNoPrefix() {
            assertEquals("https://huggingface.co/a/b/resolve/main/x.enc?download=true",
                    HuggingFaceFileClient.resolveUrl("model", "a/b", "x.enc"));
        }

        @Test
        @DisplayName("upload and download target the same Space repo through the commit and resolve URLs")
        void spaceCommitUrl() {
            assertEquals("https://huggingface.co/api/spaces/a/b/commit/main",
                    HuggingFaceFileClient.commitUrl("space", "a/b"));
        }

        @Test
        @DisplayName("repo creation body names the dataset, its owner and is private")
        void createRepoBody() {
            assertEquals("{\"type\":\"dataset\",\"name\":\"expense-tracker-data\","
                            + "\"organization\":\"Yoge-2004\",\"private\":true}",
                    HuggingFaceFileClient.createRepoBody("dataset", "Yoge-2004/expense-tracker-data", true));
        }

        @Test
        @DisplayName("a Space is never created through the API, so ensureRepo returns without any request")
        void ensureRepoIsNoOpForSpaces() {
            assertDoesNotThrow(() -> HuggingFaceFileClient.ensureRepo("space", "a/b", true, "token"));
            assertDoesNotThrow(() -> HuggingFaceFileClient.ensureRepo(null, "a/b", true, "token"));
        }

        @Test
        @DisplayName("an unknown repo type is rejected instead of building a URL")
        void unknownRepoTypeRejected() {
            assertThrows(IllegalArgumentException.class, () -> HuggingFaceFileClient.apiSegment("bucket"));
        }

        @Test
        @DisplayName("repo and path validation still apply when building URLs")
        void validationStillApplies() {
            assertThrows(IllegalArgumentException.class, () -> HuggingFaceFileClient.resolveUrl("space", "noslash", "x.enc"));
            assertThrows(IllegalArgumentException.class, () -> HuggingFaceFileClient.resolveUrl("space", "a/b", "../x"));
        }
    }
}
