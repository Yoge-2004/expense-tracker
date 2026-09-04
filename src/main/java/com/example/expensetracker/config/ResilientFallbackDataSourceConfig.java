package com.example.expensetracker.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.datasource.AbstractDataSource;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Custom DataSource configuration that provides seamless fallback to a local file database
 * if the primary database (Neon PostgreSQL) is down, unreachable, or sleeping.
 */
@Configuration
public class ResilientFallbackDataSourceConfig {

    private static final Logger log = LoggerFactory.getLogger(ResilientFallbackDataSourceConfig.class);

    @Value("${spring.datasource.url:jdbc:h2:mem:expensetrackerdb}")
    private String primaryUrl;

    @Value("${spring.datasource.driver-class-name:org.h2.Driver}")
    private String primaryDriver;

    @Value("${spring.datasource.username:sa}")
    private String primaryUsername;

    @Value("${spring.datasource.password:}")
    private String primaryPassword;

    @Bean
    @Primary
    public DataSource dataSource() {
        // Build Primary DataSource (Neon PostgreSQL / configured DB)
        HikariConfig primaryConfig = new HikariConfig();
        primaryConfig.setJdbcUrl(primaryUrl);
        primaryConfig.setDriverClassName(primaryDriver);
        primaryConfig.setUsername(primaryUsername);
        primaryConfig.setPassword(primaryPassword);
        primaryConfig.setConnectionTimeout(5000); // 5s fast fail to trigger fallback
        primaryConfig.setInitializationFailTimeout(-1); // Do not crash startup if remote DB is asleep
        primaryConfig.setMaximumPoolSize(10);
        primaryConfig.setMinimumIdle(0);
        primaryConfig.setPoolName("PrimaryHikariPool");

        HikariDataSource primaryDs;
        try {
            primaryDs = new HikariDataSource(primaryConfig);
        } catch (Exception e) {
            log.warn("Failed to initialize primary Hikari pool directly: {}", e.getMessage());
            primaryDs = null;
        }

        // If primary DB is an H2 database (in-memory test or local file), do not attach a separate fallback DB
        if (primaryUrl != null && primaryUrl.contains(":h2:")) {
            return primaryDs;
        }

        // Build Fallback DataSource (Local H2 File DB)
        HikariConfig fallbackConfig = new HikariConfig();
        fallbackConfig.setJdbcUrl("jdbc:h2:file:./expensetracker_fallback;AUTO_SERVER=TRUE;MODE=PostgreSQL");
        fallbackConfig.setDriverClassName("org.h2.Driver");
        fallbackConfig.setUsername("sa");
        fallbackConfig.setPassword("");
        fallbackConfig.setConnectionTimeout(5000);
        fallbackConfig.setMaximumPoolSize(10);
        fallbackConfig.setPoolName("FallbackHikariPool");
        HikariDataSource fallbackDs = new HikariDataSource(fallbackConfig);

        return new ResilientRoutingDataSource(primaryDs, fallbackDs);
    }

    /**
     * Smart routing DataSource that uses Primary DS when healthy, but transparently switches
     * to Fallback DS if Primary fails to supply a connection.
     */
    private static class ResilientRoutingDataSource extends AbstractDataSource {

        private final DataSource primaryDs;
        private final DataSource fallbackDs;
        private final AtomicBoolean primaryUnavailable = new AtomicBoolean(false);

        public ResilientRoutingDataSource(DataSource primaryDs, DataSource fallbackDs) {
            this.primaryDs = primaryDs;
            this.fallbackDs = fallbackDs;
        }

        @Override
        public Connection getConnection() throws SQLException {
            if (primaryDs != null && !primaryUnavailable.get()) {
                try {
                    Connection conn = primaryDs.getConnection();
                    if (conn != null && conn.isValid(2)) {
                        return conn;
                    }
                } catch (Exception e) {
                    log.warn("Primary database connection failed ({}), switching to local HF Spaces database fallback...", e.getMessage());
                    primaryUnavailable.set(true);
                }
            }
            log.info("Serving connection from local HF Spaces fallback database.");
            return fallbackDs.getConnection();
        }

        @Override
        public Connection getConnection(String username, String password) throws SQLException {
            if (primaryDs != null && !primaryUnavailable.get()) {
                try {
                    Connection conn = primaryDs.getConnection(username, password);
                    if (conn != null && conn.isValid(2)) {
                        return conn;
                    }
                } catch (Exception e) {
                    log.warn("Primary database connection failed ({}), switching to local HF Spaces database fallback...", e.getMessage());
                    primaryUnavailable.set(true);
                }
            }
            return fallbackDs.getConnection(username, password);
        }
    }
}
