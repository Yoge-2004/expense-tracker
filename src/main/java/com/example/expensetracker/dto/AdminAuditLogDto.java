package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/**
 * Audit log presentation DTO.
 *
 * @author Yogeshwaran
 */
@Schema(description = "Record of an administrative action")
public record AdminAuditLogDto(
        Long id,
        Long actorId,
        String actorUsername,
        String action,
        String targetResource,
        String targetId,
        String details,
        String ipAddress,
        String userAgent,
        LocalDateTime createdAt
) {}
