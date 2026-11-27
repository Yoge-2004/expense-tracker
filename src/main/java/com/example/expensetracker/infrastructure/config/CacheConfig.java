package com.example.expensetracker.infrastructure.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * Application-level cache configuration.
 *
 * <p>Uses Caffeine high-performance caching with bounded maximum size and
 * time-to-live eviction to avoid unbounded JVM heap consumption while eliminating
 * round-trips for hot category reads.</p>
 */
@EnableCaching
@Configuration
public class CacheConfig implements CachingConfigurer {

    /**
     * Declares all named caches used across the application with bounded Caffeine backend.
     *
     * @return a configured {@link CacheManager} with all required cache regions
     */
    @Bean
    @Override
    public CacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager(
                "userCategories",     // per-user custom categories
                "globalCategories",   // system categories (rarely change)
                "budgetStatus",       // budget % per user
                "userIncomes"         // per-user income records
        );
        manager.setCaffeine(Caffeine.newBuilder()
                .maximumSize(2000)
                .expireAfterWrite(Duration.ofMinutes(15))
                .recordStats());
        manager.setAllowNullValues(false);
        return manager;
    }
}
