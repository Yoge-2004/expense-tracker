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
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.util.HtmlUtils;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

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
@Transactional(readOnly = true)
public class PasswordResetServiceImpl implements PasswordResetService {

    private static final int OTP_TTL_MINUTES = 10;
    private static final int MAX_ATTEMPTS = 5;

    /** Consecutive failed reset attempts that lock recovery for an account. */
    private static final int MAX_FAILED_ATTEMPTS = 5;
    /** How long recovery stays locked once {@link #MAX_FAILED_ATTEMPTS} is reached. */
    private static final int LOCK_MINUTES = 15;

    /**
     * Number of password-hash comparisons every reset attempt performs, whatever
     * the outcome. BCrypt dominates the cost of an attempt, so a fixed count means
     * an unknown email, a locked account, an account with no PIN and no pending
     * OTP, and an account with both all take (to within DB latency) the same time.
     * Two = one for the Security PIN and one for the emailed OTP.
     */
    private static final int HASH_COMPARISONS_PER_ATTEMPT = 2;

    /**
     * The single client-facing failure message for EVERY "cannot authorise this
     * reset" outcome: wrong code, wrong PIN, rejected BYPASS token, an email that
     * has no account, and an account that is currently locked. Deliberately one
     * constant and deliberately silent about which case applied — if these ever
     * differ (an "account not found" here, a "locked, try in N minutes" there) the
     * difference becomes an account-enumeration oracle, because an unknown email
     * can never be locked. The policy is stated instead so a legitimate user who
     * has been locked out still knows what to do.
     */
    private static final String INVALID_CODE_MESSAGE =
            "Invalid verification code or Security PIN. Recovery is temporarily locked for "
                    + LOCK_MINUTES + " minutes after " + MAX_FAILED_ATTEMPTS + " failed attempts.";

    private final UserRepository userRepository;
    private final PasswordResetOtpRepository otpRepository;
    private final PasswordEncoder passwordEncoder;
    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final ObjectProvider<OtpDeliveryListener> otpDeliveryListenerProvider;
    private final SecureRandom random = new SecureRandom();

