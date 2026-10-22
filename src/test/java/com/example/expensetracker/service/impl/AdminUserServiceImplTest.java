package com.example.expensetracker.service.impl;

import com.example.expensetracker.dto.AdminPermissionsDto;
import com.example.expensetracker.dto.AdminUserDetailDto;
import com.example.expensetracker.dto.AdminUserRoleUpdateRequest;
import com.example.expensetracker.dto.AdminUserStatusUpdateRequest;
import com.example.expensetracker.exception.BadRequestException;
import com.example.expensetracker.model.Role;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.DeviceTokenRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.IncomeRepository;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.service.AdminAuditService;
import com.example.expensetracker.service.AdminMetricsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminUserServiceImplTest {

    @Mock UserRepository userRepository;
    @Mock ExpenseRepository expenseRepository;
    @Mock IncomeRepository incomeRepository;
    @Mock DeviceTokenRepository deviceTokenRepository;
    @Mock AdminAuditService auditService;
    @Mock AdminMetricsService metricsService;
    @Mock PasswordEncoder passwordEncoder;

    @InjectMocks AdminUserServiceImpl adminUserService;

    private User superAdmin;
    private User normalAdmin;
    private User normalUser;

    @BeforeEach
    void setUp() {
        superAdmin = User.builder()
                .id(1L)
                .name("Super Admin")
                .username("superadmin")
                .email("super@test.com")
                .role(Role.ROLE_SUPER_ADMIN)
                .securityPinHash("hashedPin")
                .enabled(true)
                .accountLocked(false)
                .build();

        normalAdmin = User.builder()
                .id(2L)
                .name("Standard Admin")
                .username("stdadmin")
                .email("admin@test.com")
                .role(Role.ROLE_ADMIN)
                .securityPinHash("hashedPin")
                .enabled(true)
                .accountLocked(false)
                .build();

        normalUser = User.builder()
                .id(3L)
                .name("Regular User")
                .username("reguser")
                .email("user@test.com")
                .role(Role.ROLE_USER)
                .failedPinAttempts(5)
                .enabled(true)
                .accountLocked(false)
                .build();
    }

    @Test
    void getUserDetailsReturnsCompleteInspection() {
        when(userRepository.findById(3L)).thenReturn(Optional.of(normalUser));
        when(expenseRepository.countByUser(normalUser)).thenReturn(10L);
        when(expenseRepository.sumTotalExpensesAmountByUser(normalUser)).thenReturn(new BigDecimal("1500.00"));
        when(incomeRepository.countByUser(normalUser)).thenReturn(2L);
        when(incomeRepository.sumTotalIncomesAmountByUser(normalUser)).thenReturn(new BigDecimal("4000.00"));
        when(deviceTokenRepository.countByUser(normalUser)).thenReturn(1L);

        AdminUserDetailDto details = adminUserService.getUserDetails(3L);

        assertEquals(10L, details.expenseCount());
        assertEquals(new BigDecimal("1500.00"), details.totalExpenseSum());
        assertEquals(2L, details.incomeCount());
        assertEquals(1L, details.deviceTokensCount());
        assertEquals(5, details.failedPinAttempts());
    }

    @Test
    void resetPinLockoutClearsFailedAttempts() {
        when(userRepository.findById(3L)).thenReturn(Optional.of(normalUser));

        adminUserService.resetPinLockout(3L, superAdmin, "127.0.0.1", "test-ua");

        assertEquals(0, normalUser.getFailedPinAttempts());
        assertNull(normalUser.getPinLockedUntil());
        verify(userRepository).save(normalUser);
        verify(auditService).recordAction(eq(1L), any(), eq("RESET_PIN_LOCKOUT"), eq("USER"), eq("3"), any(), any(), any());
    }

    @Test
    void getPermissionsReflectsExactCapabilities() {
        AdminPermissionsDto superPerm = adminUserService.getPermissions(superAdmin);
        assertTrue(superPerm.canModifyRoles());
        assertTrue(superPerm.canTriggerFailover());

        AdminPermissionsDto adminPerm = adminUserService.getPermissions(normalAdmin);
        assertFalse(adminPerm.canModifyRoles());
        assertFalse(adminPerm.canTriggerFailover());
        assertTrue(adminPerm.canManageUsers());
        assertTrue(adminPerm.canBroadcastNotifications());

        AdminPermissionsDto userPerm = adminUserService.getPermissions(normalUser);
        assertFalse(userPerm.canManageUsers());
        assertFalse(userPerm.canModifyRoles());
    }

    @Test
    void cannotLockOwnAccount() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(superAdmin));

        AdminUserStatusUpdateRequest req = new AdminUserStatusUpdateRequest(true, null, "Lock me");
        assertThrows(BadRequestException.class, () ->
                adminUserService.updateUserStatus(1L, req, superAdmin, "127.0.0.1", "test-ua"));
    }

    @Test
    void standardAdminCannotLockSuperAdmin() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(superAdmin));

        AdminUserStatusUpdateRequest req = new AdminUserStatusUpdateRequest(true, null, "Try to lock super admin");
        assertThrows(BadRequestException.class, () ->
                adminUserService.updateUserStatus(1L, req, normalAdmin, "127.0.0.1", "test-ua"));
    }

    @Test
    void superAdminCanLockRegularUser() {
        when(userRepository.findById(3L)).thenReturn(Optional.of(normalUser));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AdminUserStatusUpdateRequest req = new AdminUserStatusUpdateRequest(true, null, "Compromised account");
        var result = adminUserService.updateUserStatus(3L, req, superAdmin, "127.0.0.1", "test-ua");

        assertTrue(result.accountLocked());
        verify(auditService).recordAction(eq(1L), any(), eq("UPDATE_USER_STATUS"), eq("USER"), eq("3"), any(), any(), any());
    }

    @Test
    void roleUpdateFailsWhenActorIsNotSuperAdmin() {
        AdminUserRoleUpdateRequest req = new AdminUserRoleUpdateRequest(Role.ROLE_ADMIN, "123456", "Elevate");
        assertThrows(BadRequestException.class, () ->
                adminUserService.updateUserRole(3L, req, normalAdmin, "127.0.0.1", "test-ua"));
    }

    @Test
    void roleUpdateFailsWhenStepUpPinIsInvalid() {
        when(passwordEncoder.matches("wrong", "hashedPin")).thenReturn(false);

        AdminUserRoleUpdateRequest req = new AdminUserRoleUpdateRequest(Role.ROLE_ADMIN, "wrong", "Elevate");
        assertThrows(BadRequestException.class, () ->
                adminUserService.updateUserRole(3L, req, superAdmin, "127.0.0.1", "test-ua"));
    }

    @Test
    void roleUpdateSucceedsWhenSuperAdminProvidesValidPin() {
        when(passwordEncoder.matches("123456", "hashedPin")).thenReturn(true);
        when(userRepository.findById(3L)).thenReturn(Optional.of(normalUser));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AdminUserRoleUpdateRequest req = new AdminUserRoleUpdateRequest(Role.ROLE_ADMIN, "123456", "Promotion");
        var result = adminUserService.updateUserRole(3L, req, superAdmin, "127.0.0.1", "test-ua");

        assertEquals("ROLE_ADMIN", result.role());
        verify(auditService).recordAction(eq(1L), any(), eq("UPDATE_USER_ROLE"), eq("USER"), eq("3"), any(), any(), any());
    }

    @Test
    void cannotDemoteLastRemainingSuperAdmin() {
        when(passwordEncoder.matches("123456", "hashedPin")).thenReturn(true);
        when(userRepository.findById(1L)).thenReturn(Optional.of(superAdmin));
        when(userRepository.countByRole(Role.ROLE_SUPER_ADMIN)).thenReturn(1L);

        AdminUserRoleUpdateRequest req = new AdminUserRoleUpdateRequest(Role.ROLE_USER, "123456", "Self demote");
        assertThrows(BadRequestException.class, () ->
                adminUserService.updateUserRole(1L, req, superAdmin, "127.0.0.1", "test-ua"));
    }
}
