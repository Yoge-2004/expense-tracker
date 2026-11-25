package com.example.expensetracker.domain.user.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.example.expensetracker.domain.user.model.User;
import java.lang.reflect.Method;
import java.util.Arrays;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Guards the rollback rules of the credential-check methods.
 *
 * <p>These methods record a failed attempt (attempt counters, lockout, spent OTP, consumed challenge) and then
 * signal the failure with an unchecked exception. Spring rolls a transaction back on any RuntimeException unless
 * told otherwise, so without {@code noRollbackFor} every one of those writes silently disappeared and brute-force
 * protection never engaged. A mock-based unit test cannot see that, so the annotation is asserted directly.</p>
 */
@DisplayName("Credential checks keep the failed-attempt writes")
class TransactionRollbackPolicyTest {

    private static Transactional tx(Class<?> type, String name, Class<?>... params) throws NoSuchMethodException {
        Method m = type.getMethod(name, params);
        Transactional t = m.getAnnotation(Transactional.class);
        assertNotNull(t, type.getSimpleName() + "." + name + " must declare its own @Transactional");
        return t;
    }

    private static boolean keepsWritesFor(Transactional t, Class<? extends Throwable> ex) {
        return Arrays.asList(t.noRollbackFor()).contains(ex);
    }

    @Test
    @DisplayName("password reset persists attempt counters and lockout when the code is wrong")
    void resetPasswordKeepsFailureWrites() throws Exception {
        Transactional t = tx(PasswordResetServiceImpl.class, "resetPassword", String.class, String.class, String.class);
        assertTrue(keepsWritesFor(t, BadCredentialsException.class));
        assertFalse(t.readOnly());
    }

    @Test
    @DisplayName("signup OTP verification persists attempts and the spent flag")
    void verifySignupOtpKeepsFailureWrites() throws Exception {
        Transactional t = tx(PasswordResetServiceImpl.class, "verifySignupOtp", String.class, String.class);
        assertTrue(keepsWritesFor(t, BadCredentialsException.class));
    }

    @Test
    @DisplayName("a failed WebAuthn ceremony still consumes its single-use challenge")
    void webAuthnCeremoniesKeepChallengeConsumption() throws Exception {
        assertTrue(keepsWritesFor(
                tx(WebAuthnServiceImpl.class, "finishRegistration", User.class, String.class, String.class),
                ResponseStatusException.class));
        assertTrue(keepsWritesFor(
                tx(WebAuthnServiceImpl.class, "finishAuthentication", String.class, String.class),
                ResponseStatusException.class));
    }

    @Test
    @DisplayName("passkey recovery verification is not read-only and keeps the consumed challenge")
    void recoveryVerificationCanWrite() throws Exception {
        Transactional t = tx(WebAuthnServiceImpl.class, "verifyAssertionForRecovery", String.class, String.class);
        assertFalse(t.readOnly(), "it deletes the challenge and advances the signature counter");
        assertTrue(keepsWritesFor(t, ResponseStatusException.class));
    }
}
