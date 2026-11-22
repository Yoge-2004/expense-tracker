package com.example.expensetracker.domain.user.service;

import com.example.expensetracker.domain.user.model.User;

/**
 * Service contract for dispatching authentication-related emails (OTP codes, password reset notices).
 * Decouples email composition and delivery protocols from core account security operations (SRP / DIP).
 *
 * @author Yogeshwaran
 */
public interface AuthEmailService {

    /**
     * Sends an authentication OTP email to the specified user for the given purpose.
     *
     * @param user recipient user entity
     * @param otp single-use verification code
     * @param purpose OTP purpose, such as "PASSWORD_RESET" or "SIGNUP"
     */
    void sendOtpEmail(User user, String otp, String purpose);

    /**
     * Builds safe, formatted HTML content for authentication OTP emails.
     *
     * @param recipientName name of the recipient (escaped against HTML injection)
     * @param otp single-use verification code
     * @param purpose OTP purpose
     * @return HTML formatted string
     */
    String buildOtpHtml(String recipientName, String otp, String purpose);
}
