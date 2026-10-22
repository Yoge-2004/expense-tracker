package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request payload for broadcasting high-priority administrative system announcements.
 *
 * @author Yogeshwaran
 */
@Schema(description = "Payload for dispatching platform announcements to user inboxes & phones")
public record AdminBroadcastRequest(
        @Schema(description = "Announcement title", example = "Scheduled Maintenance Window")
        @NotBlank(message = "Title is required")
        @Size(max = 120, message = "Title cannot exceed 120 characters")
        String title,

        @Schema(description = "Announcement body message", example = "Expense Tracker will undergo scheduled maintenance tonight at 2 AM UTC.")
        @NotBlank(message = "Message body is required")
        @Size(max = 500, message = "Message body cannot exceed 500 characters")
        String message,

        @Schema(description = "Target audience: ALL, ACTIVE, or ADMINS", example = "ALL")
        String targetAudience,

        @Schema(description = "Optional deep link route in the web/mobile app", example = "/dashboard")
        String route,

        @Schema(description = "Step-up Security PIN of the dispatching operator", example = "123456")
        @NotBlank(message = "Step-up Security PIN is required for platform broadcasts")
        String stepUpPin
) {}