    /**
     * A genuine hash produced by the live {@link PasswordEncoder}, so comparing
     * against it costs exactly what comparing against a real stored hash costs
     * (same algorithm, same work factor — including if either is changed later).
     * Only used to burn equivalent time; its result is always discarded.
     */
    private final String dummyHash;

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
        this.dummyHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }

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
            throw new BadCredentialsException(INVALID_CODE_MESSAGE);
        }

        String inputCode = otp.trim();

        // An unknown email must be indistinguishable from a known email with a
        // wrong code — same exception, same message, same amount of hashing work.
        // requestReset() already hides whether an account exists; throwing
        // NoSuchElementException here (mapped to a 404 that echoed the address back)
        // let anyone probe which emails are registered just by comparing 404 to 401.
        Optional<User> account = userRepository.findByEmailIgnoreCase(email.trim());
        if (account.isEmpty()) {
            log.warn("Password reset rejected: no account for email={}", LoggingUtils.maskEmail(email));
            burnHashWork(inputCode, 0);
            throw new BadCredentialsException(INVALID_CODE_MESSAGE);
        }
        User user = account.get();

        if (user.getPinLockedUntil() != null) {
            if (user.getPinLockedUntil().isAfter(LocalDateTime.now())) {
                // Still locked. Refuse without touching the counters (so attempts made
                // while locked can never extend the lock), and answer exactly like any
                // other failure — see INVALID_CODE_MESSAGE.
                log.warn("Recovery attempt blocked for locked account email={}; lockedUntil={}",
                        LoggingUtils.maskEmail(email), user.getPinLockedUntil());
                burnHashWork(inputCode, 0);
                throw new BadCredentialsException(INVALID_CODE_MESSAGE);
            }
            // The lock has been served: start from a clean slate. Without this the
            // counter stayed at >= 5, so ONE wrong guess after expiry re-locked the
            // account for another full period.
            user.setPinLockedUntil(null);
            user.setFailedPinAttempts(0);
        }

        // Always do HASH_COMPARISONS_PER_ATTEMPT comparisons: real ones first (for
        // whichever credentials actually exist), then dummy ones to make up the count.
        int comparisons = 0;

        boolean pinOk = false;
        String pinHash = user.getSecurityPinHash();
        if (pinHash != null && !pinHash.isBlank()) {
            pinOk = passwordEncoder.matches(inputCode, pinHash);
            comparisons++;
        }

        LocalDateTime now = LocalDateTime.now();
        PasswordResetOtp eligibleOtp = otpRepository
                .findFirstByEmailAndPurposeAndUsedFalseOrderByCreatedAtDesc(user.getEmail(), "PASSWORD_RESET")
                .filter(r -> !r.getExpiresAt().isBefore(now) && r.getAttempts() < MAX_ATTEMPTS)
                .orElse(null);
        boolean otpOk = false;
        if (eligibleOtp != null) {
            otpOk = passwordEncoder.matches(inputCode, eligibleOtp.getOtpHash());
            comparisons++;
        }

        burnHashWork(inputCode, comparisons);

        if (pinOk) {
            clearRecoveryFailures(user);
            log.info("Password reset authorized via 6-digit Security PIN for email={}",
                    LoggingUtils.maskEmail(email));
        } else if (otpOk) {
            eligibleOtp.setUsed(true);
            otpRepository.save(eligibleOtp);
            clearRecoveryFailures(user);
            log.info("Password reset authorized via Email OTP for email={}", LoggingUtils.maskEmail(email));
        } else {
            if (eligibleOtp != null) {
                eligibleOtp.setAttempts(eligibleOtp.getAttempts() + 1);
                otpRepository.save(eligibleOtp);
            }
            int failed = user.getFailedPinAttempts() + 1; // entity getter already maps a null column to 0
            user.setFailedPinAttempts(failed);
            if (failed >= MAX_FAILED_ATTEMPTS) {
                user.setPinLockedUntil(LocalDateTime.now().plusMinutes(LOCK_MINUTES));
                log.warn("Account recovery locked for {} minutes after {} consecutive failed attempts for email={}",
                        LOCK_MINUTES, failed, LoggingUtils.maskEmail(email));
            }
            userRepository.save(user);
            throw new BadCredentialsException(INVALID_CODE_MESSAGE);
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        log.info("Password reset successfully applied for email={}", LoggingUtils.maskEmail(email));
    }

    @Override
    @Transactional
    public void resetPasswordForVerifiedUser(User user, String newPassword) {
        if (user == null) {
            throw new IllegalArgumentException("Account is required.");
        }
        if (newPassword == null || newPassword.isBlank()) {
            throw new IllegalArgumentException("New password is required.");
        }
        if (newPassword.length() < 6) {
            throw new IllegalArgumentException("New password must be at least 6 characters long.");
        }

        // A reset code requested earlier must not stay usable once the password has been changed another way.
        otpRepository.findFirstByEmailAndPurposeAndUsedFalseOrderByCreatedAtDesc(user.getEmail(), "PASSWORD_RESET")
                .ifPresent(pending -> {
                    pending.setUsed(true);
                    otpRepository.save(pending);
                });

        clearRecoveryFailures(user);
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        log.info("Password reset applied via verified passkey for email={}", LoggingUtils.maskEmail(user.getEmail()));
    }

    @Override
    @Transactional
    public boolean sendSignupOtp(String email, String name) {
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("Email address is required.");
        }

        // registerUser() trims and rejects duplicates case-insensitively, so this
        // check must too — an exact-match lookup let "User@x.com" through for an
        // account registered as "user@x.com" (a pointless OTP email, then a
        // rejection at the very last step). OTP rows are keyed on the lower-cased
        // address so the code still verifies if the client changes the casing
        // between the "send" and "verify" steps.
        String recipient = email.trim();
        String otpKey = signupOtpKey(email);

        if (userRepository.existsByEmailIgnoreCase(recipient)) {
            log.info("Signup OTP skipped: email already registered: {}", LoggingUtils.maskEmail(email));
            return false;
        }

        log.info("Generating signup OTP for email={}", LoggingUtils.maskEmail(email));

        otpRepository.findFirstByEmailAndPurposeAndUsedFalseOrderByCreatedAtDesc(otpKey, "SIGNUP")
                .ifPresent(existing -> {
                    existing.setUsed(true);
                    otpRepository.save(existing);
                });

        String otp = generateOtp();

        PasswordResetOtp record = new PasswordResetOtp();
        record.setEmail(otpKey);
        record.setPurpose("SIGNUP");
        record.setOtpHash(passwordEncoder.encode(otp));
        record.setExpiresAt(LocalDateTime.now().plusMinutes(OTP_TTL_MINUTES));
        otpRepository.save(record);

        User tempUser = new User();
        tempUser.setName(name != null && !name.isBlank() ? name : recipient);
        tempUser.setEmail(recipient);
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
                .findFirstByEmailAndPurposeAndUsedFalseOrderByCreatedAtDesc(signupOtpKey(email), "SIGNUP")
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

        if (!passwordEncoder.matches(otp.trim(), record.getOtpHash())) {
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

    private static void clearRecoveryFailures(User user) {
        user.setFailedPinAttempts(0);
        user.setPinLockedUntil(null);
    }

    /**
     * Performs however many dummy hash comparisons are needed to bring an attempt
     * that has already done {@code alreadyDone} real ones up to
     * {@link #HASH_COMPARISONS_PER_ATTEMPT}. The results are discarded.
     */
    private void burnHashWork(String inputCode, int alreadyDone) {
        for (int i = alreadyDone; i < HASH_COMPARISONS_PER_ATTEMPT; i++) {
            passwordEncoder.matches(inputCode, dummyHash);
        }
    }

    /** Trimmed, lower-cased key under which a SIGNUP OTP row is stored and looked up. */
    static String signupOtpKey(String email) {
        return email.trim().toLowerCase(java.util.Locale.ROOT);
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

    /**
     * Package-private (not private) so the escaping can be unit-tested directly.
     * {@code recipientName} is attacker-controllable: {@code POST
     * /api/auth/signup/send-otp} is public and accepts any non-blank {@code name},
     * which used to be interpolated raw, so anyone could send a victim a genuine
     * email from this app's own sender containing arbitrary HTML (fake links,
     * tracking pixels). The name is HTML-escaped; the headline and instructions
     * are trusted constants that intentionally contain markup and are not.
     */
    String buildOtpHtml(String recipientName, String otp, String purpose) {
        String safeName = recipientName != null ? HtmlUtils.htmlEscape(recipientName, "UTF-8") : "there";
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
            """.formatted(headline, safeName, instructions, otp);
    }
}
