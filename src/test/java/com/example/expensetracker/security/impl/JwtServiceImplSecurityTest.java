package com.example.expensetracker.security.impl;

import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.security.SignatureException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Security-focused, boundary-level tests for {@link JwtServiceImpl}, complementing
 * {@link JwtServiceImplTest} (which covers the happy paths and basic tamper/expiry).
 * This suite targets: the exact 31/32-byte key boundary, secret parsing rules
 * (Base64 vs plain text, whitespace), cross-key rejection, unsigned ("alg":"none")
 * tokens, every UserDetails status flag, and exact round-tripping of unusual
 * characters in the subject.
 */
class JwtServiceImplSecurityTest {

    private static final long ONE_HOUR = 3_600_000L;

    private static String b64(int byteCount) {
        byte[] key = new byte[byteCount];
        Arrays.fill(key, (byte) 'A');
        return Base64.getEncoder().encodeToString(key);
    }

    private static JwtServiceImpl service(String secret, long expirationMs) {
        JwtServiceImpl s = new JwtServiceImpl();
        ReflectionTestUtils.setField(s, "secretKey", secret);
        ReflectionTestUtils.setField(s, "jwtExpiration", expirationMs);
        s.init();
        return s;
    }

    private static String urlB64(String json) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(json.getBytes(StandardCharsets.UTF_8));
    }

    private static UserDetails user(String email, boolean enabled, boolean nonExpired,
                                    boolean credsNonExpired, boolean nonLocked) {
        return new User(email, "pw", enabled, nonExpired, credsNonExpired, nonLocked, List.of());
    }

    @Nested
    @DisplayName("secret handling at init()")
    class SecretHandling {

        @Test
        @DisplayName("exactly 32 bytes (the minimum for HS256) is accepted")
        void exactly32BytesAccepted() {
            assertDoesNotThrow(() -> service(b64(32), ONE_HOUR));
        }

        @Test
        @DisplayName("31 bytes is rejected, and the message reports the exact length")
        void oneByteShortRejected() {
            JwtServiceImpl s = new JwtServiceImpl();
            ReflectionTestUtils.setField(s, "secretKey", b64(31));
            ReflectionTestUtils.setField(s, "jwtExpiration", ONE_HOUR);
            IllegalStateException ex = assertThrows(IllegalStateException.class, s::init);
            assertTrue(ex.getMessage().contains("Current length: 31 bytes"), ex.getMessage());
        }

        @Test
        @DisplayName("null and empty-string secrets are both rejected (not just whitespace)")
        void nullAndEmptyRejected() {
            for (String bad : new String[]{null, ""}) {
                JwtServiceImpl s = new JwtServiceImpl();
                ReflectionTestUtils.setField(s, "secretKey", bad);
                ReflectionTestUtils.setField(s, "jwtExpiration", ONE_HOUR);
                assertThrows(IllegalStateException.class, s::init, "secret=" + bad);
            }
        }

        @Test
        @DisplayName("a plain-text secret containing non-Base64 characters falls back to raw UTF-8 bytes")
        void plainTextSecretUsedAsUtf8() {
            // Long enough that the resulting key is >= 32 bytes however the Base64
            // decoder treats the non-alphabet characters (spaces, commas, '&', '!').
            String plain = "this is a plain text secret, with spaces & punctuation! "
                    + "it is deliberately long so it clears the 32-byte minimum either way, "
                    + "1234567890 ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz";
            JwtServiceImpl s = service(plain, ONE_HOUR);
            assertEquals("a@b.com", s.extractUsername(s.generateToken("a@b.com")));
        }

        @Test
        @DisplayName("surrounding whitespace on the secret is trimmed: both forms derive the same key")
        void whitespaceAroundSecretTrimmed() {
            String secret = b64(40);
            JwtServiceImpl padded = service("  " + secret + "\n", ONE_HOUR);
            JwtServiceImpl clean = service(secret, ONE_HOUR);
            assertEquals("a@b.com", clean.extractUsername(padded.generateToken("a@b.com")));
        }

        @Test
        @DisplayName("SHARP EDGE: a 32-char alphanumeric secret is valid Base64, so it decodes to 24 "
                + "bytes and is rejected even though its UTF-8 form would be 32 bytes. Fails closed "
                + "(no weak key is ever used) but is surprising — pinned so any change is deliberate.")
        void thirtyTwoCharAlphanumericSecretIsTreatedAsBase64() {
            String looksPlainButIsBase64 = "abcdefghijklmnopqrstuvwxyz012345";
            assertEquals(32, looksPlainButIsBase64.length());
            JwtServiceImpl s = new JwtServiceImpl();
            ReflectionTestUtils.setField(s, "secretKey", looksPlainButIsBase64);
            ReflectionTestUtils.setField(s, "jwtExpiration", ONE_HOUR);
            IllegalStateException ex = assertThrows(IllegalStateException.class, s::init);
            assertTrue(ex.getMessage().contains("Current length: 24 bytes"), ex.getMessage());
        }
    }

    @Nested
    @DisplayName("token verification")
    class Verification {

        @Test
        @DisplayName("a token signed with a different key is rejected with SignatureException")
        void tokenFromDifferentKeyRejected() {
            JwtServiceImpl a = service(b64(32), ONE_HOUR);
            JwtServiceImpl b = service(Base64.getEncoder().encodeToString(new byte[32]), ONE_HOUR);
            String token = a.generateToken("a@b.com");
            assertThrows(SignatureException.class, () -> b.extractUsername(token));
        }

        @Test
        @DisplayName("an unsigned token with \"alg\":\"none\" is rejected, never accepted as valid")
        void algNoneRejected() {
            JwtServiceImpl s = service(b64(32), ONE_HOUR);
            long exp = System.currentTimeMillis() / 1000 + 3600;
            String unsigned = urlB64("{\"alg\":\"none\",\"typ\":\"JWT\"}") + "."
                    + urlB64("{\"sub\":\"admin@evil.com\",\"exp\":" + exp + "}") + ".";
            assertThrows(JwtException.class, () -> s.extractUsername(unsigned));
        }

        @Test
        @DisplayName("a valid token with its signature stripped (header.payload.) is rejected")
        void strippedSignatureRejected() {
            JwtServiceImpl s = service(b64(32), ONE_HOUR);
            String token = s.generateToken("a@b.com");
            String stripped = token.substring(0, token.lastIndexOf('.') + 1);
            assertThrows(JwtException.class, () -> s.extractUsername(stripped));
        }

        @Test
        @DisplayName("a valid token with its signature segment removed entirely (header.payload) is rejected")
        void missingSignatureSegmentRejected() {
            JwtServiceImpl s = service(b64(32), ONE_HOUR);
            String token = s.generateToken("a@b.com");
            String twoParts = token.substring(0, token.lastIndexOf('.'));
            assertThrows(JwtException.class, () -> s.extractUsername(twoParts));
        }

        @Test
        @DisplayName("empty string is rejected (IllegalArgumentException from the parser, which the "
                + "auth filter also catches)")
        void emptyTokenRejected() {
            JwtServiceImpl s = service(b64(32), ONE_HOUR);
            assertThrows(RuntimeException.class, () -> s.extractUsername(""));
        }

        @Test
        @DisplayName("isTokenValid on an expired token THROWS ExpiredJwtException rather than returning "
                + "false: the parser enforces exp before isTokenExpired is ever consulted")
        void expiredTokenThrowsFromIsTokenValid() {
            JwtServiceImpl s = service(b64(32), -1_000L);
            String token = s.generateToken("a@b.com");
            assertThrows(ExpiredJwtException.class,
                    () -> s.isTokenValid(token, user("a@b.com", true, true, true, true)));
        }
    }

    @Nested
    @DisplayName("isTokenValid — every UserDetails status flag")
    class StatusFlags {

        private final JwtServiceImpl s = service(b64(32), ONE_HOUR);
        private final String token = s.generateToken("a@b.com");

        @Test
        @DisplayName("all flags healthy -> true")
        void allHealthy() {
            assertTrue(s.isTokenValid(token, user("a@b.com", true, true, true, true)));
        }

        @Test
        @DisplayName("disabled -> false")
        void disabled() {
            assertFalse(s.isTokenValid(token, user("a@b.com", false, true, true, true)));
        }

        @Test
        @DisplayName("account expired -> false (this check was previously missing)")
        void accountExpired() {
            assertFalse(s.isTokenValid(token, user("a@b.com", true, false, true, true)));
        }

        @Test
        @DisplayName("credentials expired -> false")
        void credentialsExpired() {
            assertFalse(s.isTokenValid(token, user("a@b.com", true, true, false, true)));
        }

        @Test
        @DisplayName("locked -> false")
        void locked() {
            assertFalse(s.isTokenValid(token, user("a@b.com", true, true, true, false)));
        }

        @Test
        @DisplayName("username comparison is case-sensitive: A@B.com does not match a@b.com")
        void usernameCaseSensitive() {
            assertFalse(s.isTokenValid(token, user("A@B.com", true, true, true, true)));
        }

        @Test
        @DisplayName("a trailing space in the UserDetails username does not match")
        void usernameTrailingSpaceDoesNotMatch() {
            assertFalse(s.isTokenValid(token, user("a@b.com ", true, true, true, true)));
        }
    }

    @Nested
    @DisplayName("subject round-tripping")
    class SubjectRoundTrip {

        @Test
        @DisplayName("non-ASCII, plus-addressing and quote/backslash characters survive exactly")
        void unusualCharactersRoundTrip() {
            JwtServiceImpl s = service(b64(32), ONE_HOUR);
            String[] subjects = {
                    "u\u00fcser+tag@ex\u00e4mple.com",
                    "quote\"and\\backslash@x.com",
                    "\uD83C\uDF89@party.example",
                    "spaces in name@x.com",
            };
            for (String subject : subjects) {
                assertEquals(subject, s.extractUsername(s.generateToken(subject)), subject);
            }
        }

        @Test
        @DisplayName("a token issued in the past has iat <= now and exp = iat + configured duration (second precision)")
        void issuedAtAndExpiryRelationship() {
            JwtServiceImpl s = service(b64(32), ONE_HOUR);
            String token = s.generateToken("a@b.com");
            long expMs = s.extractExpiration(token).getTime();
            long iatMs = s.extractClaim(token, c -> c.getIssuedAt()).getTime();
            assertTrue(iatMs <= System.currentTimeMillis());
            assertEquals(ONE_HOUR / 1000, (expMs - iatMs) / 1000);
        }
    }
}
