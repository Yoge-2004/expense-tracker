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
            // Invalidate any still-open code before issuing a new one.
            otpRepository.findFirstByEmailAndUsedFalseOrderByCreatedAtDesc(email)
                    .ifPresent(existing -> {
                        existing.setUsed(true);
                        otpRepository.save(existing);
                    });

            String otp = generateOtp();

            PasswordResetOtp record = new PasswordResetOtp();
            record.setEmail(email);
            record.setOtpHash(passwordEncoder.encode(otp));
            record.setExpiresAt(LocalDateTime.now().plus(OTP_TTL_MINUTES, ChronoUnit.MINUTES));
            otpRepository.save(record);

            sendOtpEmail(user, otp);
        });
    }

    @Override
    @Transactional
    public void resetPassword(String email, String otp, String newPassword) {
        if (email == null || otp == null || otp.isBlank()) {
            throw new BadCredentialsException("Invalid or expired code.");
        }

        PasswordResetOtp record = otpRepository.findFirstByEmailAndUsedFalseOrderByCreatedAtDesc(email)
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

    private String generateOtp() {
        int code = 100000 + random.nextInt(900000); // always 6 digits
        return String.valueOf(code);
    }

    private void sendOtpEmail(User user, String otp) {
        OtpDeliveryListener listener = otpDeliveryListenerProvider.getIfAvailable();
        if (listener != null) {
            listener.onOtpIssued(user.getEmail(), otp);
        }

        if (configuredMailHost == null || configuredMailHost.isBlank()) {
            // Dev-only fallback: no SMTP configured (SMTP_HOST unset), so there's
            // nowhere to actually send this. Logging it locally lets you finish
            // testing the flow before wiring up real SMTP credentials.
            // This only ever reaches your own server console, never the requester.
            log.warn("[DEV ONLY - email not configured] Password reset code for {}: {}", user.getEmail(), otp);
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
            message.setSubject("Your ExpenseTracker password reset code");
            message.setText(
                    "Hi " + user.getName() + ",\n\n" +
                    "Your password reset code is: " + otp + "\n\n" +
                    "This code expires in " + OTP_TTL_MINUTES + " minutes. " +
                    "If you didn't request this, you can safely ignore this email.\n"
            );
            mailSender.send(message);
        } catch (MailException e) {
            log.error("Failed to send password reset email to {}", user.getEmail(), e);
            // Don't throw here: the OTP row already exists, and revealing send
            // failures to the caller could leak whether the address is registered.
        }
    }
}
