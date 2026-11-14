package com.example.expensetracker.repository;

import com.example.expensetracker.dto.UserAppearanceDto;
import com.example.expensetracker.model.AdminAuditLog;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.Role;
import com.example.expensetracker.model.User;
import com.example.expensetracker.service.UserAppearanceService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The normal suite runs on H2 in "PostgreSQL mode", which accepts things a real PostgreSQL rejects. This runs
 * the code paths the admin console and the appearance (wallpaper) sync use against a REAL PostgreSQL, with
 * the same {@code ddl-auto=update} production uses.
 *
 * Only runs when POSTGRES_IT_URL is set (the CI job that starts a PostgreSQL service sets it), so the
 * ordinary {@code mvn test} is unchanged. The test class is deliberately not {@code @Transactional}: the
 * services are transactional themselves, and a test-wide transaction would hide failures that only show
 * when a value is read outside one.
 */
@SpringBootTest
@ActiveProfiles("test")
@EnabledIfEnvironmentVariable(named = "POSTGRES_IT_URL", matches = ".+")
class PostgresCompatibilityIT {

    @DynamicPropertySource
    static void postgres(DynamicPropertyRegistry registry) {
        String url = System.getenv("POSTGRES_IT_URL");
        if (url == null || url.isBlank()) {
            return;
        }
        registry.add("spring.datasource.url", () -> url);
        registry.add("spring.datasource.username", () -> System.getenv().getOrDefault("POSTGRES_IT_USER", "postgres"));
        registry.add("spring.datasource.password", () -> System.getenv().getOrDefault("POSTGRES_IT_PASSWORD", "postgres"));
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        registry.add("spring.jpa.database-platform", () -> "org.hibernate.dialect.PostgreSQLDialect");
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "update");
        // The app builds an emergency H2 file database next to the primary; point it at a writable temp dir
        // (production keeps it under /data, which does not exist on a CI runner).
        registry.add("app.fallback-db-path", () -> System.getProperty("java.io.tmpdir") + "/pg_it_fallback/expensetracker_fallback");
    }

    @Autowired private UserRepository userRepository;
    @Autowired private ExpenseRepository expenseRepository;
    @Autowired private AdminAuditLogRepository auditLogRepository;
    @Autowired private UserAppearanceService appearanceService;

    private User newUser(String tag) {
        long stamp = System.nanoTime();
        return userRepository.save(User.builder()
                .name("PG " + tag)
                .username("pg_" + tag + "_" + stamp)
                .email("pg_" + tag + "_" + stamp + "@test.com")
                .password("SecureP@ss123")
                .role(Role.ROLE_USER)
                .enabled(true)
                .build());
    }

    private static UserAppearanceDto appearance(String wallpaperUri, String fontData) {
        return new UserAppearanceDto("grotesk", null, fontData, "default", "#C79A3E", "#A97F2E", "#A23E32",
                "#E6C77B", "rgba(1,2,3,0.9)", "#050505", "rgba(1,2,3,0.3)", "custom", wallpaperUri, 0.35, 0);
    }

    @Test
    @DisplayName("appearance: a large wallpaper data URI is stored and read back intact")
    void appearanceStoresALargeWallpaper() {
        User user = newUser("wall");
        String wallpaper = "data:image/jpeg;base64," + "QUJD".repeat(375_000); // ~1.5 MB, like a synced wallpaper
        appearanceService.updateAppearance(user.getId(), appearance(wallpaper, null));

        UserAppearanceDto read = appearanceService.getAppearance(user.getId());
        assertNotNull(read.wallpaperUri());
        assertEquals(wallpaper.length(), read.wallpaperUri().length());
        assertEquals(wallpaper, read.wallpaperUri());
    }

    @Test
    @DisplayName("appearance: a second save replaces the wallpaper and clears it with an empty string")
    void appearanceUpdatesAndClears() {
        User user = newUser("upd");
        appearanceService.updateAppearance(user.getId(), appearance("data:image/png;base64,QUJD", "AAAA"));
        appearanceService.updateAppearance(user.getId(), appearance("https://example.com/a.jpg", null));
        assertEquals("https://example.com/a.jpg", appearanceService.getAppearance(user.getId()).wallpaperUri());

        appearanceService.updateAppearance(user.getId(), appearance("", null));
        String cleared = appearanceService.getAppearance(user.getId()).wallpaperUri();
        assertTrue(cleared == null || cleared.isEmpty(), "empty string must clear the wallpaper, got: " + cleared);
    }

    @Test
    @DisplayName("appearance: reading a user with no saved appearance does not fail")
    void appearanceForUserWithoutRow() {
        User user = newUser("none");
        assertNotNull(appearanceService.getAppearance(user.getId()));
    }

    @Test
    @DisplayName("admin users list: the default listing (no search text, no role) works")
    void adminUserListWithNoFilters() {
        User user = newUser("list");
        Page<User> page = userRepository.searchUsers(null, null, PageRequest.of(0, 15));
        assertTrue(page.getTotalElements() >= 1);
        assertTrue(page.getContent().stream().anyMatch(u -> u.getId().equals(user.getId())));
    }

    @Test
    @DisplayName("admin users list: search text and a role filter work, together and apart")
    void adminUserListWithFilters() {
        User user = newUser("find");
        assertTrue(userRepository.searchUsers("pg_find", null, PageRequest.of(0, 15)).getContent()
                .stream().anyMatch(u -> u.getId().equals(user.getId())));
        assertTrue(userRepository.searchUsers("PG_FIND", Role.ROLE_USER, PageRequest.of(0, 15)).getContent()
                .stream().anyMatch(u -> u.getId().equals(user.getId())));
        assertTrue(userRepository.searchUsers(null, Role.ROLE_USER, PageRequest.of(0, 15)).getTotalElements() >= 1);
        assertEquals(0, userRepository.searchUsers("no-such-user-xyz", null, PageRequest.of(0, 15)).getTotalElements());
    }

    @Test
    @DisplayName("admin users list: a FULL page (so Spring Data also runs the separate count query) with no filters")
    void adminUserListCountQueryWithNoFilters() {
        newUser("c1");
        newUser("c2");
        newUser("c3");
        // size 1 with several users: the page is full, so a count query runs in addition to the content query
        Page<User> page = userRepository.searchUsers(null, null, PageRequest.of(0, 1));
        assertEquals(1, page.getContent().size());
        assertTrue(page.getTotalElements() >= 3);
        Page<User> byRole = userRepository.searchUsers(null, Role.ROLE_USER, PageRequest.of(0, 1));
        assertTrue(byRole.getTotalElements() >= 3);
        Page<User> byText = userRepository.searchUsers("pg_c", null, PageRequest.of(0, 1));
        assertTrue(byText.getTotalElements() >= 3);
    }

    @Test
    @DisplayName("admin audit log: the default listing and a text search work")
    void adminAuditLogSearch() {
        auditLogRepository.save(AdminAuditLog.builder()
                .actorId(1L).actorUsername("pg_admin").action("PG_TEST").targetResource("USER").build());
        assertTrue(auditLogRepository.searchLogs(null, PageRequest.of(0, 15)).getTotalElements() >= 1);
        assertTrue(auditLogRepository.searchLogs("pg_test", PageRequest.of(0, 15)).getTotalElements() >= 1);
    }

    @Test
    @DisplayName("per-user expense count (used for every row of the admin users list)")
    void expenseCountPerUser() {
        User user = newUser("cnt");
        for (int i = 0; i < 3; i++) {
            expenseRepository.save(Expense.builder().amount(new BigDecimal("10.00")).description("pg " + i)
                    .expenseDate(LocalDate.now()).user(user).build());
        }
        assertEquals(3L, expenseRepository.countByUser(user));
    }

    @Test
    @DisplayName("grouped expense counts for a page of users in one query (users without expenses are absent)")
    void groupedExpenseCounts() {
        User busy = newUser("busy");
        User idle = newUser("idle");
        for (int i = 0; i < 4; i++) {
            expenseRepository.save(Expense.builder().amount(new BigDecimal("5.00")).description("g " + i)
                    .expenseDate(LocalDate.now()).user(busy).build());
        }
        java.util.Map<Long, Long> counts = new java.util.HashMap<>();
        for (Object[] row : expenseRepository.countByUserIds(java.util.List.of(busy.getId(), idle.getId()))) {
            counts.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
        }
        assertEquals(4L, counts.get(busy.getId()));
        assertEquals(null, counts.get(idle.getId()));
    }
}
