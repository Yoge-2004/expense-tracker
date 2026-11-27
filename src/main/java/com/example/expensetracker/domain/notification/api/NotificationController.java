package com.example.expensetracker.domain.notification.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

import com.example.expensetracker.domain.notification.dto.NotificationInboxDto;
import com.example.expensetracker.domain.notification.dto.NotificationPreferenceDto;
import com.example.expensetracker.domain.notification.dto.NotificationRequests;
import com.example.expensetracker.domain.notification.service.NotificationService;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.domain.user.service.UserProfileService;
import com.example.expensetracker.domain.user.security.UserSecurity;

/**
 * REST controller for notification inbox, per-category preferences, and push device registration.
 */
@Tag(name = "Notifications",
        description = "The notification inbox, per-kind preferences and the phones that receive push. "
                + "All endpoints require Bearer JWT authentication.")
@RequiredArgsConstructor
@SecurityRequirement(name = "BearerAuth")
@RestController
@RequestMapping("/api/notifications/user/{userId}")
public class NotificationController {

    private final NotificationService notificationService;
    private final UserProfileService userService;
    private final UserSecurity userSecurity;

    @Operation(summary = "Newest notifications and the unread count")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Inbox returned"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @GetMapping
    public ResponseEntity<NotificationInboxDto> inbox(@PathVariable Long userId,
                                                      @RequestParam(defaultValue = "50") int limit) {
        return ResponseEntity.ok(notificationService.getInbox(owner(userId), limit));
    }

    @Operation(summary = "Mark notifications as read",
            description = "Send {\"ids\": [..]} to mark some, or an empty body / empty list to mark all.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Updated count returned"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @PostMapping("/read")
    public ResponseEntity<Map<String, Integer>> markRead(@PathVariable Long userId,
                                                         @Valid @RequestBody(required = false) NotificationRequests.MarkRead request) {
        int changed = notificationService.markRead(owner(userId), request == null ? null : request.ids());
        return ResponseEntity.ok(Map.of("updated", changed));
    }

    @Operation(summary = "Clear or delete a notification")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Notification deleted"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteNotification(@PathVariable Long userId, @PathVariable Long id) {
        notificationService.deleteNotification(owner(userId), id);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Clear all notifications for user")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Deleted count returned"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @DeleteMapping
    public ResponseEntity<Map<String, Integer>> clearAll(@PathVariable Long userId) {
        int deleted = notificationService.clearAll(owner(userId));
        return ResponseEntity.ok(Map.of("deleted", deleted));
    }

    @Operation(summary = "Which kinds of notification are on")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Preference list returned"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @GetMapping("/preferences")
    public ResponseEntity<List<NotificationPreferenceDto>> preferences(@PathVariable Long userId) {
        return ResponseEntity.ok(notificationService.getPreferences(owner(userId)));
    }

    @Operation(summary = "Switch notification kinds on or off",
            description = "Send the kinds to switch OFF; everything else stays on.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Updated preferences returned"),
        @ApiResponse(responseCode = "400", description = "Invalid preference payload"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @PutMapping("/preferences")
    public ResponseEntity<List<NotificationPreferenceDto>> updatePreferences(
            @PathVariable Long userId, @Valid @RequestBody NotificationRequests.Preferences request) {
        return ResponseEntity.ok(notificationService.updatePreferences(owner(userId), request.disabledTypes()));
    }

    @Operation(summary = "Register this phone for push notifications")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Device registered"),
        @ApiResponse(responseCode = "400", description = "Invalid device token"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @PostMapping("/devices")
    public ResponseEntity<Void> registerDevice(@PathVariable Long userId,
                                               @Valid @RequestBody NotificationRequests.Device request) {
        notificationService.registerDevice(owner(userId), request.token(), request.platform(), request.appVersion());
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "Stop sending push notifications to this phone")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Device unregistered"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @DeleteMapping("/devices")
    public ResponseEntity<Void> unregisterDevice(@PathVariable Long userId, @RequestParam String token) {
        notificationService.unregisterDevice(owner(userId), token);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Send myself a test notification")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Test notification dispatch status returned"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @PostMapping("/test")
    public ResponseEntity<Map<String, Boolean>> test(@PathVariable Long userId) {
        return ResponseEntity.ok(Map.of("sent", notificationService.sendTest(owner(userId))));
    }

    /** The authenticated owner of {@code userId}; anyone else is refused. */
    private User owner(Long userId) {
        userSecurity.validateUserAccess(userId);
        return userService.findById(userId).orElseThrow(() -> new IllegalArgumentException("User not found"));
    }
}
