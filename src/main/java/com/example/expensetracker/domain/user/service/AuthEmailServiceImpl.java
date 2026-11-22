package com.example.expensetracker.domain.user.service;

import jakarta.mail.internet.MimeMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.infrastructure.exception.EmailDeliveryException;
import com.example.expensetracker.infrastructure.logging.LoggingUtils;

/**
 * Production implementation of {@link AuthEmailService} using {@link JavaMailSender} and OpenHTML templates.
 * Isolate SMTP network interactions and MIME structure from password management logic.
 *
 * @author Yogeshwaran
 */
@Slf4j
@Service
public class AuthEmailServiceImpl implements AuthEmailService {

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final ObjectProvider<OtpDeliveryListener> otpDeliveryListenerProvider;
    private String configuredMailHost;
    private boolean mailEnabled;

    @Autowired
    public AuthEmailServiceImpl(ObjectProvider<JavaMailSender> mailSenderProvider,
                                ObjectProvider<OtpDeliveryListener> otpDeliveryListenerProvider,
                                @Value("${spring.mail.host:}") String configuredMailHost,
                                @Value("${app.mail.enabled:false}") boolean mailEnabled) {
        this.mailSenderProvider = mailSenderProvider;
        this.otpDeliveryListenerProvider = otpDeliveryListenerProvider;
        this.configuredMailHost = configuredMailHost;
        this.mailEnabled = mailEnabled;
    }

    public AuthEmailServiceImpl(ObjectProvider<JavaMailSender> mailSenderProvider,
                                ObjectProvider<OtpDeliveryListener> otpDeliveryListenerProvider) {
        this(mailSenderProvider, otpDeliveryListenerProvider, "", false);
    }

    void setConfiguredMailHost(String configuredMailHost) {
        this.configuredMailHost = configuredMailHost;
    }

    void setMailEnabled(boolean mailEnabled) {
        this.mailEnabled = mailEnabled;
    }

    @Override
    public void sendOtpEmail(User user, String otp, String purpose) {
        if (otpDeliveryListenerProvider != null) {
            OtpDeliveryListener listener = otpDeliveryListenerProvider.getIfAvailable();
            if (listener != null) {
                listener.onOtpIssued(user.getEmail(), otp);
            }
        }

        if (!mailEnabled || configuredMailHost == null || configuredMailHost.isBlank()) {
            log.info("[Email Delivery Disabled] Generated {} OTP for email={} (delivery simulated/disabled)",
                    purpose, LoggingUtils.maskEmail(user.getEmail()));
            return;
        }

        JavaMailSender mailSender = mailSenderProvider != null ? mailSenderProvider.getIfAvailable() : null;
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
            } catch (Exception _) {
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

    @Override
    public String buildOtpHtml(String recipientName, String otp, String purpose) {
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
