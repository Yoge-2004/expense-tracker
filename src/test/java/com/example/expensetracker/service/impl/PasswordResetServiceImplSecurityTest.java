package com.example.expensetracker.service.impl;

import com.example.expensetracker.model.PasswordResetOtp;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.PasswordResetOtpRepository;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.service.OtpDeliveryListener;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Security and boundary tests for {@link PasswordResetServiceImpl}, complementing
 * {@link PasswordResetServiceImplTest}. Three real defects motivated this suite:
 *
 * <ol>
 *   <li>{@code resetPassword} threw {@code NoSuchElementException} (a 404 echoing the
 *   address) for an unknown email but a 401 for a known email with a wrong code, so the
 *   public endpoint was an account-enumeration oracle even though {@code requestReset}
 *   was written to avoid exactly that.</li>
 *   <li>The recipient name was interpolated raw into the OTP email's HTML, and the
 *   public {@code /signup/send-otp} endpoint accepts any name, so anyone could send a
 *   victim a genuine email from this app's own sender containing attacker-chosen HTML.</li>
 *   <li>{@code sendSignupOtp} checked registration with an exact-match lookup while
 *   {@code registerUser} rejects duplicates case-insensitively.</li>
 * </ol>
 *
 * <p>Time-based boundaries use margins of a full minute either side rather than exact
 * equality: the service reads {@code LocalDateTime.now()} directly (there is no
 * injectable Clock), so "expires exactly now" cannot be pinned deterministically.</p>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("PasswordResetServiceImpl — security and boundaries")
class PasswordResetServiceImplSecurityTest {

    @Mock private UserRepository userRepository;
    @Mock private PasswordResetOtpRepository otpRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private ObjectProvider<JavaMailSender> mailSenderProvider;
    @Mock private ObjectProvider<OtpDeliveryListener> otpDeliveryListenerProvider;

