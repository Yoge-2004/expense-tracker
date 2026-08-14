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
