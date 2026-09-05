package com.example.expensetracker.service.impl;

import com.example.expensetracker.model.PasswordResetOtp;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.PasswordResetOtpRepository;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.service.OtpDeliveryListener;
import com.example.expensetracker.service.PasswordResetService;
import jakarta.mail.internet.MimeMessage;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.NoSuchElementException;
import java.util.Optional;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

/**
 * Implements password-reset and signup OTP workflows.
 *
 * <p>All recovery codes are stored as BCrypt hashes, are purpose-scoped,
 * expire after a short lifetime, and are single-use. Security-PIN recovery
 * shares the same account lockout state to prevent brute-force attempts.</p>
 */
@Service
public class PasswordResetServiceImpl implements PasswordResetService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetServiceImpl.class);

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

    public PasswordResetServiceImpl(UserRepository userRepository,
                                    PasswordResetOtpRepository otpRepository,
                                    PasswordEncoder passwordEncoder,
                                    ObjectProvider<JavaMailSender> mailSenderProvider,
                                    ObjectProvider<OtpDeliveryListener> otpDeliveryListenerProvider) {
        this.userRepository = userRepository;
        this.otpRepository = otpRepository;
        this.passwordEncoder = passwordEncoder;
        this.mailSenderProvider = mailSenderProvider;
        this.otpDeliveryListenerProvider = otpDeliveryListenerProvider;
    }

    @Override
    @Transactional
    public void requestReset(String email) {
        String normalizedEmail = normalizeEmail(email);

        User user = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new NoSuchElementException("No account found with email address: " + normalizedEmail));

        log.info("Generating password reset OTP for email={}", user.getEmail());
        invalidateLatestUnusedOtp(user.getEmail(), "PASSWORD_RESET");

        String otp = generateOtp();
        PasswordResetOtp record = createOtpRecord(user.getEmail(), "PASSWORD_RESET", otp);
        otpRepository.save(record);

        sendOtpEmail(user, otp, "PASSWORD_RESET");
    }

    @Override
    @Transactional
    public void resetPassword(String email, String otp, String newPassword) {
        String normalizedEmail = normalizeEmail(email);
        if (otp == null || otp.isBlank()) {
            throw new BadCredentialsException("Invalid or expired code or PIN.");
        }
        if (newPassword == null || newPassword.isBlank()) {
            throw new BadCredentialsException("New password is required.");
        }

        String inputCode = otp.trim();
        if ("BYPASS".equalsIgnoreCase(inputCode)) {
            log.warn("Security violation: Rejected deprecated BYPASS token attempt for email={}", normalizedEmail);
            throw new BadCredentialsException("Invalid verification code or Security PIN.");
        }

        User user = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new NoSuchElementException("No account found with email address: " + normalizedEmail));

        enforceRecoveryLockout(user);

        boolean verified = verifySecurityPin(user, inputCode);
        PasswordResetOtp emailOtp = null;

        if (!verified) {
            emailOtp = otpRepository
                    .findFirstByEmailAndPurposeAndUsedFalseOrderByCreatedAtDesc(user.getEmail(), "PASSWORD_RESET")
                    .orElse(null);
            if (emailOtp != null) {
                if (emailOtp.getExpiresAt() == null || emailOtp.getExpiresAt().isBefore(LocalDateTime.now())) {
                    emailOtp.setUsed(true);
                    otpRepository.save(emailOtp);
                    emailOtp = null;
                } else if (emailOtp.getAttempts() >= MAX_ATTEMPTS) {
                    emailOtp.setUsed(true);
                    otpRepository.save(emailOtp);
                    emailOtp = null;
                } else if (passwordEncoder.matches(inputCode, emailOtp.getOtpHash())) {
                    verified = true;
                } else {
                    emailOtp.setAttempts(emailOtp.getAttempts() + 1);
                    otpRepository.save(emailOtp);
                    emailOtp = null;
                }
            }
        }

        if (!verified) {
            registerFailedRecoveryAttempt(user);
            throw new BadCredentialsException("Invalid verification code or Security PIN.");
        }

        // A successful PIN reset must also consume the latest outstanding email
        // reset code. Otherwise an already-issued email OTP remains reusable
        // after the account password has changed.
        if (emailOtp != null) {
            emailOtp.setUsed(true);
            otpRepository.save(emailOtp);
        } else if (isSecurityPinMatch(user, inputCode)) {
            invalidateLatestUnusedOtp(user.getEmail(), "PASSWORD_RESET");
        }

        user.setFailedPinAttempts(0);
        user.setPinLockedUntil(null);
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        log.info("Password reset successfully applied for email={}", user.getEmail());
    }

    @Override
    @Transactional
    public boolean sendSignupOtp(String email, String name) {
        String normalizedEmail = normalizeEmail(email);
        if (normalizedEmail.isBlank()) return false;

        // Email identity is case-insensitive throughout the authentication
        // model; use the same rule here so signup cannot bypass the duplicate
        // account check by changing email casing.
        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            return false;
        }

        log.info("Generating signup OTP for email={}", normalizedEmail);
        invalidateLatestUnusedOtp(normalizedEmail, "SIGNUP");

        String otp = generateOtp();
        PasswordResetOtp record = createOtpRecord(normalizedEmail, "SIGNUP", otp);
        otpRepository.save(record);

        User tempUser = new User();
        tempUser.setName(name != null && !name.isBlank() ? name.trim() : normalizedEmail);
        tempUser.setEmail(normalizedEmail);
        sendOtpEmail(tempUser, otp, "SIGNUP");
        return true;
    }

    @Override
    @Transactional
    public void verifySignupOtp(String email, String otp) {
        String normalizedEmail = normalizeEmail(email);
        if (normalizedEmail.isBlank() || otp == null || otp.isBlank()) {
            throw new BadCredentialsException("Invalid or expired code.");
        }

        PasswordResetOtp record = otpRepository
                .findFirstByEmailAndPurposeAndUsedFalseOrderByCreatedAtDesc(normalizedEmail, "SIGNUP")
                .orElseThrow(() -> new BadCredentialsException("Invalid or expired verification code."));

        LocalDateTime now = LocalDateTime.now();
        if (record.getExpiresAt() == null || record.getExpiresAt().isBefore(now)) {
            record.setUsed(true);
            otpRepository.save(record);
            throw new BadCredentialsException("Verification code has expired. Please request a new one.");
        }

        if (record.getAttempts() >= MAX_ATTEMPTS) {
            record.setUsed(true);
            otpRepository.save(record);
            throw new BadCredentialsException("Too many incorrect attempts. Please request a new verification code.");
        }

        if (!passwordEncoder.matches(otp.trim(), record.getOtpHash())) {
            record.setAttempts(record.getAttempts() + 1);
            if (record.getAttempts() >= MAX_ATTEMPTS) {
                record.setUsed(true);
            }
            otpRepository.save(record);
            throw new BadCredentialsException("Invalid verification code.");
        }

        record.setUsed(true);
        otpRepository.save(record);
        log.info("Signup OTP verified successfully for email={}", normalizedEmail);
    }

    private String normalizeEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("Email address is required.");
        }
        return email.trim();
    }

    private PasswordResetOtp createOtpRecord(String email, String purpose, String otp) {
        PasswordResetOtp record = new PasswordResetOtp();
        record.setEmail(email);
        record.setPurpose(purpose);
        record.setOtpHash(passwordEncoder.encode(otp));
        record.setExpiresAt(LocalDateTime.now().plus(OTP_TTL_MINUTES, ChronoUnit.MINUTES));
        record.setAttempts(0);
        record.setUsed(false);
        return record;
    }

    private void invalidateLatestUnusedOtp(String email, String purpose) {
        otpRepository.findFirstByEmailAndPurposeAndUsedFalseOrderByCreatedAtDesc(email, purpose)
                .ifPresent(existing -> {
                    existing.setUsed(true);
                    otpRepository.save(existing);
                });
    }

    private void enforceRecoveryLockout(User user) {
        if (user.getPinLockedUntil() != null && user.getPinLockedUntil().isAfter(LocalDateTime.now())) {
            long minutesRemaining = java.time.Duration.between(LocalDateTime.now(), user.getPinLockedUntil()).toMinutes() + 1;
            throw new BadCredentialsException(
                    "Account recovery temporarily locked due to too many failed attempts. Please try again in "
                            + minutesRemaining + " minute(s)."
            );
        }
    }

    private boolean verifySecurityPin(User user, String inputCode) {
        return user.getSecurityPinHash() != null
                && passwordEncoder.matches(inputCode, user.getSecurityPinHash());
    }

    private boolean isSecurityPinMatch(User user, String inputCode) {
        return user.getSecurityPinHash() != null
                && passwordEncoder.matches(inputCode, user.getSecurityPinHash());
    }

    private void registerFailedRecoveryAttempt(User user) {
        int failed = user.getFailedPinAttempts() + 1;
        user.setFailedPinAttempts(failed);
        if (failed >= MAX_ATTEMPTS) {
            user.setPinLockedUntil(LocalDateTime.now().plusMinutes(15));
            log.warn("Account recovery locked for 15 minutes due to 5 consecutive failed attempts for email={}", user.getEmail());
        }
        userRepository.save(user);
    }

    private String generateOtp() {
        return String.valueOf(100000 + random.nextInt(900000));
    }

    private void sendOtpEmail(User user, String otp, String purpose) {
        OtpDeliveryListener listener = otpDeliveryListenerProvider.getIfAvailable();
        if (listener != null) {
            listener.onOtpIssued(user.getEmail(), otp);
        }

        if (!mailEnabled || configuredMailHost == null || configuredMailHost.isBlank()) {
            log.info("[Email Delivery Disabled] Generated {} OTP for email={} (masked for security)", purpose, user.getEmail());
            return;
        }

        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            log.error("spring.mail.host is set but no JavaMailSender bean is available; code for {} was not sent.", user.getEmail());
            return;
        }

        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");
            helper.setTo(user.getEmail());
            helper.setSubject("PASSWORD_RESET".equals(purpose)
                    ? "Expense Tracker — Password Reset Code"
                    : "Expense Tracker — Verify Your Email");
            helper.setText(buildOtpHtml(user.getName(), otp, purpose), true);
            if (configuredMailHost != null && !configuredMailHost.isBlank()) {
                try {
                    helper.setFrom("noreply@" + configuredMailHost);
                } catch (Exception ignored) {
                    // Keep JavaMail's configured default sender if the derived address is rejected.
                }
            }
            mailSender.send(mimeMessage);
        } catch (MailException e) {
            log.error("Failed to deliver {} OTP email to {}: {}", purpose, user.getEmail(), e.getMessage());
        } catch (Exception e) {
            log.error("Unexpected error constructing {} email for {}: {}", purpose, user.getEmail(), e.getMessage(), e);
        }
    }

    private String buildOtpHtml(String recipientName, String otp, String purpose) {
        String headline = "PASSWORD_RESET".equals(purpose)
                ? "Password Reset Verification"
                : "Confirm Your Email Address";
        String instructions = "PASSWORD_RESET".equals(purpose)
                ? "Use this single-use verification code to set a new password. It expires in <b>10 minutes</b>."
                : "Enter this verification code on the registration page to complete your signup. It expires in <b>10 minutes</b>.";

        return """
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"></head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0e1117; color: #e6edf3; padding: 40px 20px;">
              <div style="max-width: 480px; margin: 0 auto; background: #161b22; border-radius: 12px; padding: 32px; border: 1px solid #30363d;">
                <h2 style="color: #58a6ff; margin-top: 0;">Expense Tracker</h2>
                <h3 style="color: #f0f6fc;">%s</h3>
                <p style="color: #8b949e;">Hello %s,</p>
                <p style="color: #8b949e;">%s</p>
                <div style="background: #0d1117; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0; border: 1px solid #21262d;">
                  <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #7ee787;">%s</span>
                </div>
                <p style="color: #8b949e; font-size: 13px;">If you didn't request this code, you can safely ignore this email.</p>
              </div>
            </body>
            </html>
            """.formatted(
                headline,
                recipientName != null ? recipientName : "there",
                instructions,
                otp
        );
    }
}
