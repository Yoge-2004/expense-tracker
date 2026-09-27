package com.example.expensetracker.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationStartedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Statement;

/**
 * Applies idempotent schema initialization on application startup for columns
 * across application entities (e.g. {@code currency}, {@code account_locked},
 * {@code security_pin_hash}, or {@code enabled} on {@link com.example.expensetracker.model.User}).
 *
 * <p><b>Database Portability:</b> Executes {@code ALTER TABLE ... ADD COLUMN IF NOT EXISTS}
 * for PostgreSQL environments. Non-Postgres test environments catch non-fatal DDL errors gracefully,
 * where schema setup is managed by JPA {@code ddl-auto}.</p>
 *
 * <p>Runs via {@link ApplicationStartedEvent} at {@code @Order(1)} to guarantee all required
 * schema columns are initialized before dependent services execute.</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DatabaseMigrationConfig {

    private final DataSource dataSource;

    @EventListener(ApplicationStartedEvent.class)
    @Order(1)
    public void runSchemaMigrations() {
        log.info("Checking and applying database schema migrations...");
        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement()) {

            // Ensure required columns exist in PostgreSQL users table
            try {
                //noinspection SqlNoDataSourceInspection
                stmt.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR'");
                log.info("Verified 'currency' column in users table.");
            } catch (Exception e) {
                log.warn("Migration warning on users.currency: {}", e.getMessage());
            }

            try {
                //noinspection SqlNoDataSourceInspection
                stmt.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS account_locked BOOLEAN DEFAULT FALSE");
            } catch (Exception e) {
                log.warn("Migration warning on users.account_locked: {}", e.getMessage());
            }

            try {
                //noinspection SqlNoDataSourceInspection
                stmt.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT TRUE");
            } catch (Exception e) {
                log.warn("Migration warning on users.enabled: {}", e.getMessage());
            }

            try {
                //noinspection SqlNoDataSourceInspection
                stmt.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS security_pin_hash VARCHAR(255)");
            } catch (Exception e) {
                log.warn("Migration warning on users.security_pin_hash: {}", e.getMessage());
            }

            try {
                //noinspection SqlNoDataSourceInspection
                stmt.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_pin_attempts INT DEFAULT 0");
            } catch (Exception e) {
                log.warn("Migration warning on users.failed_pin_attempts: {}", e.getMessage());
            }

            try {
                //noinspection SqlNoDataSourceInspection
                stmt.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_locked_until TIMESTAMP");
            } catch (Exception e) {
                log.warn("Migration warning on users.pin_locked_until: {}", e.getMessage());
            }

        } catch (Exception e) {
            log.warn("Database schema migration notice: {}", e.getMessage());
        }
    }
}
