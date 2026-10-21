package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

/** Request bodies for the notification endpoints. */
public final class NotificationRequests {

    private NotificationRequests() {}

    @Schema(description = "Notifications to mark as read; omit or leave empty to mark everything as read")
    public record MarkRead(List<Long> ids) {
    }

    @Schema(description = "Notification kinds the user wants switched OFF; everything else is on")
    public record Preferences(List<String> disabledTypes) {
    }

    @Schema(description = "A phone that should receive push notifications")
    public record Device(
            @NotBlank(message = "Push token is required")
            @Size(max = 255, message = "Push token is too long")
            @Schema(example = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]") String token,
            @Schema(description = "ANDROID or IOS", example = "ANDROID") String platform,
            @Size(max = 32, message = "App version is too long")
            @Schema(description = "Installed app version, used to tell phones that are behind about updates", example = "1.0.4") String appVersion
    ) {
    }
}
