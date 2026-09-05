package com.example.expensetracker.cucumber.steps;

import com.example.expensetracker.security.RateLimiterService;
import io.cucumber.java.Before;
import io.restassured.RestAssured;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.jdbc.core.JdbcTemplate;

public class Hooks {

    @LocalServerPort
    private int port;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired(required = false)
    private CacheManager cacheManager;

    @Autowired(required = false)
    private RateLimiterService rateLimiterService;

    @Before(order = 0)
    public void setup() {
        // Configure RestAssured
        RestAssured.baseURI  = "http://localhost";
        RestAssured.port     = port;
        RestAssured.basePath = "";

        // Reset rate limiter buckets
        if (rateLimiterService != null) {
            rateLimiterService.clearAll();
        }

        // Clear application caches
        clearCaches();

        // Cleanup database
        cleanupDatabase();

        // Seed global categories if they don't exist
        seedCategories();
    }

    private void clearCaches() {
        if (cacheManager != null) {
            for (String cacheName : cacheManager.getCacheNames()) {
                Cache cache = cacheManager.getCache(cacheName);
                if (cache != null) {
                    cache.clear();
                }
            }
        }
    }

    private void cleanupDatabase() {
        jdbcTemplate.execute("SET REFERENTIAL_INTEGRITY FALSE");
        jdbcTemplate.execute("TRUNCATE TABLE password_reset_otp RESTART IDENTITY");
        jdbcTemplate.execute("TRUNCATE TABLE budget RESTART IDENTITY");
        jdbcTemplate.execute("TRUNCATE TABLE recurring_expense RESTART IDENTITY");
        jdbcTemplate.execute("TRUNCATE TABLE savings_goals RESTART IDENTITY");
        jdbcTemplate.execute("TRUNCATE TABLE incomes RESTART IDENTITY");
        jdbcTemplate.execute("TRUNCATE TABLE expenses RESTART IDENTITY");
        jdbcTemplate.execute("TRUNCATE TABLE categories RESTART IDENTITY");
        jdbcTemplate.execute("TRUNCATE TABLE users RESTART IDENTITY");
        jdbcTemplate.execute("SET REFERENTIAL_INTEGRITY TRUE");
    }

    private void seedCategories() {
        String[] categories = {"Food", "Transport", "Utilities", "Entertainment", "Health"};
        for (String cat : categories) {
            jdbcTemplate.update(
                "INSERT INTO categories (name, user_id, created_at, updated_at) " +
                "SELECT ?, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP " +
                "WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = ?)",
                cat, cat
            );
        }
    }
}
