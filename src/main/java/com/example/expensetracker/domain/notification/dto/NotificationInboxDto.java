package com.example.expensetracker.domain.notification.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;



/**
 * DTO representing a user's notification inbox snapshot and unread counter.
 *
 * @param unreadCount total unread notifications for the user
 * @param items       ordered list of recent notifications
 */
@Schema(description = "The newest notifications plus how many are still unread")
public record NotificationInboxDto(
        @Schema(example = "3") long unreadCount,
        List<NotificationDto> items
) {
}
