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
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
 *   <li><b>Graceful degradation without SMTP:</b> if {@code app.mail.enabled}
 *   is false or {@code spring.mail.host} isn't configured (common in local
 *   dev or a fresh deployment), the OTP is logged instead of emailed rather
 *   than throwing — signup/reset flows keep working, just without real email
 *   delivery. If mail is enabled but no {@link JavaMailSender} bean is
 *   actually available, the failure is logged and swallowed rather than
 *   propagated, so a misconfigured mail server doesn't break the OTP flow
 *   for the caller.</li>
 *   <li><b>Test hook:</b> {@link OtpDeliveryListener}, if a bean is present,
 *   is notified of every OTP issued — this exists so automated tests can
 *   capture the generated code without needing to read real email.</li>
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
        if (email == null || email.isBlank()) return;

        // Deliberately silent for unknown emails — this endpoint must not reveal
        // whether an address has an account, or it becomes an enumeration tool.
        userRepository.findByEmail(email).ifPresent(user -> {
            // Invalidate any still-open PASSWORD_RESET code before issuing a new one.
            otpRepository.findFirstByEmailAndPurposeAndUsedFalseOrderByCreatedAtDesc(email, "PASSWORD_RESET")
                    .ifPresent(existing -> {
                        existing.setUsed(true);
                        otpRepository.save(existing);
                    });

            String otp = generateOtp();

            PasswordResetOtp record = new PasswordResetOtp();
            record.setEmail(email);
            record.setPurpose("PASSWORD_RESET");
            record.setOtpHash(passwordEncoder.encode(otp));
            record.setExpiresAt(LocalDateTime.now().plus(OTP_TTL_MINUTES, ChronoUnit.MINUTES));
            otpRepository.save(record);

            sendOtpEmail(user, otp, "PASSWORD_RESET");
        });
    }

    @Override
    @Transactional
    public void resetPassword(String email, String otp, String newPassword) {
        if (email == null || otp == null || otp.isBlank()) {
            throw new BadCredentialsException("Invalid or expired code.");
        }

        PasswordResetOtp record = otpRepository.findFirstByEmailAndPurposeAndUsedFalseOrderByCreatedAtDesc(email, "PASSWORD_RESET")
                .orElseThrow(() -> new BadCredentialsException("Invalid or expired code."));

        if (record.getExpiresAt().isBefore(LocalDateTime.now())) {
            record.setUsed(true);
            otpRepository.save(record);
            throw new BadCredentialsException("Invalid or expired code.");
        }

        if (record.getAttempts() >= MAX_ATTEMPTS) {
            record.setUsed(true);
            otpRepository.save(record);
            throw new BadCredentialsException("Too many incorrect attempts. Please request a new code.");
        }

        if (!passwordEncoder.matches(otp, record.getOtpHash())) {
            record.setAttempts(record.getAttempts() + 1);
            otpRepository.save(record);
            throw new BadCredentialsException("Invalid or expired code.");
        }

        record.setUsed(true);
        otpRepository.save(record);

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BadCredentialsException("Invalid or expired code."));
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
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
            log.info("[Email Delivery Disabled] {} OTP for {}: {}", purpose, user.getEmail(), otp);
            return;
        }

        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            log.error("spring.mail.host is set but no JavaMailSender bean is available; code for {} was not sent.", user.getEmail());
            return;
        }

        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            if (mimeMessage != null) {
                try {
                    MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, "UTF-8");
                    helper.setTo(user.getEmail());
                    String subject = "SIGNUP".equals(purpose)
                            ? "Verify your ExpenseTracker PRO account"
                            : "Reset your ExpenseTracker PRO password";
                    helper.setSubject(subject);

                    String htmlBody = buildHtmlEmailContent(user.getName(), otp, purpose);
                    helper.setText(htmlBody, true);
                } catch (Exception helperEx) {
                    log.warn("Could not set full HTML headers on MimeMessage: {}", helperEx.getMessage());
                }
                mailSender.send(mimeMessage);
                log.info("Sent {} HTML OTP email to {}", purpose, user.getEmail());
            }
        } catch (Exception e) {
            log.error("Failed to send {} HTML email to {}", purpose, user.getEmail(), e);
        }
    }

    private String buildHtmlEmailContent(String name, String otp, String purpose) {
        boolean isSignup = "SIGNUP".equals(purpose);
        String title = isSignup ? "Verify Your Account" : "Password Reset Request";
        String subtitle = isSignup
                ? "Enter the code below on the registration page to activate your ExpenseTracker Pro account."
                : "Enter the code below to securely reset your ExpenseTracker Pro account password.";

        return """
            <!DOCTYPE html>
            <html>
            <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { margin: 0; padding: 0; background-color: #0d0f0b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ece7d8; }
              .email-container { max-width: 560px; margin: 30px auto; background: #171a14; border: 1px solid rgba(236, 231, 216, 0.12); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
              .email-header { padding: 32px 32px 20px; text-align: center; border-bottom: 1px solid rgba(236, 231, 216, 0.08); background: linear-gradient(180deg, rgba(199, 154, 62, 0.1) 0%%, rgba(23, 26, 20, 0) 100%%); }
              .brand-badge { display: inline-block; background: rgba(199, 154, 62, 0.15); border: 1px solid rgba(199, 154, 62, 0.3); border-radius: 999px; padding: 6px 18px; font-size: 13px; font-weight: 800; color: #c79a3e; letter-spacing: 0.5px; }
              .email-body { padding: 32px; }
              .greeting { font-size: 20px; font-weight: 700; color: #ece7d8; margin-bottom: 10px; }
              .subtext { font-size: 14px; line-height: 1.6; color: #a8a395; margin-bottom: 26px; }
              .otp-card { background: #10120e; border: 1.5px dashed #c79a3e; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 26px; }
              .otp-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #a8a395; font-weight: 700; margin-bottom: 8px; }
              .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #c79a3e; }
              .ttl-badge { display: inline-block; font-size: 12px; font-weight: 600; color: #c9932e; margin-top: 10px; background: rgba(201, 147, 46, 0.12); padding: 4px 12px; border-radius: 8px; }
              .security-note { font-size: 13px; color: #a8a395; line-height: 1.5; padding: 14px 16px; background: rgba(236, 231, 216, 0.04); border-radius: 12px; border-left: 3px solid #c79a3e; }
              .email-footer { padding: 24px 32px; border-top: 1px solid rgba(236, 231, 216, 0.08); background: #10120e; text-align: center; font-size: 12px; color: #6b6558; line-height: 1.5; }
            </style>
            </head>
            <body>
              <div class="email-container">
                <div class="email-header">
                  <div class="brand-badge">💎 ExpenseTracker PRO</div>
                </div>
                <div class="email-body">
                  <div class="greeting">Hi %s,</div>
                  <div class="subtext">%s</div>
                  <div class="otp-card">
                    <div class="otp-label">%s</div>
                    <div class="otp-code">%s</div>
                    <div class="ttl-badge">⏳ Expires in %d minutes</div>
                  </div>
                  <div class="security-note">
                    <strong>Security Notice:</strong> If you did not request this verification code, you can safely ignore this email. Never share your 6-digit code with anyone.
                  </div>
                </div>
                <div class="email-footer">
                  ExpenseTracker Pro · Smart Financial Intelligence<br>
                  This is an automated message, please do not reply directly to this email.
                </div>
              </div>
            </body>
            </html>
            """.formatted(
                name != null ? name : "User",
                subtitle,
                title,
                otp,
                OTP_TTL_MINUTES
            );
    }
}
