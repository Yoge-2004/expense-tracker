package com.example.expensetracker.service;

/**
 * Observation hook fired whenever a password-reset OTP is issued.
 *
 * <p>This exists purely to make the OTP flow testable end-to-end without
 * weakening it: production code has no bean implementing this interface, so
 * {@link org.springframework.beans.factory.ObjectProvider#getIfAvailable()}
 * simply returns {@code null} and nothing happens. Only a test-profile bean
 * (see the Cucumber test support package) implements it, to let integration
 * tests read back the code they need to submit — without ever storing or
 * logging the plaintext OTP in production.</p>
 */
public interface OtpDeliveryListener {
    void onOtpIssued(String email, String otp);
}
