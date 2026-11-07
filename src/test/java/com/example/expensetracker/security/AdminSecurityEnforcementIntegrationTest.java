package com.example.expensetracker.security;

import com.example.expensetracker.model.Role;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Real Spring Security & RBAC slice test verifying the LIVE filter chain and method security.
 * Unlike controller unit tests that disable filters (addFilters = false), this test proves
 * that unauthorized access is strictly blocked at the HTTP and role level.
 */
@SpringBootTest
@AutoConfigureMockMvc // FILTERS ARE ACTIVELY RUNNING
@ActiveProfiles("test")
class AdminSecurityEnforcementIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtService jwtService;

    private User regularUser;
    private User adminUser;
    private User superAdminUser;

    private String regularUserToken;
    private String adminToken;
    private String superAdminToken;

    @BeforeEach
    void setUp() {
        long ts = System.currentTimeMillis();

        regularUser = userRepository.save(User.builder()
                .name("Regular Joe")
                .username("regular_" + ts)
                .email("regular_" + ts + "@test.com")
                .password("Password123!")
                .role(Role.ROLE_USER)
                .enabled(true)
                .build());

        adminUser = userRepository.save(User.builder()
                .name("Admin Smith")
                .username("admin_" + ts)
                .email("admin_" + ts + "@test.com")
                .password("Password123!")
                .role(Role.ROLE_ADMIN)
                .enabled(true)
                .build());

        superAdminUser = userRepository.save(User.builder()
                .name("Super Admin Boss")
                .username("superadmin_" + ts)
                .email("superadmin_" + ts + "@test.com")
                .password("Password123!")
                .role(Role.ROLE_SUPER_ADMIN)
                .enabled(true)
                .build());

        regularUserToken = jwtService.generateToken(regularUser.getEmail());
        adminToken = jwtService.generateToken(adminUser.getEmail());
        superAdminToken = jwtService.generateToken(superAdminUser.getEmail());
    }

    @Test
    @DisplayName("Unauthenticated request to /api/admin/metrics/summary yields 401 Unauthorized")
    void unauthenticatedAdminAccess_returns401() throws Exception {
        mockMvc.perform(get("/api/admin/metrics/summary"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("ROLE_USER calling /api/admin/metrics/summary yields 403 Forbidden")
    void regularUserAdminAccess_returns403() throws Exception {
        mockMvc.perform(get("/api/admin/metrics/summary")
                        .header("Authorization", "Bearer " + regularUserToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("ROLE_ADMIN calling /api/admin/metrics/summary yields 200 OK")
    void adminUserAdminAccess_returns200() throws Exception {
        mockMvc.perform(get("/api/admin/metrics/summary")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("ROLE_ADMIN attempting SUPER_ADMIN role promotion on /api/admin/users/{id}/role yields 403 Forbidden")
    void adminCannotPromoteRoles_onlySuperAdmin() throws Exception {
        String payload = """
                {
                    "newRole": "ROLE_ADMIN",
                    "reason": "Privilege escalation attempt",
                    "stepUpPin": "123456"
                }
                """;

        // Regular admin is forbidden from modifying user roles
        mockMvc.perform(post("/api/admin/users/" + regularUser.getId() + "/role")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Unauthenticated request with malformed or bogus token yields 401 Unauthorized")
    void malformedToken_returns401() throws Exception {
        mockMvc.perform(get("/api/admin/metrics/summary")
                        .header("Authorization", "Bearer this.is.a.fake.jwt.token"))
                .andExpect(status().isUnauthorized());
    }
}
