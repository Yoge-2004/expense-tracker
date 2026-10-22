package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Granular privileges matrix returned to the administrative console to
 * dynamically unlock/lock frontend capabilities according to the operator's exact RBAC tier.
 *
 * @author Yogeshwaran
 */
@Schema(description = "RBAC privilege matrix and operator capabilities")
public record AdminPermissionsDto(
        Long userId,
        String username,
        String role,
        boolean canManageUsers,
        boolean canModifyRoles,
        boolean canUnlockSecurityPin,
        boolean canBroadcastNotifications,
        boolean canModerateMl,
        boolean canTriggerFailover,
        boolean canClearCache,
        boolean canExportAudit
) {}
