package com.example.expensetracker.domain.admin.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Objects;

import com.example.expensetracker.domain.user.model.Role;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.infrastructure.exception.BadRequestException;
import com.example.expensetracker.infrastructure.exception.ForbiddenException;
import com.example.expensetracker.infrastructure.security.StepUpPinVerifier;

/**
 * Access control and authorization policy engine for administrative operations.
 * Enforces strict role-based access control (RBAC), hierarchy ranking invariants,
 * step-up PIN verification, and protection of the last remaining Super Administrator account.
 *
 * @author Yogeshwaran
 */
@Component
@RequiredArgsConstructor
public class AdminAuthorizationPolicy {

    private final StepUpPinVerifier stepUpPinVerifier;

    public void verifyStepUpPin(User actor, String stepUpPin) {
        stepUpPinVerifier.verify(actor, stepUpPin);
    }

    public static int rank(Role role) {
        if (role == null) return 0;
        return switch (role) {
            case ROLE_USER -> 0;
            case ROLE_SUPPORT -> 1;
            case ROLE_ADMIN -> 2;
            case ROLE_SUPER_ADMIN -> 3;
        };
    }

    /**
     * Super admins manage everyone; anyone else only themselves or accounts ranked strictly below them.
     */
    public void requireCanManage(User actor, User target) {
        if (actor.isSuperAdmin() || Objects.equals(actor.getId(), target.getId())) {
            return;
        }
        if (rank(actor.getRole()) <= rank(target.getRole())) {
            throw new ForbiddenException("You do not have permission to manage an account with the "
                    + target.getRole().name().replace("ROLE_", "").toLowerCase().replace('_', ' ') + " role");
        }
    }

    public void requireSuperAdminForPrivilegedRole(User actor, Role role) {
        if (rank(role) >= rank(Role.ROLE_ADMIN) && !actor.isSuperAdmin()) {
            throw new ForbiddenException("Only a Super Administrator can create Administrator or Super Administrator accounts");
        }
    }

    public void checkNotLastSuperAdmin(long superAdminCount, String violationMessage) {
        if (superAdminCount <= 1) {
            throw new BadRequestException(violationMessage);
        }
    }
}
