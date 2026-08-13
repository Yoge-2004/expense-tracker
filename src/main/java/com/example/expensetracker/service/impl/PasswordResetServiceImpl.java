package com.example.expensetracker.service.impl;

import com.example.expensetracker.model.PasswordResetOtp;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.PasswordResetOtpRepository;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.service.OtpDeliveryListener;
import com.example.expensetracker.service.PasswordResetService;
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

        if (configuredMailHost == null || configuredMailHost.isBlank()) {
            log.warn("[DEV ONLY - email not configured] {} OTP for {}: {}", purpose, user.getEmail(), otp);
            return;
        }

        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            log.error("spring.mail.host is set but no JavaMailSender bean is available; code for {} was not sent.", user.getEmail());
            return;
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(user.getEmail());
            if ("SIGNUP".equals(purpose)) {
                message.setSubject("Verify your ExpenseTracker account");
                message.setText(
                        "Hi " + user.getName() + ",\n\n" +
                        "Your email verification code is: " + otp + "\n\n" +
                        "This code expires in " + OTP_TTL_MINUTES + " minutes. " +
                        "Enter it on the sign-up page to activate your account.\n\n" +
                        "If you didn't sign up for ExpenseTracker, you can safely ignore this email.\n"
                );
            } else {
                message.setSubject("Your ExpenseTracker password reset code");
                message.setText(
                        "Hi " + user.getName() + ",\n\n" +
                        "Your password reset code is: " + otp + "\n\n" +
                        "This code expires in " + OTP_TTL_MINUTES + " minutes. " +
                        "If you didn't request this, you can safely ignore this email.\n"
                );
            }
            mailSender.send(message);
        } catch (MailException e) {
            log.error("Failed to send {} email to {}", purpose, user.getEmail(), e);
        }
    }
}
