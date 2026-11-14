package com.example.expensetracker.domain.notification.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;



@Schema(description = "The newest notifications plus how many are still unread")
public record NotificationInboxDto(
        @Schema(example = "3") long unreadCount,
        List<NotificationDto> items
) {
}
