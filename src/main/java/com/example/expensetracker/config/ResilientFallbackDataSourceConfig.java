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
import java.io.File;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Provides a local emergency datastore for environments where the primary database
 * becomes temporarily unreachable. The local store is NOT treated as a replica:
 * it is only safe for recovery when it has been populated by an explicit backup/
 * restore process. Production authority remains Neon PostgreSQL.
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

    @Value("${app.fallback-db-path:${DATA_DIR:/data}/expensetracker_fallback}")
    private String fallbackDbPath;

    @Bean
    @Primary
    public DataSource dataSource() {
        HikariConfig primaryConfig = new HikariConfig();
        primaryConfig.setJdbcUrl(primaryUrl);
        primaryConfig.setDriverClassName(primaryDriver);
        primaryConfig.setUsername(primaryUsername);
        primaryConfig.setPassword(primaryPassword);
        primaryConfig.setConnectionTimeout(5000);
        primaryConfig.setInitializationFailTimeout(-1);
        primaryConfig.setMaximumPoolSize(10);
        primaryConfig.setMinimumIdle(0);
        primaryConfig.setPoolName("PrimaryHikariPool");

        HikariDataSource primaryDs;
        try {
            primaryDs = new HikariDataSource(primaryConfig);
        } catch (Exception e) {
            log.warn("Primary database pool could not initialize: {}", e.getMessage());
            primaryDs = null;
        }

        if (primaryUrl != null && primaryUrl.contains(":h2:")) {
            return primaryDs;
        }

        File fallbackFile = new File(fallbackDbPath).getAbsoluteFile();
        File parent = fallbackFile.getParentFile();
        if (parent != null && !parent.exists() && !parent.mkdirs()) {
            log.warn("Could not create fallback database directory: {}", parent);
        }

        HikariConfig fallbackConfig = new HikariConfig();
        fallbackConfig.setJdbcUrl("jdbc:h2:file:" + fallbackFile.getPath() + ";AUTO_SERVER=TRUE;MODE=PostgreSQL");
        fallbackConfig.setDriverClassName("org.h2.Driver");
        fallbackConfig.setUsername("sa");
        fallbackConfig.setPassword("");
        fallbackConfig.setConnectionTimeout(5000);
        fallbackConfig.setMaximumPoolSize(10);
        fallbackConfig.setMinimumIdle(0);
        fallbackConfig.setPoolName("FallbackHikariPool");
        HikariDataSource fallbackDs = new HikariDataSource(fallbackConfig);

        log.info("Emergency fallback database path: {}", fallbackFile);
        return new ResilientRoutingDataSource(primaryDs, fallbackDs);
    }

    private static class ResilientRoutingDataSource extends AbstractDataSource {
        private final DataSource primaryDs;
        private final DataSource fallbackDs;
        private final AtomicBoolean primaryUnavailable = new AtomicBoolean(false);

        ResilientRoutingDataSource(DataSource primaryDs, DataSource fallbackDs) {
            this.primaryDs = primaryDs;
            this.fallbackDs = fallbackDs;
        }

        @Override
        public Connection getConnection() throws SQLException {
            if (primaryDs != null && !primaryUnavailable.get()) {
                try {
                    Connection conn = primaryDs.getConnection();
                    if (conn != null && conn.isValid(2)) return conn;
                } catch (Exception e) {
                    log.warn("Primary database unavailable; entering emergency fallback mode: {}", e.getMessage());
                    primaryUnavailable.set(true);
                }
            }
            log.warn("Serving the emergency local datastore. This is only a recovery store and may be stale.");
            return fallbackDs.getConnection();
        }

        @Override
        public Connection getConnection(String username, String password) throws SQLException {
            if (primaryDs != null && !primaryUnavailable.get()) {
                try {
                    Connection conn = primaryDs.getConnection(username, password);
                    if (conn != null && conn.isValid(2)) return conn;
                } catch (Exception e) {
                    log.warn("Primary database unavailable; entering emergency fallback mode: {}", e.getMessage());
                    primaryUnavailable.set(true);
                }
            }
            return fallbackDs.getConnection(username, password);
        }
    }
}
