package com.example.expensetracker.config;

import com.example.expensetracker.resilience.ResilientRoutingDataSource;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;
import java.io.File;

/**
 * Provides a local emergency datastore for environments where the primary database
 * becomes temporarily unreachable. The local store is NOT treated as a replica:
 * it is a mirror that is refreshed while the primary is healthy, and whatever is written
 * to it during an outage is merged back into the primary when it recovers (see
 * {@link com.example.expensetracker.resilience.FallbackRecoveryCoordinator}).
 * Production authority remains Neon PostgreSQL.
 */
@Slf4j
@Configuration
public class ResilientFallbackDataSourceConfig {

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
        primaryConfig.setConnectionTimeout(15000);
        primaryConfig.setValidationTimeout(5000);
        primaryConfig.setConnectionTestQuery("SELECT 1");
        primaryConfig.setInitializationFailTimeout(-1);
        primaryConfig.setMaximumPoolSize(10);
        primaryConfig.setMinimumIdle(0);
        primaryConfig.setPoolName("PrimaryHikariPool");

        if (primaryUrl != null && (primaryUrl.contains("postgresql") || primaryUrl.contains("neon.tech"))) {
            primaryConfig.addDataSourceProperty("sslmode", "require");
            primaryConfig.addDataSourceProperty("connectTimeout", "15");
            primaryConfig.addDataSourceProperty("socketTimeout", "30");
            primaryConfig.addDataSourceProperty("ApplicationName", "ExpenseTrackerPro");
        }

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
}
