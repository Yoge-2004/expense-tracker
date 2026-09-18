package com.example.expensetracker.service.impl;

import com.example.expensetracker.exception.EmailDeliveryException;
import com.example.expensetracker.logging.LoggingUtils;
import com.example.expensetracker.model.PasswordResetOtp;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.PasswordResetOtpRepository;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.service.OtpDeliveryListener;
import com.example.expensetracker.service.PasswordResetService;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.NoSuchElementException;
import java.util.Optional;

/**
 * Implements {@link PasswordResetService} — see that interface for the
 * public contract. This class documents implementation-specific behaviour
 * the interface doesn't cover:
 *
 * <ul>
 *   <li><b>Rate limiting &amp; expiry:</b> each OTP is valid for {@value
 *   #OTP_TTL_MINUTES} minutes and allows at most {@value #MAX_ATTEMPTS}
 *   verification attempts before being rejected outright, even if the
 *   correct code is later supplied.</li>
 *   <li><b>Zero-Email Recovery via 6-Digit Security PIN:</b> users can recover
 *   their account directly using their 6-digit Security PIN without requiring
 *   external SMTP/email delivery. Includes brute-force lockout protection (5 attempts).</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PasswordResetServiceImpl implements PasswordResetService {

    private static final int OTP_TTL_MINUTES = 10;
    private static final int MAX_ATTEMPTS = 5;

    private final UserRepository userRepository;
    private final PasswordResetOtpRepository otpRepository;
    private final PasswordEncoder passwordEncoder;
    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final ObjectProvider<OtpDeliveryListener> otpDeliveryListenerProvider;
    private final SecureRandom random = new SecureRandom();

    @Value("${spring.mail.host:}")
    private String configuredMailHost;

    @Value("${app.mail.enabled:false}")
    private boolean mailEnabled;

    @Override
    @Transactional
    public void requestReset(String email) {
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("Email address is required.");
        }

        User user = userRepository.findByEmailIgnoreCase(email.trim())
                .orElse(null);

        if (user == null) {
            log.info("Password reset requested for non-existent email: {}", LoggingUtils.maskEmail(email));
            return;
        }

        log.info("Generating password reset OTP for email={}", LoggingUtils.maskEmail(email));

        otpRepository.findFirstByEmailAndPurposeAndUsedFalseOrderByCreatedAtDesc(user.getEmail(), "PASSWORD_RESET")
                .ifPresent(existing -> {
                    existing.setUsed(true);
                    otpRepository.save(existing);
                });

        String otp = generateOtp();

        PasswordResetOtp record = new PasswordResetOtp();
        record.setEmail(user.getEmail());
        record.setPurpose("PASSWORD_RESET");
        record.setOtpHash(passwordEncoder.encode(otp));
        record.setExpiresAt(LocalDateTime.now().plusMinutes(OTP_TTL_MINUTES));
        otpRepository.save(record);

        sendOtpEmail(user, otp, "PASSWORD_RESET");
    }

    @Override
    @Transactional
    public void resetPassword(String email, String otp, String newPassword) {
        if (email == null || otp == null || newPassword == null
                || email.isBlank() || otp.isBlank() || newPassword.isBlank()) {
            throw new IllegalArgumentException("Email, verification code, and new password are required.");
        }

        if (newPassword.length() < 6) {
            throw new IllegalArgumentException("New password must be at least 6 characters long.");
        }

        if ("BYPASS".equalsIgnoreCase(otp.trim())) {
            log.warn("Security violation: Rejected deprecated BYPASS token attempt for email={}",
                    LoggingUtils.maskEmail(email));
            throw new BadCredentialsException("Invalid verification code or Security PIN.");
        }

        User user = userRepository.findByEmailIgnoreCase(email.trim())
                .orElseThrow(() -> new NoSuchElementException(
                        "No account found with email address: " + email.trim()));

        if (user.getPinLockedUntil() != null && user.getPinLockedUntil().isAfter(LocalDateTime.now())) {
            long minutesRemaining = ChronoUnit.MINUTES.between(
                    LocalDateTime.now().atZone(ZoneId.systemDefault()),
                    user.getPinLockedUntil().atZone(ZoneId.systemDefault())) + 1;
            log.warn("Recovery attempt blocked for locked account email={}; minutesRemaining={}",
                    LoggingUtils.maskEmail(email), minutesRemaining);
            throw new BadCredentialsException(
                    "Account recovery temporarily locked due to too many failed attempts. Please try again in "
                    + minutesRemaining + " minute(s).");
        }

        String inputCode = otp.trim();
        boolean verified = false;

        if (user.getSecurityPinHash() != null && passwordEncoder.matches(inputCode, user.getSecurityPinHash())) {
            verified = true;
            user.setFailedPinAttempts(0);
            user.setPinLockedUntil(null);
            log.info("Password reset authorized via 6-digit Security PIN for email={}",
                    LoggingUtils.maskEmail(email));
        }

        if (!verified) {
            Optional<PasswordResetOtp> recordOpt =
                    otpRepository.findFirstByEmailAndPurposeAndUsedFalseOrderByCreatedAtDesc(
                            user.getEmail(), "PASSWORD_RESET");
            if (recordOpt.isPresent()) {
                PasswordResetOtp record = recordOpt.get();
                if (!record.getExpiresAt().isBefore(LocalDateTime.now()) && record.getAttempts() < MAX_ATTEMPTS) {
                    if (passwordEncoder.matches(inputCode, record.getOtpHash())) {
                        verified = true;
                        record.setUsed(true);
                        otpRepository.save(record);
                        user.setFailedPinAttempts(0);
                        user.setPinLockedUntil(null);
                        log.info("Password reset authorized via Email OTP for email={}",
                                LoggingUtils.maskEmail(email));
                    } else {
                        record.setAttempts(record.getAttempts() + 1);
                        otpRepository.save(record);
                    }
                }
            }
        }

        if (!verified) {
            int failed = user.getFailedPinAttempts() + 1;
            user.setFailedPinAttempts(failed);
            if (failed >= 5) {
                user.setPinLockedUntil(LocalDateTime.now().plusMinutes(15));
                log.warn("Account recovery locked for 15 minutes due to 5 consecutive failed attempts for email={}",
                        LoggingUtils.maskEmail(email));
            }
            userRepository.save(user);
            throw new BadCredentialsException("Invalid verification code or Security PIN.");
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        log.info("Password reset successfully applied for email={}", LoggingUtils.maskEmail(email));
    }

    @Override
    @Transactional
    public boolean sendSignupOtp(String email, String name) {
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("Email address is required.");
        }

        if (userRepository.existsByEmail(email)) {
            log.info("Signup OTP skipped: email already registered: {}", LoggingUtils.maskEmail(email));
            return false;
        }

        log.info("Generating signup OTP for email={}", LoggingUtils.maskEmail(email));

        otpRepository.findFirstByEmailAndPurposeAndUsedFalseOrderByCreatedAtDesc(email, "SIGNUP")
                .ifPresent(existing -> {
                    existing.setUsed(true);
                    otpRepository.save(existing);
                });

        String otp = generateOtp();

        PasswordResetOtp record = new PasswordResetOtp();
        record.setEmail(email);
        record.setPurpose("SIGNUP");
        record.setOtpHash(passwordEncoder.encode(otp));
        record.setExpiresAt(LocalDateTime.now().plusMinutes(OTP_TTL_MINUTES));
        otpRepository.save(record);

        User tempUser = new User();
        tempUser.setName(name != null && !name.isBlank() ? name : email);
        tempUser.setEmail(email);
        sendOtpEmail(tempUser, otp, "SIGNUP");
        return true;
    }

    @Override
    @Transactional
    public void verifySignupOtp(String email, String otp) {
        if (email == null || otp == null || otp.isBlank()) {
            log.warn("Signup OTP verification rejected: missing parameters");
            throw new BadCredentialsException("Invalid or expired code.");
        }

        PasswordResetOtp record = otpRepository
                .findFirstByEmailAndPurposeAndUsedFalseOrderByCreatedAtDesc(email, "SIGNUP")
                .orElseThrow(() -> {
                    log.warn("Signup OTP verification failed: no active OTP found for email={}",
                            LoggingUtils.maskEmail(email));
                    return new BadCredentialsException("Invalid or expired verification code.");
                });

        if (record.getExpiresAt().isBefore(LocalDateTime.now())) {
            record.setUsed(true);
            otpRepository.save(record);
            log.warn("Signup OTP verification failed: expired for email={}", LoggingUtils.maskEmail(email));
            throw new BadCredentialsException("Verification code has expired. Please request a new one.");
        }

        if (record.getAttempts() >= MAX_ATTEMPTS) {
            record.setUsed(true);
            otpRepository.save(record);
            log.warn("Signup OTP verification failed: max attempts exceeded for email={}",
                    LoggingUtils.maskEmail(email));
            throw new BadCredentialsException("Too many incorrect attempts. Please request a new verification code.");
        }

        if (!passwordEncoder.matches(otp, record.getOtpHash())) {
            record.setAttempts(record.getAttempts() + 1);
            otpRepository.save(record);
            log.warn("Signup OTP verification failed: incorrect OTP for email={}, attempt={}",
                    LoggingUtils.maskEmail(email), record.getAttempts());
            throw new BadCredentialsException("Invalid verification code.");
        }

        record.setUsed(true);
        otpRepository.save(record);
        log.info("Signup OTP verified successfully for email={}", LoggingUtils.maskEmail(email));
    }

    private String generateOtp() {
        int code = 100000 + random.nextInt(900000);
        return String.valueOf(code);
    }

    private void sendOtpEmail(User user, String otp, String purpose) {
        OtpDeliveryListener listener = otpDeliveryListenerProvider.getIfAvailable();
        if (listener != null) {
            listener.onOtpIssued(user.getEmail(), otp);
        }

        if (!mailEnabled || configuredMailHost == null || configuredMailHost.isBlank()) {
            log.info("[Email Delivery Disabled] Generated {} OTP for email={} (delivery simulated/disabled)",
                    purpose, LoggingUtils.maskEmail(user.getEmail()));
            return;
        }

        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            log.error("spring.mail.host is set but no JavaMailSender bean is available; code was not sent.");
            throw new EmailDeliveryException("Email service is currently unavailable.");
        }

        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");
            helper.setTo(user.getEmail());
            helper.setSubject("PASSWORD_RESET".equals(purpose)
                    ? "Expense Tracker — Password Reset Code"
                    : "Expense Tracker — Verify Your Email");

            String htmlBody = buildOtpHtml(user.getName(), otp, purpose);
            helper.setText(htmlBody, true);

            try {
                if (configuredMailHost != null && !configuredMailHost.isBlank()) {
                    helper.setFrom("noreply@" + configuredMailHost);
                }
            } catch (Exception ignored) {
                // Keep default if setFrom fails
            }

            mailSender.send(mimeMessage);
            log.info("Successfully dispatched {} OTP email to {}", purpose,
                    LoggingUtils.maskEmail(user.getEmail()));
        } catch (MailException e) {
            log.error("Failed to deliver {} OTP email to {}: {}", purpose,
                    LoggingUtils.maskEmail(user.getEmail()), e.getMessage());
            throw new EmailDeliveryException("Failed to deliver " + purpose + " verification email: "
                    + e.getMessage(), e);
        } catch (Exception e) {
            log.error("Unexpected error constructing {} email for {}: {}", purpose,
                    LoggingUtils.maskEmail(user.getEmail()), e.getMessage(), e);
            throw new EmailDeliveryException("Failed to send " + purpose + " verification email: "
                    + e.getMessage(), e);
        }
    }

    private String buildOtpHtml(String recipientName, String otp, String purpose) {
        String headline = "PASSWORD_RESET".equals(purpose)
                ? "Password Reset Verification"
                : "Confirm Your Email Address";
        String instructions = "PASSWORD_RESET".equals(purpose)
                ? "Use this single-use verification code to set a new password. It expires in <b>10 minutes</b>."
                : ("Enter this verification code on the registration page to complete your signup. "
                + "It expires in <b>10 minutes</b>.");

        return """
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"></head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                         background: #0f172a; color: #f8fafc; padding: 40px 20px;">
                <div style="max-width: 520px; margin: 0 auto; background: #1e293b; border-radius: 12px;
                            padding: 32px; border: 1px solid #334155;">
                    <h2 style="color: #6366f1; margin-top: 0;">%s</h2>
                    <p>Hello %s,</p>
                    <p>%s</p>
                    <div style="text-align: center; margin: 32px 0;">
                        <span style="display: inline-block; font-size: 32px; font-weight: 700;
                                     letter-spacing: 8px; color: #f8fafc; background: #0f172a;
                                     padding: 16px 28px; border-radius: 8px; border: 1px solid #4f46e5;">%s</span>
                    </div>
                    <p style="font-size: 13px; color: #94a3b8;">
                        If you did not initiate this request, you can safely ignore this message.
                    </p>
                </div>
            </body>
            </html>
            """.formatted(headline, recipientName != null ? recipientName : "there", instructions, otp);
    }
}
