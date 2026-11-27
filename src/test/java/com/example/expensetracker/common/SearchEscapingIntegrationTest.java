package com.example.expensetracker.common;

import com.example.expensetracker.domain.admin.model.AdminAuditLog;
import com.example.expensetracker.domain.admin.repository.AdminAuditLogRepository;
import com.example.expensetracker.domain.user.model.Role;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.domain.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests verifying SQL LIKE wildcard escaping ({@code %}, {@code _}, {@code \})
 * across JPA repository search queries under H2 PostgreSQL mode.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class SearchEscapingIntegrationTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AdminAuditLogRepository adminAuditLogRepository;

    @Test
    @DisplayName("UserRepository.searchUsers treats %, _, and backslash as literal characters")
    void userSearchEscapesSqlLikeWildcards() {
        long ts = System.nanoTime();
        User percentUser = userRepository.save(User.builder()
                .name("Save 100% Promo")
                .username("promo_" + ts)
                .email("promo_" + ts + "@test.com")
                .password("SecureP@ss123")
                .role(Role.ROLE_USER)
                .enabled(true)
                .build());
        User plainUser = userRepository.save(User.builder()
                .name("Save 100 Promo")
                .username("plain_" + ts)
                .email("plain_" + ts + "@test.com")
                .password("SecureP@ss123")
                .role(Role.ROLE_USER)
                .enabled(true)
                .build());
        User underscoreUser = userRepository.save(User.builder()
                .name("Alice_Exact")
                .username("alice_ex_" + ts)
                .email("alice_ex_" + ts + "@test.com")
                .password("SecureP@ss123")
                .role(Role.ROLE_USER)
                .enabled(true)
                .build());
        User similarUser = userRepository.save(User.builder()
                .name("AliceXExact")
                .username("alicex_" + ts)
                .email("alicex_" + ts + "@test.com")
                .password("SecureP@ss123")
                .role(Role.ROLE_USER)
                .enabled(true)
                .build());

        Page<User> percentMatches = userRepository.searchUsers("100%", null, PageRequest.of(0, 20));
        assertThat(percentMatches.getContent())
                .extracting(User::getId)
                .contains(percentUser.getId())
                .doesNotContain(plainUser.getId());

        Page<User> underscoreMatches = userRepository.searchUsers("Alice_Exact", null, PageRequest.of(0, 20));
        assertThat(underscoreMatches.getContent())
                .extracting(User::getId)
                .contains(underscoreUser.getId())
                .doesNotContain(similarUser.getId());
    }

    @Test
    @DisplayName("AdminAuditLogRepository.searchLogs treats %, _, and backslash as literal characters")
    void auditLogSearchEscapesSqlLikeWildcards() {
        adminAuditLogRepository.save(AdminAuditLog.builder()
                .actorId(1L)
                .actorUsername("ops\\admin_1")
                .action("USER_UPDATE_50%")
                .targetResource("USERS")
                .build());
        adminAuditLogRepository.save(AdminAuditLog.builder()
                .actorId(2L)
                .actorUsername("opsXadminY1")
                .action("USER_UPDATE_50X")
                .targetResource("USERS")
                .build());

        Page<AdminAuditLog> percentLogs = adminAuditLogRepository.searchLogs("50%", PageRequest.of(0, 20));
        assertThat(percentLogs.getContent())
                .hasSize(1)
                .first()
                .extracting(AdminAuditLog::getAction)
                .isEqualTo("USER_UPDATE_50%");

        Page<AdminAuditLog> backslashLogs = adminAuditLogRepository.searchLogs("ops\\admin_1", PageRequest.of(0, 20));
        assertThat(backslashLogs.getContent())
                .hasSize(1)
                .first()
                .extracting(AdminAuditLog::getActorUsername)
                .isEqualTo("ops\\admin_1");
    }
}
