package com.example.expensetracker.service;

/**
 * Handles OTP flows for both the "forgot password" and email-verified
 * signup flows.
 *
 * <p>Each OTP is keyed by {@code (email, purpose)} so codes for different
 * flows never collide. Supported purpose values are {@code "PASSWORD_RESET"}
 * and {@code "SIGNUP"}.</p>
 */
public interface PasswordResetService {

    /**
     * Issues a 6-digit OTP for the given email if an account exists for it,
     * and emails it to that address. Always completes silently (no error,
     * no indication either way) if no account exists, so this endpoint can't
     * be used to enumerate registered emails.
     *
     * @param email the account email requesting a reset code
     */
    void requestReset(String email);

    /**
     * Verifies a submitted OTP for an email and, if valid and unexpired,
     * updates the account's password.
     *
     * @param email       the account email
     * @param otp         the 6-digit code the user received by email
     * @param newPassword the new plain-text password to set (BCrypt-encoded before storage)
     * @throws org.springframework.security.authentication.BadCredentialsException
     *         if there is no matching, unexpired, unused OTP, or too many attempts have been made
     */
    void resetPassword(String email, String otp, String newPassword);

    /**
     * Issues a 6-digit signup verification OTP to the given email address.
     * Unlike the password-reset variant this deliberately reveals whether the
     * email is already registered (returning {@code false}) so the UI can
     * display a "this email is already in use" message without a round-trip
     * to register.
     *
     * @param email     the prospective user's email address
     * @param name      the prospective user's display name (used in the email body)
     * @return {@code true} if the OTP was issued, {@code false} if the email is already registered
     */
    boolean sendSignupOtp(String email, String name);

    /**
     * Verifies a signup OTP. Returns silently if valid; throws
     * {@link org.springframework.security.authentication.BadCredentialsException}
     * if the code is missing, expired, already used, or too many attempts were made.
     *
     * @param email the email address the OTP was sent to
     * @param otp   the 6-digit code the user entered
     * @throws org.springframework.security.authentication.BadCredentialsException on failure
     */
    void verifySignupOtp(String email, String otp);
}

