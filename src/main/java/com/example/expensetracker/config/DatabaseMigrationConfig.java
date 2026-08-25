package com.example.expensetracker.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationStartedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Statement;

/**
 * Applies lightweight, idempotent schema patches on startup for columns that
 * may be missing from an older database (e.g. a Space that's been running
 * since before {@code currency}, {@code account_locked}, or {@code enabled}
 * were added to {@link com.example.expensetracker.model.User}).
 *
 * <p><b>PostgreSQL-specific:</b> uses {@code ALTER TABLE ... ADD COLUMN IF NOT
 * EXISTS}, which is Postgres syntax. Against a different database engine
 * (e.g. H2 in tests) each statement's exception is caught and logged as a
 * warning rather than failing startup, so this silently does nothing useful
 * there — schema setup for non-Postgres environments relies on JPA's own
 * {@code ddl-auto} instead.</p>
 *
 * <p>Runs via {@link ApplicationStartedEvent} at {@code @Order(1)}, before
 * most other startup logic, so later beans can assume these columns exist.</p>
 */
@Component
public class DatabaseMigrationConfig {

    private static final Logger log = LoggerFactory.getLogger(DatabaseMigrationConfig.class);
    private final DataSource dataSource;

    public DatabaseMigrationConfig(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @EventListener(ApplicationStartedEvent.class)
    @Order(1)
    public void runSchemaMigrations() {
        log.info("Checking and applying database schema migrations...");
        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement()) {

            // Ensure missing columns exist in PostgreSQL users table
            try {
                stmt.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR'");
                log.info("Verified 'currency' column in users table.");
            } catch (Exception e) {
                log.warn("Migration warning on users.currency: {}", e.getMessage());
            }

            try {
                stmt.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS account_locked BOOLEAN DEFAULT FALSE");
            } catch (Exception e) {
                log.warn("Migration warning on users.account_locked: {}", e.getMessage());
            }

            try {
                stmt.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT TRUE");
            } catch (Exception e) {
                log.warn("Migration warning on users.enabled: {}", e.getMessage());
            }

        } catch (Exception e) {
            log.warn("Database schema migration notice: {}", e.getMessage());
        }
    }
}
