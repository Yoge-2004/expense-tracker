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
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("Email address is required.");
        }

        User user = userRepository.findByEmailIgnoreCase(email.trim())
                .orElseThrow(() -> new NoSuchElementException("No account found with email address: " + email.trim()));

        log.info("Generating password reset OTP for email={}", user.getEmail());

        // Invalidate any still-open PASSWORD_RESET code before issuing a new one.
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
        record.setExpiresAt(LocalDateTime.now().plus(OTP_TTL_MINUTES, ChronoUnit.MINUTES));
        otpRepository.save(record);

        sendOtpEmail(user, otp, "PASSWORD_RESET");
    }

    @Override
    @Transactional
    public void resetPassword(String email, String otp, String newPassword) {
        if (email == null || email.isBlank() || otp == null || otp.isBlank()) {
            throw new BadCredentialsException("Invalid or expired code or PIN.");
        }

        // HARDENING: Completely reject deprecated backdoor strings
        if ("BYPASS".equalsIgnoreCase(otp.trim())) {
            log.warn("Security violation: Rejected deprecated BYPASS token attempt for email={}", email);
            throw new BadCredentialsException("Invalid verification code or Security PIN.");
        }

        User user = userRepository.findByEmailIgnoreCase(email.trim())
                .orElseThrow(() -> new NoSuchElementException("No account found with email address: " + email.trim()));

        // Check brute-force lockout for Security PIN / OTP recovery
        if (user.getPinLockedUntil() != null && user.getPinLockedUntil().isAfter(LocalDateTime.now())) {
            long minutesRemaining = java.time.Duration.between(LocalDateTime.now(), user.getPinLockedUntil()).toMinutes() + 1;
            log.warn("Recovery attempt blocked for locked account email={}, minutesRemaining={}", user.getEmail(), minutesRemaining);
            throw new BadCredentialsException("Account recovery temporarily locked due to too many failed attempts. Please try again in " + minutesRemaining + " minute(s).");
        }

        String inputCode = otp.trim();
        boolean verified = false;

        // 1. Verify against user's 6-digit Security PIN (works in zero-email environments)
        if (user.getSecurityPinHash() != null && passwordEncoder.matches(inputCode, user.getSecurityPinHash())) {
            verified = true;
            user.setFailedPinAttempts(0);
            user.setPinLockedUntil(null);
            log.info("Password reset authorized via 6-digit Security PIN for email={}", user.getEmail());
        }

        // 2. Verify against unexpired, unused Email OTP if PIN didn't match
        if (!verified) {
            Optional<PasswordResetOtp> recordOpt = otpRepository.findFirstByEmailAndPurposeAndUsedFalseOrderByCreatedAtDesc(user.getEmail(), "PASSWORD_RESET");
            if (recordOpt.isPresent()) {
                PasswordResetOtp record = recordOpt.get();
                if (!record.getExpiresAt().isBefore(LocalDateTime.now()) && record.getAttempts() < MAX_ATTEMPTS) {
                    if (passwordEncoder.matches(inputCode, record.getOtpHash())) {
                        verified = true;
                        record.setUsed(true);
                        otpRepository.save(record);
                        user.setFailedPinAttempts(0);
                        user.setPinLockedUntil(null);
                        log.info("Password reset authorized via Email OTP for email={}", user.getEmail());
                    } else {
                        record.setAttempts(record.getAttempts() + 1);
                        otpRepository.save(record);
                    }
                }
            }
        }

        // 3. If neither matched, increment failed attempts and lockout after threshold
        if (!verified) {
            int failed = user.getFailedPinAttempts() + 1;
            user.setFailedPinAttempts(failed);
            if (failed >= 5) {
                user.setPinLockedUntil(LocalDateTime.now().plusMinutes(15));
                log.warn("Account recovery locked for 15 minutes due to 5 consecutive failed attempts for email={}", user.getEmail());
            }
            userRepository.save(user);
            throw new BadCredentialsException("Invalid verification code or Security PIN.");
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        log.info("Password reset successfully applied for email={}", user.getEmail());
    }

    @Override
    @Transactional
    public boolean sendSignupOtp(String email, String name) {
        if (email == null || email.isBlank()) return false;

        // Fail fast if the email is already registered — unlike password reset,
        // revealing this is expected and useful for the signup flow.
        if (userRepository.existsByEmail(email)) {
            return false;
        }

        log.info("Generating signup OTP for email={}", email);

        // Invalidate any still-open SIGNUP OTP for this email before issuing a new one.
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
        record.setExpiresAt(LocalDateTime.now().plus(OTP_TTL_MINUTES, ChronoUnit.MINUTES));
        otpRepository.save(record);

        // Build a temporary User object just to reuse the email helper
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
            throw new BadCredentialsException("Invalid or expired code.");
        }

        PasswordResetOtp record = otpRepository.findFirstByEmailAndPurposeAndUsedFalseOrderByCreatedAtDesc(email, "SIGNUP")
                .orElseThrow(() -> new BadCredentialsException("Invalid or expired verification code."));

        if (record.getExpiresAt().isBefore(LocalDateTime.now())) {
            record.setUsed(true);
            otpRepository.save(record);
            throw new BadCredentialsException("Verification code has expired. Please request a new one.");
        }

        if (record.getAttempts() >= MAX_ATTEMPTS) {
            record.setUsed(true);
            otpRepository.save(record);
            throw new BadCredentialsException("Too many incorrect attempts. Please request a new verification code.");
        }

        if (!passwordEncoder.matches(otp, record.getOtpHash())) {
            record.setAttempts(record.getAttempts() + 1);
            otpRepository.save(record);
            throw new BadCredentialsException("Invalid verification code.");
        }

        // Mark as used — the register endpoint completes the account creation.
        record.setUsed(true);
        otpRepository.save(record);
        log.info("Signup OTP verified successfully for email={}", email);
    }

    private String generateOtp() {
        int code = 100000 + random.nextInt(900000); // always 6 digits
        return String.valueOf(code);
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
            log.info("Successfully dispatched {} OTP email to {}", purpose, user.getEmail());
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
            """.formatted(headline, recipientName != null ? recipientName : "there", instructions, otp);
    }
}
