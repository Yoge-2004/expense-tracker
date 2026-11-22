package com.example.expensetracker.infrastructure.resilience;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Type-safe configuration properties record for Hugging Face database backup and failover resilience.
 *
 * @author Yogeshwaran
 */
@ConfigurationProperties(prefix = "hf.db")
public record HfDatabaseProperties(
        String token,
        String space,
        String path,
        String repoType,
        String encryptionKey,
        int maxShrinkPercent,
        int minCommitIntervalMinutes,
        String volatileTables
) {
    private static final String DEFAULT_SPACE = "Yoge-2004/expense-tracker-backend";
    private static final String DEFAULT_PATH = "database/expense_tracker.sqlite.enc";
    private static final String DEFAULT_VOLATILE = "webauthn_challenges,password_reset_otp,platform_daily_metrics,app_notifications,admin_audit_logs,monthly_report_logs,device_tokens";

    public HfDatabaseProperties {
        if (space == null || space.isBlank()) space = DEFAULT_SPACE;
        if (path == null || path.isBlank()) path = DEFAULT_PATH;
        if (repoType == null || repoType.isBlank()) repoType = "space";
        if (maxShrinkPercent <= 0) maxShrinkPercent = 30;
        if (minCommitIntervalMinutes <= 0) minCommitIntervalMinutes = 30;
        if (volatileTables == null || volatileTables.isBlank()) volatileTables = DEFAULT_VOLATILE;
        if (token == null) token = "";
        if (encryptionKey == null) encryptionKey = "";
    }
}
