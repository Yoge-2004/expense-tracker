package com.example.expensetracker.service;

/**
 * Handles the "forgot password" flow: issuing a one-time code to a
 * verified account email, and consuming that code to actually change
 * the password.
 *
 * <p>Replaces the previous behaviour where {@code /api/auth/reset-password}
 * changed a password given only an email address, with no proof the
 * requester controlled that inbox.</p>
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
}
