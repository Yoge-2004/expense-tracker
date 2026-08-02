package com.example.expensetracker.config;

import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.concurrent.ConcurrentMapCache;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * Application-level cache configuration.
 *
 * <h3>Why This Matters for Neon Free Tier</h3>
 * <p>Neon's free tier provides <strong>100 compute-unit hours per project per month</strong>
 * and <strong>0.5 GB storage</strong>. Every SQL query against a suspended or cold
 * Neon compute incurs a cold-start penalty (1–3 seconds). Caching the most
 * frequently read data — user expense lists and category lists — dramatically
 * reduces the number of round-trips to Neon, which:</p>
 * <ul>
 *   <li>Extends the monthly 100 CU-hour budget (each query wakes up compute)</li>
 *   <li>Eliminates cold-start latency on repeated dashboard loads</li>
 *   <li>Keeps storage I/O within the free tier's 0.5 GB limit by reducing WAL pressure</li>
 * </ul>
 *
 * <h3>Cache Strategy</h3>
 * <p>Uses Spring's built-in {@link ConcurrentMapCacheManager} (in-memory, JVM-local).
 * This is sufficient for a single-instance HF Spaces deployment. For multi-instance
 * deployments, swap this with a Redis {@code RedisCacheManager} bean.</p>
 *
 * <h3>Cache Names</h3>
 * <ul>
 *   <li>{@code userExpenses}   — per-user expense lists; key = userId</li>
 *   <li>{@code userCategories} — per-user category lists; key = userId</li>
 *   <li>{@code globalCategories} — global/system categories (single entry)</li>
 *   <li>{@code budgetStatus}   — budget status per user; key = userId</li>
 * </ul>
 *
 * <h3>Cache Invalidation</h3>
 * <p>Each service method that mutates data is annotated with {@code @CacheEvict}
 * targeting the relevant cache keys. This ensures consistency — reads are always
 * served fresh after any write.</p>
 */
@Configuration
public class CacheConfig implements CachingConfigurer {

    /**
     * Declares all named caches used across the application.
     *
     * <p>{@link ConcurrentMapCacheManager} is the default in-memory cache provider
     * included with Spring Boot's autoconfiguration. It uses
     * {@link java.util.concurrent.ConcurrentHashMap} under the hood, meaning:
     * <ul>
     *   <li>No external dependencies or Docker services required</li>
     *   <li>Cache is local to the JVM — not shared across instances</li>
     *   <li>Entries are evicted only by explicit {@code @CacheEvict} calls</li>
     *   <li>All data is lost on application restart (warm-up on first request)</li>
     * </ul>
     * </p>
     *
     * <p>If you later want TTL-based expiry, replace this with a Caffeine or
     * Redis cache manager. Example Caffeine config:
     * <pre>{@code
     * return new CaffeineCacheManager("userExpenses", "globalCategories", ...)
     *         .loadingCache(Caffeine.newBuilder().expireAfterWrite(10, MINUTES)::build);
     * }</pre>
     * </p>
     *
     * @return a configured {@link CacheManager} with all required cache regions
     */
    @Bean
    @Override
    public CacheManager cacheManager() {
        ConcurrentMapCacheManager manager = new ConcurrentMapCacheManager();
        manager.setCacheNames(List.of(
                "userExpenses",       // expense list per user (most frequent read)
                "userCategories",     // per-user custom categories
                "globalCategories",   // system categories (rarely change)
                "budgetStatus"        // budget % per user
        ));
        // Allow dynamic creation of unlisted caches (safe fallback)
        manager.setAllowNullValues(false);
        return manager;
    }

    /**
     * Registers individual cache regions explicitly.
     * This ensures caches are available immediately without lazy initialization.
     *
     * @return array of Spring {@link ConcurrentMapCache} instances
     */
    @Bean
    public List<ConcurrentMapCache> cacheRegions() {
        return List.of(
                new ConcurrentMapCache("userExpenses"),
                new ConcurrentMapCache("userCategories"),
                new ConcurrentMapCache("globalCategories"),
                new ConcurrentMapCache("budgetStatus")
        );
    }
}
