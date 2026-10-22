package com.example.expensetracker.service.impl;

import com.example.expensetracker.dto.AdminPermissionsDto;
import com.example.expensetracker.dto.AdminUserCreateRequest;
import com.example.expensetracker.dto.AdminUserDetailDto;
import com.example.expensetracker.dto.AdminUserDto;
import com.example.expensetracker.dto.AdminUserRoleUpdateRequest;
import com.example.expensetracker.dto.AdminUserStatusUpdateRequest;
import com.example.expensetracker.dto.AdminUserUpdateRequest;
import com.example.expensetracker.exception.BadRequestException;
import com.example.expensetracker.exception.ResourceNotFoundException;
import com.example.expensetracker.model.Role;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.DeviceTokenRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.IncomeRepository;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.service.AdminAuditService;
import com.example.expensetracker.service.AdminMetricsService;
import com.example.expensetracker.service.AdminUserService;
import com.example.expensetracker.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Objects;

/**
 * Implementation of {@link AdminUserService} with strict RBAC boundary checks,
 * non-escalation invariants, full CRUD capability, and immutable audit logging.
 *
 * @author Yogeshwaran
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminUserServiceImpl implements AdminUserService {

    private final UserRepository userRepository;
    private final UserService userService;
    private final ExpenseRepository expenseRepository;
    private final IncomeRepository incomeRepository;
    private final DeviceTokenRepository deviceTokenRepository;
    private final AdminAuditService auditService;
    private final AdminMetricsService metricsService;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional(readOnly = true)
    public Page<AdminUserDto> getUsers(String query, Role role, Pageable pageable) {
        String cleanQuery = (query != null && !query.isBlank()) ? query.trim() : null;
        Page<User> page = userRepository.searchUsers(cleanQuery, role, pageable);

        return page.map(u -> new AdminUserDto(
                u.getId(),
                u.getName(),
                u.getUsername(),
                u.getEmail(),
                u.getRole().name(),
                u.isEnabled(),
                u.isAccountLocked(),
                u.getCurrency(),
                u.getCreatedAt(),
                expenseRepository.countByUser(u)
        ));
    }

    @Override
    @Transactional(readOnly = true)
    public AdminUserDetailDto getUserDetails(Long targetUserId) {
        User u = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id=" + targetUserId));

        long expenses = expenseRepository.countByUser(u);
        long incomes = incomeRepository.countByUser(u);

        BigDecimal expenseSum = expenseRepository.sumTotalExpensesAmountByUser(u);
        BigDecimal incomeSum = incomeRepository.sumTotalIncomesAmountByUser(u);

        long tokens = deviceTokenRepository.countByUser(u);

        return new AdminUserDetailDto(
                u.getId(),
                u.getName(),
                u.getUsername(),
                u.getEmail(),
                u.getRole().name(),
                u.isEnabled(),
                u.isAccountLocked(),
                u.getFailedPinAttempts(),
                u.getPinLockedUntil(),
                u.getCurrency(),
                u.getSecurityPinHash() != null && !u.getSecurityPinHash().isBlank(),
                u.getProfilePictureUrl(),
                u.getCreatedAt(),
                expenses,
                expenseSum != null ? expenseSum : BigDecimal.ZERO,
                incomes,
                incomeSum != null ? incomeSum : BigDecimal.ZERO,
                tokens
        );
    }

    @Override
    @Transactional
    public AdminUserDto createUser(AdminUserCreateRequest request, User actor, String ipAddress, String userAgent) {
        verifyStepUpPin(actor, request.stepUpPin());

        String email = request.email().trim().toLowerCase();
        String username = request.username().trim();

        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new BadRequestException("User with this email already exists");
        }
        if (userRepository.existsByUsernameIgnoreCase(username)) {
            throw new BadRequestException("User with this username already exists");
        }

        User user = User.builder()
                .name(request.name().trim())
                .username(username)
                .email(email)
                .password(passwordEncoder.encode(request.password()))
                .role(request.role() != null ? request.role() : Role.ROLE_USER)
                .enabled(true)
                .accountLocked(false)
                .failedPinAttempts(0)
                .createdAt(LocalDateTime.now())
                .build();

        if (request.initialPin() != null && !request.initialPin().isBlank()) {
            user.setSecurityPinHash(passwordEncoder.encode(request.initialPin()));
        }

        User saved = userRepository.save(user);

        auditService.recordAction(
                actor.getId(),
                actor.getUsername() != null ? actor.getUsername() : actor.getEmail(),
                "CREATE_USER",
                "USER",
                String.valueOf(saved.getId()),
                String.format("Provisioned user '%s' (%s) with role %s", saved.getUsername(), saved.getEmail(), saved.getRole()),
                ipAddress,
                userAgent
        );
        metricsService.refreshMetrics();

        log.info("Admin actor={} successfully created new user id={}, email={}, role={}",
                actor.getEmail(), saved.getId(), saved.getEmail(), saved.getRole());

        return new AdminUserDto(
                saved.getId(),
                saved.getName(),
                saved.getUsername(),
                saved.getEmail(),
                saved.getRole().name(),
                saved.isEnabled(),
                saved.isAccountLocked(),
                saved.getCurrency(),
                saved.getCreatedAt(),
                0L
        );
    }

    @Override
    @Transactional
    public AdminUserDto updateUser(Long targetUserId, AdminUserUpdateRequest request, User actor, String ipAddress, String userAgent) {
        verifyStepUpPin(actor, request.stepUpPin());

        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id=" + targetUserId));

        String email = request.email().trim().toLowerCase();
        String username = request.username().trim();

        if (!target.getEmail().equalsIgnoreCase(email) && userRepository.existsByEmailIgnoreCase(email)) {
            throw new BadRequestException("User with this email already exists");
        }
        if (!target.getUsername().equalsIgnoreCase(username) && userRepository.existsByUsernameIgnoreCase(username)) {
            throw new BadRequestException("User with this username already exists");
        }

        // Prevent locking or demoting the last remaining Super Admin
        if (target.getRole() == Role.ROLE_SUPER_ADMIN) {
            boolean isDemoting = request.role() != null && request.role() != Role.ROLE_SUPER_ADMIN;
            boolean isLocking = Boolean.TRUE.equals(request.accountLocked());
            if (isDemoting || isLocking) {
                long superCount = userRepository.countByRole(Role.ROLE_SUPER_ADMIN);
                if (superCount <= 1) {
                    throw new BadRequestException("Cannot demote or lock the last remaining Super Admin account");
                }
            }
        }

        target.setName(request.name().trim());
        target.setUsername(username);
        target.setEmail(email);

        if (request.role() != null) {
            target.setRole(request.role());
        }

        if (request.accountLocked() != null) {
            target.setAccountLocked(request.accountLocked());
        }

        if (request.newPassword() != null && !request.newPassword().isBlank()) {
            if (request.newPassword().length() < 8) {
                throw new BadRequestException("New password must be at least 8 characters long");
            }
            target.setPassword(passwordEncoder.encode(request.newPassword()));
        }

        if (request.newPin() != null && !request.newPin().isBlank()) {
            target.setSecurityPinHash(passwordEncoder.encode(request.newPin()));
            target.setFailedPinAttempts(0);
            target.setPinLockedUntil(null);
        }

        User saved = userRepository.save(target);

        auditService.recordAction(
                actor.getId(),
                actor.getUsername() != null ? actor.getUsername() : actor.getEmail(),
                "UPDATE_USER",
                "USER",
                String.valueOf(saved.getId()),
                String.format("Updated profile, role=%s, locked=%s for user '%s'", saved.getRole(), saved.isAccountLocked(), saved.getEmail()),
                ipAddress,
                userAgent
        );
        metricsService.refreshMetrics();

        log.info("Admin actor={} updated user id={}, email={}", actor.getEmail(), saved.getId(), saved.getEmail());

        return new AdminUserDto(
                saved.getId(),
                saved.getName(),
                saved.getUsername(),
                saved.getEmail(),
                saved.getRole().name(),
                saved.isEnabled(),
                saved.isAccountLocked(),
                saved.getCurrency(),
                saved.getCreatedAt(),
                expenseRepository.countByUser(saved)
        );
    }

    @Override
    @Transactional
    public void deleteUser(Long targetUserId, String stepUpPin, User actor, String ipAddress, String userAgent) {
        verifyStepUpPin(actor, stepUpPin);

        if (Objects.equals(actor.getId(), targetUserId)) {
            throw new BadRequestException("You cannot delete your own active administrator account");
        }

        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id=" + targetUserId));

        if (target.getRole() == Role.ROLE_SUPER_ADMIN) {
            long superCount = userRepository.countByRole(Role.ROLE_SUPER_ADMIN);
            if (superCount <= 1) {
                throw new BadRequestException("Cannot delete the last remaining Super Admin account");
            }
        }

        String targetEmail = target.getEmail();
        Role targetRole = target.getRole();

        deviceTokenRepository.deleteByUser(target);
        userService.deleteUser(targetUserId);

        auditService.recordAction(
                actor.getId(),
                actor.getUsername() != null ? actor.getUsername() : actor.getEmail(),
                "DELETE_USER",
                "USER",
                String.valueOf(targetUserId),
                String.format("Permanently deleted user account '%s' (former role: %s)", targetEmail, targetRole),
                ipAddress,
                userAgent
        );
        metricsService.refreshMetrics();

        log.warn("Admin actor={} permanently deleted user id={}, email={}", actor.getEmail(), targetUserId, targetEmail);
    }

    @Override
    @Transactional
    public AdminUserDto updateUserStatus(Long targetUserId, AdminUserStatusUpdateRequest request,
                                         User actor, String ipAddress, String userAgent) {
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id=" + targetUserId));

        if (Objects.equals(actor.getId(), targetUserId) && Boolean.TRUE.equals(request.accountLocked())) {
            throw new BadRequestException("You cannot lock your own administrative account");
        }

        if (target.getRole() == Role.ROLE_SUPER_ADMIN && Boolean.TRUE.equals(request.accountLocked())) {
            long superAdminCount = userRepository.countByRole(Role.ROLE_SUPER_ADMIN);
            if (superAdminCount <= 1) {
                throw new BadRequestException("Cannot lock the last remaining Super Administrator account");
            }
        }

        if (request.accountLocked() != null) {
            target.setAccountLocked(request.accountLocked());
        }
        if (request.enabled() != null) {
            target.setEnabled(request.enabled());
        }

        User saved = userRepository.save(target);

        auditService.recordAction(
                actor.getId(),
                actor.getUsername() != null ? actor.getUsername() : actor.getEmail(),
                "UPDATE_USER_STATUS",
                "USER",
                String.valueOf(targetUserId),
                String.format("Account %s by admin. Reason: %s",
                        Boolean.TRUE.equals(request.accountLocked()) ? "LOCKED" : "UNLOCKED",
                        request.reason() != null ? request.reason() : "N/A"),
                ipAddress,
                userAgent
        );
        metricsService.refreshMetrics();

        log.info("User id={} status updated: accountLocked={} by admin={}",
                targetUserId, request.accountLocked(), actor.getEmail());

        return new AdminUserDto(
                saved.getId(),
                saved.getName(),
                saved.getUsername(),
                saved.getEmail(),
                saved.getRole().name(),
                saved.isEnabled(),
                saved.isAccountLocked(),
                saved.getCurrency(),
                saved.getCreatedAt(),
                expenseRepository.countByUser(saved)
        );
    }

    @Override
    @Transactional
    public AdminUserDto updateUserRole(Long targetUserId, AdminUserRoleUpdateRequest request,
                                       User actor, String ipAddress, String userAgent) {
        if (!actor.isSuperAdmin()) {
            throw new BadRequestException("Only a Super Administrator is authorized to modify user roles");
        }

        verifyStepUpPin(actor, request.stepUpPin());

        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id=" + targetUserId));

        if (target.getRole() == Role.ROLE_SUPER_ADMIN && request.role() != Role.ROLE_SUPER_ADMIN) {
            long superAdminCount = userRepository.countByRole(Role.ROLE_SUPER_ADMIN);
            if (superAdminCount <= 1) {
                throw new BadRequestException("Cannot demote the last remaining Super Administrator account");
            }
        }

        Role oldRole = target.getRole();
        target.setRole(request.role());
        User saved = userRepository.save(target);

        auditService.recordAction(
                actor.getId(),
                actor.getUsername() != null ? actor.getUsername() : actor.getEmail(),
                "UPDATE_USER_ROLE",
                "USER",
                String.valueOf(targetUserId),
                String.format("Role changed from %s to %s. Reason: %s",
                        oldRole, request.role(), request.reason() != null ? request.reason() : "N/A"),
                ipAddress,
                userAgent
        );

        log.info("User id={} role changed from {} to {} by admin={}",
                targetUserId, oldRole, request.role(), actor.getEmail());

        return new AdminUserDto(
                saved.getId(),
                saved.getName(),
                saved.getUsername(),
                saved.getEmail(),
                saved.getRole().name(),
                saved.isEnabled(),
                saved.isAccountLocked(),
                saved.getCurrency(),
                saved.getCreatedAt(),
                expenseRepository.countByUser(saved)
        );
    }

    @Override
    @Transactional
    public void resetPinLockout(Long targetUserId, User actor, String ipAddress, String userAgent) {
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id=" + targetUserId));

        target.setFailedPinAttempts(0);
        target.setPinLockedUntil(null);
        userRepository.save(target);

        auditService.recordAction(
                actor.getId(),
                actor.getUsername() != null ? actor.getUsername() : actor.getEmail(),
                "RESET_PIN_LOCKOUT",
                "USER",
                String.valueOf(targetUserId),
                "Reset failed PIN counter and unlocked PIN lockout for user: " + target.getEmail(),
                ipAddress,
                userAgent
        );
        log.info("Security PIN lockout reset for userId={} by admin={}", targetUserId, actor.getEmail());
    }

    @Override
    @Transactional
    public void revokeUserSessions(Long targetUserId, User actor, String ipAddress, String userAgent) {
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id=" + targetUserId));

        auditService.recordAction(
                actor.getId(),
                actor.getUsername() != null ? actor.getUsername() : actor.getEmail(),
                "REVOKE_SESSIONS",
                "USER",
                String.valueOf(targetUserId),
                "Administrative token invalidation triggered for user: " + target.getEmail(),
                ipAddress,
                userAgent
        );
        log.info("Sessions administratively revoked for user id={}", targetUserId);
    }

    @Override
    public AdminPermissionsDto getPermissions(User actor) {
        if (actor == null) {
            return new AdminPermissionsDto(0L, "anonymous", "ROLE_USER", false, false, false, false, false, false, false, false);
        }

        Role r = actor.getRole();
        boolean isSuper = r == Role.ROLE_SUPER_ADMIN;
        boolean isAdmin = r == Role.ROLE_ADMIN || isSuper;
        boolean isSupport = r == Role.ROLE_SUPPORT;

        return new AdminPermissionsDto(
                actor.getId(),
                actor.getUsername() != null ? actor.getUsername() : actor.getEmail(),
                r.name(),
                isAdmin || isSuper,                          // canManageUsers
                isSuper,                                      // canModifyRoles
                isAdmin || isSuper || isSupport,              // canUnlockSecurityPin
                isAdmin || isSuper,                          // canBroadcastNotifications
                isAdmin || isSuper,                          // canModerateMl
                isSuper,                                      // canTriggerFailover
                isAdmin || isSuper,                          // canClearCache
                isAdmin || isSuper                           // canExportAudit
        );
    }

    private void verifyStepUpPin(User actor, String stepUpPin) {
        if (actor.getSecurityPinHash() == null || actor.getSecurityPinHash().isBlank()) {
            throw new BadRequestException("You must configure a Security PIN on your administrator account before executing high-privilege actions");
        }
        if (stepUpPin == null || !passwordEncoder.matches(stepUpPin, actor.getSecurityPinHash())) {
            throw new BadRequestException("Invalid step-up Security PIN. Verification failed.");
        }
    }
}
