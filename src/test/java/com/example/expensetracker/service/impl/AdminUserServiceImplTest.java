package com.example.expensetracker.service.impl;

import com.example.expensetracker.dto.AdminPermissionsDto;
import com.example.expensetracker.dto.AdminUserCreateRequest;
import com.example.expensetracker.dto.AdminUserDetailDto;
import com.example.expensetracker.dto.AdminUserRoleUpdateRequest;
import com.example.expensetracker.dto.AdminUserStatusUpdateRequest;
import com.example.expensetracker.dto.AdminUserUpdateRequest;
import com.example.expensetracker.exception.BadRequestException;
import com.example.expensetracker.exception.ForbiddenException;
import com.example.expensetracker.model.Role;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.DeviceTokenRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.IncomeRepository;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.security.StepUpPinVerifier;
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
    @Mock StepUpPinVerifier stepUpPinVerifier;

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
        assertThrows(ForbiddenException.class, () ->
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
        assertThrows(ForbiddenException.class, () ->
                adminUserService.updateUserRole(3L, req, normalAdmin, "127.0.0.1", "test-ua"));
    }

    @Test
    void roleUpdateFailsWhenStepUpPinIsInvalid() {
        doThrow(new BadRequestException("Invalid step-up Security PIN. Verification failed."))
                .when(stepUpPinVerifier).verify(superAdmin, "wrong");

        AdminUserRoleUpdateRequest req = new AdminUserRoleUpdateRequest(Role.ROLE_ADMIN, "wrong", "Elevate");
        assertThrows(BadRequestException.class, () ->
                adminUserService.updateUserRole(3L, req, superAdmin, "127.0.0.1", "test-ua"));
    }

    @Test
    void roleUpdateSucceedsWhenSuperAdminProvidesValidPin() {
        when(userRepository.findById(3L)).thenReturn(Optional.of(normalUser));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AdminUserRoleUpdateRequest req = new AdminUserRoleUpdateRequest(Role.ROLE_ADMIN, "123456", "Promotion");
        var result = adminUserService.updateUserRole(3L, req, superAdmin, "127.0.0.1", "test-ua");

        assertEquals("ROLE_ADMIN", result.role());
        verify(auditService).recordAction(eq(1L), any(), eq("UPDATE_USER_ROLE"), eq("USER"), eq("3"), any(), any(), any());
    }

    @Test
    void cannotDemoteLastRemainingSuperAdmin() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(superAdmin));
        when(userRepository.countByRole(Role.ROLE_SUPER_ADMIN)).thenReturn(1L);

        AdminUserRoleUpdateRequest req = new AdminUserRoleUpdateRequest(Role.ROLE_USER, "123456", "Self demote");
        assertThrows(BadRequestException.class, () ->
                adminUserService.updateUserRole(1L, req, superAdmin, "127.0.0.1", "test-ua"));
    }

    // ----- privilege-escalation regressions -----

    @Test
    void adminCannotPromoteUserToSuperAdminThroughUpdateUser() {
        when(userRepository.findById(3L)).thenReturn(Optional.of(normalUser));

        AdminUserUpdateRequest req = new AdminUserUpdateRequest(
                "Regular User", "reguser", "user@test.com", Role.ROLE_SUPER_ADMIN, null, null, null, "123456");
        assertThrows(ForbiddenException.class, () ->
                adminUserService.updateUser(3L, req, normalAdmin, "127.0.0.1", "test-ua"));

        assertEquals(Role.ROLE_USER, normalUser.getRole());
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void adminCannotPromoteThemselvesThroughUpdateUser() {
        when(userRepository.findById(2L)).thenReturn(Optional.of(normalAdmin));

        AdminUserUpdateRequest req = new AdminUserUpdateRequest(
                "Standard Admin", "stdadmin", "admin@test.com", Role.ROLE_SUPER_ADMIN, null, null, null, "123456");
        assertThrows(ForbiddenException.class, () ->
                adminUserService.updateUser(2L, req, normalAdmin, "127.0.0.1", "test-ua"));

        assertEquals(Role.ROLE_ADMIN, normalAdmin.getRole());
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void adminCannotEditSuperAdminAccount() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(superAdmin));

        AdminUserUpdateRequest req = new AdminUserUpdateRequest(
                "Super Admin", "superadmin", "super@test.com", null, null, "NewPassw0rd!", null, "123456");
        assertThrows(ForbiddenException.class, () ->
                adminUserService.updateUser(1L, req, normalAdmin, "127.0.0.1", "test-ua"));

        verify(userRepository, never()).save(any(User.class));
        verify(passwordEncoder, never()).encode(any());
    }

    @Test
    void adminCannotCreateSuperAdminOrAdminAccounts() {
        for (Role privileged : new Role[] {Role.ROLE_SUPER_ADMIN, Role.ROLE_ADMIN}) {
            AdminUserCreateRequest req = new AdminUserCreateRequest(
                    "New", "newbie", "new@test.com", "Passw0rd!x", privileged, null, "123456");
            assertThrows(ForbiddenException.class, () ->
                    adminUserService.createUser(req, normalAdmin, "127.0.0.1", "test-ua"));
        }
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void adminCannotDisableSuperAdminEvenWhenAnotherExists() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(superAdmin));

        AdminUserStatusUpdateRequest req = new AdminUserStatusUpdateRequest(null, false, "Disable");
        assertThrows(ForbiddenException.class, () ->
                adminUserService.updateUserStatus(1L, req, normalAdmin, "127.0.0.1", "test-ua"));

        assertTrue(superAdmin.isEnabled());
    }

    @Test
    void cannotDisableLastRemainingSuperAdmin() {
        User secondSuper = User.builder().id(9L).username("second").email("second@test.com")
                .role(Role.ROLE_SUPER_ADMIN).enabled(true).accountLocked(false).build();
        when(userRepository.findById(1L)).thenReturn(Optional.of(superAdmin));
        when(userRepository.countByRole(Role.ROLE_SUPER_ADMIN)).thenReturn(1L);

        AdminUserStatusUpdateRequest req = new AdminUserStatusUpdateRequest(null, false, "Disable");
        assertThrows(BadRequestException.class, () ->
                adminUserService.updateUserStatus(1L, req, secondSuper, "127.0.0.1", "test-ua"));

        assertTrue(superAdmin.isEnabled());
    }

    @Test
    void cannotDisableOwnAccount() {
        when(userRepository.findById(2L)).thenReturn(Optional.of(normalAdmin));

        AdminUserStatusUpdateRequest req = new AdminUserStatusUpdateRequest(null, false, "Disable me");
        assertThrows(BadRequestException.class, () ->
                adminUserService.updateUserStatus(2L, req, normalAdmin, "127.0.0.1", "test-ua"));
    }

    @Test
    void adminCannotResetOwnPinLockout() {
        when(userRepository.findById(2L)).thenReturn(Optional.of(normalAdmin));

        assertThrows(BadRequestException.class, () ->
                adminUserService.resetPinLockout(2L, normalAdmin, "127.0.0.1", "test-ua"));
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void supportCannotResetAdminPinLockout() {
        User support = User.builder().id(7L).username("support").email("support@test.com")
                .role(Role.ROLE_SUPPORT).enabled(true).accountLocked(false).build();
        when(userRepository.findById(2L)).thenReturn(Optional.of(normalAdmin));

        assertThrows(ForbiddenException.class, () ->
                adminUserService.resetPinLockout(2L, support, "127.0.0.1", "test-ua"));
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void supportCanResetRegularUserPinLockout() {
        User support = User.builder().id(7L).username("support").email("support@test.com")
                .role(Role.ROLE_SUPPORT).enabled(true).accountLocked(false).build();
        when(userRepository.findById(3L)).thenReturn(Optional.of(normalUser));

        adminUserService.resetPinLockout(3L, support, "127.0.0.1", "test-ua");

        assertEquals(0, normalUser.getFailedPinAttempts());
        verify(userRepository).save(normalUser);
    }
}
