package com.example.expensetracker.domain.report.service;

import jakarta.mail.internet.MimeMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Optional;

import com.example.expensetracker.domain.report.model.MonthlyReportLog;
import com.example.expensetracker.domain.report.repository.MonthlyReportLogRepository;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.infrastructure.exception.EmailDeliveryException;

/**
 * Dedicated collaborator handling monthly financial report email delivery and
 * persistent {@link MonthlyReportLog} outcome auditing.
 *
 * <p>Separated from {@link MonthlyReportServiceImpl} to adhere to the Single
 * Responsibility Principle (SRP).</p>
 */
@Slf4j
@Component
public class MonthlyReportDeliveryService {

    private final MonthlyReportLogRepository reportLogRepository;
    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final Clock clock;

    /**
     * Constructs the delivery collaborator.
     *
     * @param reportLogRepository repository storing dispatch outcomes
     * @param mailSenderProvider  optional mail sender provider
     * @param clock               clock used to timestamp dispatch log entries
     */
    @Autowired
    public MonthlyReportDeliveryService(
            MonthlyReportLogRepository reportLogRepository,
            ObjectProvider<JavaMailSender> mailSenderProvider,
            @Autowired(required = false) Clock clock) {
        this.reportLogRepository = reportLogRepository;
        this.mailSenderProvider = mailSenderProvider;
        this.clock = clock != null ? clock : Clock.systemDefaultZone();
    }

    /**
     * Convenience constructor defaulting {@link Clock} to {@link Clock#systemDefaultZone()}.
     *
     * @param reportLogRepository repository storing dispatch outcomes
     * @param mailSenderProvider  optional mail sender provider
     */
    public MonthlyReportDeliveryService(
            MonthlyReportLogRepository reportLogRepository,
            ObjectProvider<JavaMailSender> mailSenderProvider) {
        this(reportLogRepository, mailSenderProvider, Clock.systemDefaultZone());
    }

    /**
     * Checks whether mail transport is enabled and configured.
     *
     * @param mailEnabled        flag indicating mail delivery feature enablement
     * @param configuredMailHost configured SMTP hostname
     * @return {@code true} if ready to send emails
     */
    public boolean isDeliveryAvailable(boolean mailEnabled, String configuredMailHost) {
        return mailEnabled
                && configuredMailHost != null
                && !configuredMailHost.isBlank()
                && mailSenderProvider.getIfAvailable() != null;
    }

    /**
     * Dispatches the formatted monthly HTML email and records the success/failure audit log.
     *
     * @param user        recipient user
     * @param year        report year
     * @param month       report month
     * @param period      formatted period title
     * @param htmlContent rendered HTML report body
     */
    public void sendAndLog(User user, int year, int month, String period, String htmlContent) {
        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            recordOutcome(user, year, month, false, "JavaMailSender not available");
            throw new EmailDeliveryException("Email delivery service is currently unavailable.");
        }
        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");
            helper.setTo(user.getEmail());
            helper.setSubject(String.format("Your Monthly Financial Intelligence Report — %s", period));
            helper.setText(htmlContent, true);

            mailSender.send(mimeMessage);
            log.info("Successfully dispatched monthly report email to {} for period {}", user.getEmail(), period);
            recordOutcome(user, year, month, true, null);
        } catch (EmailDeliveryException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to send monthly report email to user {}: {}", user.getEmail(), e.getMessage(), e);
            recordOutcome(user, year, month, false, e.getMessage());
            throw new EmailDeliveryException("Could not send monthly report email: " + e.getMessage(), e);
        }
    }

    /**
     * Persists or updates the delivery attempt log for the user and reporting period.
     *
     * @param user     target user
     * @param year     report year
     * @param month    report month
     * @param success  whether dispatch succeeded
     * @param errorMsg optional error message when failed
     */
    public void recordOutcome(User user, int year, int month, boolean success, String errorMsg) {
        Optional<MonthlyReportLog> existing =
                reportLogRepository.findByUserAndReportYearAndReportMonth(user, year, month);
        MonthlyReportLog logEntry = existing.orElseGet(MonthlyReportLog::new);
        logEntry.setUser(user);
        logEntry.setReportYear(year);
        logEntry.setReportMonth(month);
        logEntry.setSentAt(LocalDateTime.now(clock));
        logEntry.setSentSuccessfully(success);
        logEntry.setErrorMessage(errorMsg);
        reportLogRepository.save(logEntry);
    }
}