    private PasswordResetServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new PasswordResetServiceImpl(
                userRepository, otpRepository, passwordEncoder,
                mailSenderProvider, otpDeliveryListenerProvider);
    }

    private static User user(String email, int failedAttempts) {
        User u = new User();
        u.setEmail(email);
        u.setFailedPinAttempts(failedAttempts);
        return u;
    }

    private static PasswordResetOtp otp(String email, String hash, LocalDateTime expiresAt, int attempts) {
        PasswordResetOtp r = new PasswordResetOtp();
        r.setEmail(email);
        r.setOtpHash(hash);
        r.setExpiresAt(expiresAt);
        r.setAttempts(attempts);
        return r;
    }

    private static int occurrences(String haystack, String needle) {
        int count = 0;
        for (int i = haystack.indexOf(needle); i >= 0; i = haystack.indexOf(needle, i + needle.length())) {
            count++;
        }
        return count;
    }

    // ------------------------------------------------------------------------------------

    @Nested
    @DisplayName("resetPassword: an unknown email must be indistinguishable from a wrong code")
    class Enumeration {

        @Test
        @DisplayName("unknown email and known-email-wrong-code throw the same type with the same message")
        void unknownEmailMatchesWrongCode() {
            when(userRepository.findByEmailIgnoreCase("ghost@example.com")).thenReturn(Optional.empty());
            BadCredentialsException unknown = assertThrows(BadCredentialsException.class,
                    () -> service.resetPassword("ghost@example.com", "123456", "newpassword"));

            when(userRepository.findByEmailIgnoreCase("real@example.com"))
                    .thenReturn(Optional.of(user("real@example.com", 0)));
            BadCredentialsException wrongCode = assertThrows(BadCredentialsException.class,
                    () -> service.resetPassword("real@example.com", "123456", "newpassword"));

            assertEquals(wrongCode.getMessage(), unknown.getMessage());
            assertEquals("Invalid verification code or Security PIN.", unknown.getMessage());
        }

        @Test
        @DisplayName("the failure message never echoes the address that was submitted")
        void messageDoesNotEchoEmail() {
            when(userRepository.findByEmailIgnoreCase("ghost@example.com")).thenReturn(Optional.empty());
            BadCredentialsException ex = assertThrows(BadCredentialsException.class,
                    () -> service.resetPassword("ghost@example.com", "123456", "newpassword"));
            assertFalse(ex.getMessage().contains("ghost"), ex.getMessage());
            assertFalse(ex.getMessage().contains("@"), ex.getMessage());
        }

        @Test
        @DisplayName("an unknown email writes nothing: no OTP lookup and no user save")
        void unknownEmailWritesNothing() {
            when(userRepository.findByEmailIgnoreCase("ghost@example.com")).thenReturn(Optional.empty());
            assertThrows(BadCredentialsException.class,
                    () -> service.resetPassword("ghost@example.com", "123456", "newpassword"));
            verifyNoInteractions(otpRepository);
            verify(userRepository, never()).save(any());
        }

        @Test
        @DisplayName("surrounding whitespace (including a newline) is trimmed before the account lookup")
        void emailTrimmedBeforeLookup() {
            when(userRepository.findByEmailIgnoreCase("ghost@example.com")).thenReturn(Optional.empty());
            assertThrows(BadCredentialsException.class,
                    () -> service.resetPassword("  ghost@example.com \n", "123456", "newpassword"));
            verify(userRepository).findByEmailIgnoreCase("ghost@example.com");
        }
    }

    @Nested
    @DisplayName("resetPassword: input validation and the legacy BYPASS token")
    class Validation {

        @Test
        @DisplayName("BYPASS is rejected in any case and with any padding, before any repository is touched")
        void bypassRejectedBeforeAnyLookup() {
            for (String token : new String[]{"BYPASS", "bypass", "ByPaSs", "  BYPASS  ", "\tbypass\n"}) {
                assertThrows(BadCredentialsException.class,
                        () -> service.resetPassword("a@b.com", token, "newpassword"), "token=[" + token + "]");
            }
            verifyNoInteractions(userRepository, otpRepository);
        }

        @Test
        @DisplayName("a code that merely CONTAINS 'bypass' is not treated as the BYPASS token")
        void bypassIsAnExactMatchNotASubstring() {
            when(userRepository.findByEmailIgnoreCase("a@b.com")).thenReturn(Optional.empty());
            // Reaches the account lookup (so it was not short-circuited as BYPASS) and then fails as unknown.
            assertThrows(BadCredentialsException.class,
                    () -> service.resetPassword("a@b.com", "bypass1", "newpassword"));
            verify(userRepository).findByEmailIgnoreCase("a@b.com");
        }

        @Test
        @DisplayName("password length boundary: 5 characters is rejected, 6 proceeds to the account lookup")
        void passwordLengthBoundary() {
            assertThrows(IllegalArgumentException.class,
                    () -> service.resetPassword("ghost@example.com", "123456", "12345"));
            verifyNoInteractions(userRepository);

            when(userRepository.findByEmailIgnoreCase("ghost@example.com")).thenReturn(Optional.empty());
            assertThrows(BadCredentialsException.class,
                    () -> service.resetPassword("ghost@example.com", "123456", "123456"));
            verify(userRepository).findByEmailIgnoreCase("ghost@example.com");
        }

        @Test
        @DisplayName("null and blank values for each of the three arguments are all rejected up front")
        void nullAndBlankArgumentsRejected() {
            String[][] cases = {
                    {null, "123456", "newpassword"}, {"", "123456", "newpassword"}, {"  ", "123456", "newpassword"},
                    {"a@b.com", null, "newpassword"}, {"a@b.com", "", "newpassword"}, {"a@b.com", "  ", "newpassword"},
                    {"a@b.com", "123456", null}, {"a@b.com", "123456", ""}, {"a@b.com", "123456", "   "},
            };
            for (String[] c : cases) {
                assertThrows(IllegalArgumentException.class,
                        () -> service.resetPassword(c[0], c[1], c[2]),
                        "args=" + java.util.Arrays.toString(c));
            }
            verifyNoInteractions(userRepository, otpRepository);
        }
    }

    @Nested
    @DisplayName("resetPassword: email-OTP attempt and expiry boundaries")
    class ResetOtpBoundaries {

        private static final String KEY = "u@example.com";

        private void stubRecord(User user, PasswordResetOtp record) {
            when(userRepository.findByEmailIgnoreCase(KEY)).thenReturn(Optional.of(user));
            when(otpRepository.findFirstByEmailAndPurposeAndUsedFalseOrderByCreatedAtDesc(KEY, "PASSWORD_RESET"))
                    .thenReturn(Optional.of(record));
        }

        @Test
        @DisplayName("4 prior attempts + wrong code: counted as the 5th, saved, OTP still unused")
        void fourPriorAttemptsWrongCode() {
            User u = user(KEY, 0);
            PasswordResetOtp rec = otp(KEY, "HASH", LocalDateTime.now().plusMinutes(5), 4);
            stubRecord(u, rec);
            when(passwordEncoder.matches("000000", "HASH")).thenReturn(false);

            assertThrows(BadCredentialsException.class, () -> service.resetPassword(KEY, "000000", "newpassword"));

            assertEquals(5, rec.getAttempts());
            assertFalse(rec.isUsed());
            verify(otpRepository).save(rec);
            assertEquals(1, u.getFailedPinAttempts());
        }

        @Test
        @DisplayName("4 prior attempts + CORRECT code: the 5th attempt is still honoured")
        void fourPriorAttemptsCorrectCode() {
            User u = user(KEY, 0);
            PasswordResetOtp rec = otp(KEY, "HASH", LocalDateTime.now().plusMinutes(5), 4);
            stubRecord(u, rec);
            when(passwordEncoder.matches("123456", "HASH")).thenReturn(true);
            when(passwordEncoder.encode("newpassword")).thenReturn("ENC");

            assertDoesNotThrow(() -> service.resetPassword(KEY, "123456", "newpassword"));
            assertTrue(rec.isUsed());
            assertEquals("ENC", u.getPassword());
        }

        @Test
        @DisplayName("5 prior attempts: even the correct code is refused WITHOUT being compared")
        void fivePriorAttemptsRefusedWithoutComparing() {
            User u = user(KEY, 0);
            PasswordResetOtp rec = otp(KEY, "HASH", LocalDateTime.now().plusMinutes(5), 5);
            stubRecord(u, rec);

            assertThrows(BadCredentialsException.class, () -> service.resetPassword(KEY, "123456", "newpassword"));

            verify(passwordEncoder, never()).matches(any(), any());
            verify(otpRepository, never()).save(any());
            assertEquals(5, rec.getAttempts());
            assertEquals(1, u.getFailedPinAttempts());
        }

        @Test
        @DisplayName("an expired OTP (1 minute ago) is refused without being compared")
        void expiredOtpRefusedWithoutComparing() {
            User u = user(KEY, 0);
            PasswordResetOtp rec = otp(KEY, "HASH", LocalDateTime.now().minusMinutes(1), 0);
            stubRecord(u, rec);

            assertThrows(BadCredentialsException.class, () -> service.resetPassword(KEY, "123456", "newpassword"));

            verify(passwordEncoder, never()).matches(any(), any());
            assertFalse(rec.isUsed());
        }

        @Test
        @DisplayName("success resets the failure counter, clears any lock, uses up the OTP and stores the new hash")
        void successClearsCountersAndUsesOtp() {
            User u = user(KEY, 3);
            u.setPinLockedUntil(LocalDateTime.now().minusMinutes(1));
            PasswordResetOtp rec = otp(KEY, "HASH", LocalDateTime.now().plusMinutes(5), 0);
            stubRecord(u, rec);
            when(passwordEncoder.matches("123456", "HASH")).thenReturn(true);
            when(passwordEncoder.encode("newpassword")).thenReturn("ENC");

            service.resetPassword(KEY, "  123456  ", "newpassword");

            assertTrue(rec.isUsed());
            assertEquals(0, u.getFailedPinAttempts());
            assertNull(u.getPinLockedUntil());
            assertEquals("ENC", u.getPassword());
            verify(otpRepository).save(rec);
            verify(userRepository).save(u);
        }
    }

    @Nested
    @DisplayName("resetPassword: recovery lockout after repeated failures")
    class Lockout {

        private static final String KEY = "u@example.com";

        @Test
        @DisplayName("the 5th consecutive failure locks recovery for 15 minutes")
        void fifthFailureLocksForFifteenMinutes() {
            User u = user(KEY, 4);
            when(userRepository.findByEmailIgnoreCase(KEY)).thenReturn(Optional.of(u));

            LocalDateTime before = LocalDateTime.now();
            assertThrows(BadCredentialsException.class, () -> service.resetPassword(KEY, "000000", "newpassword"));
            LocalDateTime after = LocalDateTime.now();

            assertEquals(5, u.getFailedPinAttempts());
            assertNotNull(u.getPinLockedUntil());
            assertFalse(u.getPinLockedUntil().isBefore(before.plusMinutes(15)));
            assertFalse(u.getPinLockedUntil().isAfter(after.plusMinutes(15)));
        }

        @Test
        @DisplayName("the 4th failure counts but does NOT lock")
        void fourthFailureDoesNotLock() {
            User u = user(KEY, 3);
            when(userRepository.findByEmailIgnoreCase(KEY)).thenReturn(Optional.of(u));

            assertThrows(BadCredentialsException.class, () -> service.resetPassword(KEY, "000000", "newpassword"));

            assertEquals(4, u.getFailedPinAttempts());
            assertNull(u.getPinLockedUntil());
        }
    }

    @Nested
    @DisplayName("sendSignupOtp")
    class SendSignupOtp {

        @Test
        @DisplayName("registration is checked trimmed and case-insensitively, and nothing is sent when it exists")
        void alreadyRegisteredMatchedCaseInsensitively() {
            when(userRepository.existsByEmailIgnoreCase("User@Example.com")).thenReturn(true);

            assertFalse(service.sendSignupOtp("  User@Example.com  ", "Someone"));

            verifyNoInteractions(otpRepository);
            verify(otpDeliveryListenerProvider, never()).getIfAvailable();
        }

        @Test
        @DisplayName("the OTP row is keyed on the trimmed, lower-cased address; the code is a 6-digit number")
        void storedUnderNormalisedKey() {
            when(passwordEncoder.encode(anyString())).thenReturn("HASHED");

            assertTrue(service.sendSignupOtp("  New.User@Example.COM ", "New User"));

            verify(otpRepository).findFirstByEmailAndPurposeAndUsedFalseOrderByCreatedAtDesc(
                    "new.user@example.com", "SIGNUP");
            ArgumentCaptor<PasswordResetOtp> saved = ArgumentCaptor.forClass(PasswordResetOtp.class);
            verify(otpRepository).save(saved.capture());
            assertEquals("new.user@example.com", saved.getValue().getEmail());
            assertEquals("SIGNUP", saved.getValue().getPurpose());
            assertEquals("HASHED", saved.getValue().getOtpHash());

            ArgumentCaptor<String> plain = ArgumentCaptor.forClass(String.class);
            verify(passwordEncoder).encode(plain.capture());
            assertTrue(plain.getValue().matches("[1-9][0-9]{5}"),
                    "expected a 6-digit code with no leading zero, got: " + plain.getValue());
        }

        @Test
        @DisplayName("the stored OTP expires roughly 10 minutes out")
        void otpExpiresAboutTenMinutesOut() {
            when(passwordEncoder.encode(anyString())).thenReturn("HASHED");
            LocalDateTime before = LocalDateTime.now();

            service.sendSignupOtp("new@example.com", "N");

            ArgumentCaptor<PasswordResetOtp> saved = ArgumentCaptor.forClass(PasswordResetOtp.class);
            verify(otpRepository).save(saved.capture());
            LocalDateTime expiry = saved.getValue().getExpiresAt();
            assertFalse(expiry.isBefore(before.plusMinutes(10)));
            assertFalse(expiry.isAfter(LocalDateTime.now().plusMinutes(10)));
        }

        @Test
        @DisplayName("a previous unused OTP for the same address is invalidated, then the new one is saved")
        void previousOtpInvalidated() {
            PasswordResetOtp previous = otp("new@example.com", "OLD", LocalDateTime.now().plusMinutes(5), 2);
            when(otpRepository.findFirstByEmailAndPurposeAndUsedFalseOrderByCreatedAtDesc("new@example.com", "SIGNUP"))
                    .thenReturn(Optional.of(previous));
            when(passwordEncoder.encode(anyString())).thenReturn("NEW");

            assertTrue(service.sendSignupOtp("new@example.com", "N"));

            assertTrue(previous.isUsed());
            verify(otpRepository).save(previous);
            verify(otpRepository, times(2)).save(any(PasswordResetOtp.class));
        }

        @Test
        @DisplayName("null and blank emails are rejected")
        void nullAndBlankRejected() {
            assertThrows(IllegalArgumentException.class, () -> service.sendSignupOtp(null, "N"));
            assertThrows(IllegalArgumentException.class, () -> service.sendSignupOtp("", "N"));
            assertThrows(IllegalArgumentException.class, () -> service.sendSignupOtp("   ", "N"));
            verifyNoInteractions(userRepository, otpRepository);
        }
    }

    @Nested
    @DisplayName("verifySignupOtp")
    class VerifySignupOtp {

        private static final String KEY = "user@example.com";

        private PasswordResetOtp stubActive(int attempts, LocalDateTime expiresAt) {
            PasswordResetOtp rec = otp(KEY, "HASH", expiresAt, attempts);
            when(otpRepository.findFirstByEmailAndPurposeAndUsedFalseOrderByCreatedAtDesc(KEY, "SIGNUP"))
                    .thenReturn(Optional.of(rec));
            return rec;
        }

        @Test
        @DisplayName("a correct code marks the OTP used and saves it")
        void correctCodeSucceeds() {
            PasswordResetOtp rec = stubActive(0, LocalDateTime.now().plusMinutes(5));
            when(passwordEncoder.matches("123456", "HASH")).thenReturn(true);

            assertDoesNotThrow(() -> service.verifySignupOtp(KEY, "123456"));

            assertTrue(rec.isUsed());
            verify(otpRepository).save(rec);
        }

        @Test
        @DisplayName("the address is looked up trimmed and lower-cased, and the code is compared trimmed")
        void lookupAndCodeAreNormalised() {
            PasswordResetOtp rec = stubActive(0, LocalDateTime.now().plusMinutes(5));
            when(passwordEncoder.matches("123456", "HASH")).thenReturn(true);

            assertDoesNotThrow(() -> service.verifySignupOtp("  USER@Example.COM ", " 123456 "));
            assertTrue(rec.isUsed());
        }

        @Test
        @DisplayName("null email, null code and blank code are rejected without touching the repository")
        void missingParametersRejected() {
            assertThrows(BadCredentialsException.class, () -> service.verifySignupOtp(null, "123456"));
            assertThrows(BadCredentialsException.class, () -> service.verifySignupOtp(KEY, null));
            assertThrows(BadCredentialsException.class, () -> service.verifySignupOtp(KEY, "   "));
            verifyNoInteractions(otpRepository);
        }

        @Test
        @DisplayName("no active OTP for the address -> generic 'invalid or expired'")
        void noActiveOtp() {
            BadCredentialsException ex = assertThrows(BadCredentialsException.class,
                    () -> service.verifySignupOtp(KEY, "123456"));
            assertEquals("Invalid or expired verification code.", ex.getMessage());
        }

        @Test
        @DisplayName("an expired OTP is burned (marked used) and refused without being compared")
        void expiredOtpBurned() {
            PasswordResetOtp rec = stubActive(0, LocalDateTime.now().minusMinutes(1));

            BadCredentialsException ex = assertThrows(BadCredentialsException.class,
                    () -> service.verifySignupOtp(KEY, "123456"));

            assertTrue(ex.getMessage().contains("expired"), ex.getMessage());
            assertTrue(rec.isUsed());
            verify(otpRepository).save(rec);
            verify(passwordEncoder, never()).matches(any(), any());
        }

        @Test
        @DisplayName("5 prior attempts: burned and refused without being compared, even for the right code")
        void fivePriorAttemptsBurned() {
            PasswordResetOtp rec = stubActive(5, LocalDateTime.now().plusMinutes(5));

            BadCredentialsException ex = assertThrows(BadCredentialsException.class,
                    () -> service.verifySignupOtp(KEY, "123456"));

            assertTrue(ex.getMessage().contains("Too many incorrect attempts"), ex.getMessage());
            assertTrue(rec.isUsed());
            verify(passwordEncoder, never()).matches(any(), any());
        }

        @Test
        @DisplayName("4 prior attempts + wrong code: counted as the 5th, OTP still unused")
        void fourPriorAttemptsWrongCode() {
            PasswordResetOtp rec = stubActive(4, LocalDateTime.now().plusMinutes(5));
            when(passwordEncoder.matches("000000", "HASH")).thenReturn(false);

            BadCredentialsException ex = assertThrows(BadCredentialsException.class,
                    () -> service.verifySignupOtp(KEY, "000000"));

            assertEquals("Invalid verification code.", ex.getMessage());
            assertEquals(5, rec.getAttempts());
            assertFalse(rec.isUsed());
            verify(otpRepository).save(rec);
        }

        @Test
        @DisplayName("4 prior attempts + CORRECT code: the 5th attempt is still honoured")
        void fourPriorAttemptsCorrectCode() {
            PasswordResetOtp rec = stubActive(4, LocalDateTime.now().plusMinutes(5));
            when(passwordEncoder.matches("123456", "HASH")).thenReturn(true);

            assertDoesNotThrow(() -> service.verifySignupOtp(KEY, "123456"));
            assertTrue(rec.isUsed());
        }
    }

    @Nested
    @DisplayName("buildOtpHtml — the recipient name is attacker-controlled and must be escaped")
    class OtpHtml {

        private String html(String name) {
            return service.buildOtpHtml(name, "123456", "SIGNUP");
        }

        @Test
        @DisplayName("a <script> tag in the name is escaped, never emitted")
        void scriptTagEscaped() {
            String out = html("<script>alert(1)</script>");
            assertTrue(out.contains("Hello &lt;script&gt;alert(1)&lt;/script&gt;,"), out);
            assertFalse(out.contains("<script"), out);
        }

        @Test
        @DisplayName("an injected phishing link is neutralised: no live <a href> comes from the name")
        void injectedLinkNeutralised() {
            String out = html("<a href=\"https://evil.example/verify\">Click here</a>");
            assertFalse(out.contains("<a href"), out);
            assertTrue(out.contains("&lt;a href=&quot;https://evil.example/verify&quot;&gt;Click here&lt;/a&gt;"), out);
        }

        @Test
        @DisplayName("an injected <img onerror> is neutralised")
        void injectedImageNeutralised() {
            String out = html("<img src=x onerror=alert(1)>");
            assertFalse(out.contains("<img"), out);
            assertTrue(out.contains("&lt;img src=x onerror=alert(1)&gt;"), out);
        }

        @Test
        @DisplayName("ampersands are escaped exactly once: '&' -> '&amp;', and '&lt;' -> '&amp;lt;' (never re-interpreted)")
        void ampersandEscapedOnce() {
            assertTrue(html("Tom & Jerry").contains("Hello Tom &amp; Jerry,"));
            assertTrue(html("&lt;b&gt;").contains("Hello &amp;lt;b&amp;gt;,"));
        }

        @Test
        @DisplayName("double quote and apostrophe are escaped")
        void quotesEscaped() {
            assertTrue(html("O'Brien \"Bob\"").contains("Hello O&#39;Brien &quot;Bob&quot;,"));
        }

        @Test
        @DisplayName("ordinary names, including non-ASCII scripts and emoji, pass through unchanged")
        void ordinaryNamesUnchanged() {
            for (String name : new String[]{"Yogeshwaran M", "Jos\u00e9 M\u00fcller",
                    "\u0BAF\u0BCB\u0B95\u0BC7\u0BB7\u0BCD\u0BB5\u0BB0\u0BA9\u0BCD", "\uD83C\uDF89 Party"}) {
                assertTrue(html(name).contains("Hello " + name + ","), name);
            }
        }

        @Test
        @DisplayName("a null name falls back to 'there'")
        void nullNameFallsBack() {
            assertTrue(html(null).contains("Hello there,"));
        }

        @Test
        @DisplayName("format specifiers inside the name are literal text, not interpreted by String.formatted")
        void formatSpecifiersAreLiteral() {
            assertTrue(html("50% off %s %n").contains("Hello 50% off %s %n,"));
        }

        @Test
        @DisplayName("a hostile name changes ONLY the name slot: with the name removed, the rest of the "
                + "document is byte-identical to a benign render")
        void onlyTheNameSlotChanges() {
            String hostile = "<img src=x onerror=alert(1)>";
            String escaped = "&lt;img src=x onerror=alert(1)&gt;";
            String benign = html("@@NAME@@");
            String attacked = html(hostile);
            assertEquals(benign.replace("@@NAME@@", ""), attacked.replace(escaped, ""));
        }

        @Test
        @DisplayName("the code appears exactly once and the headline matches the purpose")
        void codeAndHeadline() {
            String signup = service.buildOtpHtml("A", "123456", "SIGNUP");
            assertEquals(1, occurrences(signup, "123456"));
            assertTrue(signup.contains("Confirm Your Email Address"));
            assertFalse(signup.contains("Password Reset Verification"));

            String reset = service.buildOtpHtml("A", "654321", "PASSWORD_RESET");
            assertEquals(1, occurrences(reset, "654321"));
            assertTrue(reset.contains("Password Reset Verification"));
            assertFalse(reset.contains("Confirm Your Email Address"));
        }

        @Test
        @DisplayName("the trusted template markup (<b>, <h2>) is left intact — only the name is escaped")
        void trustedMarkupNotEscaped() {
            String out = html("A");
            assertTrue(out.contains("<b>10 minutes</b>"), out);
            assertTrue(out.contains("<h2 style="), out);
        }
    }
}
