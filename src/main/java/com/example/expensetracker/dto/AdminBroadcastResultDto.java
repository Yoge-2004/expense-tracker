package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Result metrics returned after a platform announcement broadcast.
 *
 * @author Yogeshwaran
 */
@Schema(description = "Outcome of the broadcast operation")
public record AdminBroadcastResultDto(
        int totalTargetedUsers,
        int successCount,
        int failedCount,
        String status
) {}
