package com.example.expensetracker.domain.user.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.net.URI;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import com.example.expensetracker.common.ErrorResponse;
import com.example.expensetracker.domain.user.dto.AvatarUploadResponse;
import com.example.expensetracker.domain.user.dto.DeleteAccountRequest;
import com.example.expensetracker.domain.user.dto.PinVerificationResponse;
import com.example.expensetracker.domain.user.dto.UpdateProfileRequest;
import com.example.expensetracker.domain.user.dto.UserAppearanceDto;
import com.example.expensetracker.domain.user.dto.UserProfileDto;
import com.example.expensetracker.domain.user.dto.UsernameAvailabilityDto;
import com.example.expensetracker.domain.user.dto.UsernameSuggestionsDto;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.domain.user.service.UserAccountManagementService;
import com.example.expensetracker.domain.user.service.UserAppearanceService;
import com.example.expensetracker.domain.user.service.UserAvatarService;
import com.example.expensetracker.domain.user.service.UserProfileService;
import com.example.expensetracker.domain.user.service.UserRegistrationService;
import com.example.expensetracker.domain.user.service.UserSecurityPinService;
import com.example.expensetracker.infrastructure.security.GoogleIdTokenVerifier;
import com.example.expensetracker.infrastructure.security.RateLimited;
import com.example.expensetracker.domain.user.security.UserSecurity;



/**
 * REST controller for user account lookup, profile updates, appearance preferences, avatar uploads, and deletion.
 */
@Tag(
    name        = "User Management",
    description = """
        User account lookup, profile management, and cascading account deletion.
        """
)
@Slf4j
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserProfileService userProfileService;
    private final UserRegistrationService userRegistrationService;
    private final UserSecurityPinService userSecurityPinService;
    private final UserAccountManagementService userAccountManagementService;
    private final UserSecurity userSecurity;
    private final PasswordEncoder passwordEncoder;
    private final GoogleIdTokenVerifier googleIdTokenVerifier;
    private final UserAppearanceService userAppearanceService;
    private final UserAvatarService userAvatarService;

    // ─── GET /api/users/check-username ────────────────────────────────────────

    @Operation(
        summary = "Check username availability",
        description = "Returns whether a username is available, valid, or already taken in real time."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Availability status returned"),
        @ApiResponse(responseCode = "400", description = "Username query parameter is empty")
    })
    @GetMapping("/check-username")
    public ResponseEntity<UsernameAvailabilityDto> checkUsername(
            @RequestParam(required = false) String username) {
        if (username == null || username.isBlank()) {
            return ResponseEntity.badRequest().body(new UsernameAvailabilityDto(false, null, "Username cannot be empty"));
        }

        String trimmed = username.trim();
        boolean validFormat = trimmed.matches("^[a-zA-Z0-9._]{3,30}$");
        if (!validFormat) {
            return ResponseEntity.ok(new UsernameAvailabilityDto(false, null, "Username must be 3-30 alphanumeric characters, dots, or underscores"));
        }

        boolean exists = userRegistrationService.userExistsByUsername(trimmed);
        return ResponseEntity.ok(new UsernameAvailabilityDto(!exists, trimmed, exists ? "Username is already taken" : "Username is available!"));
    }

    // ─── GET /api/users/suggest-usernames ──────────────────────────────────────

    @Operation(
        summary = "Generate username suggestions",
        description = "Generates up to 3 unique username suggestions based on a name or keyword."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Username suggestions generated"),
        @ApiResponse(responseCode = "429", description = "Too many suggestion requests")
    })
    @RateLimited(key = "user-suggest-usernames", maxRequests = 20,
                 message = "Too many username suggestion requests. Please try again later.")
    @GetMapping("/suggest-usernames")
    public ResponseEntity<UsernameSuggestionsDto> suggestUsernames(
            @RequestParam(required = false, defaultValue = "user") String base) {
        List<String> suggestions = userProfileService.suggestUsernames(base);
        log.info("Generated {} username suggestions for base='{}'", suggestions.size(), base);
        return ResponseEntity.ok(new UsernameSuggestionsDto(suggestions));
    }

    // ─── GET /api/users/{userId} ──────────────────────────────────────────────

    @Operation(
        summary = "Get user profile",
        description = "Returns basic profile fields: id, name, username, email, currency, and hasSecurityPin."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Profile returned successfully"),
        @ApiResponse(responseCode = "400", description = "No user found with the given ID",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class)))
    })
    @GetMapping("/{userId}")
    public ResponseEntity<UserProfileDto> getUserProfile(
            @Parameter(description = "Database ID of the user whose profile to fetch.", required = true, example = "1")
            @PathVariable Long userId) {
        log.info("Received request for user profile: userId={}", userId);
        userSecurity.validateUserAccess(userId);
        User user = userProfileService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        return ResponseEntity.ok(UserProfileDto.from(user));
    }

    // ─── PUT /api/users/{userId} ───────────────────────────────────────────────

    @Operation(
        summary = "Update user profile",
        description = "Updates editable profile fields such as display name and avatar picture URL."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Profile updated successfully"),
        @ApiResponse(responseCode = "400", description = "Invalid request or user not found",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PutMapping("/{userId}")
    public ResponseEntity<UserProfileDto> updateProfile(
            @Parameter(description = "Database ID of the user.", required = true, example = "1")
            @PathVariable Long userId,
            @Valid @RequestBody UpdateProfileRequest request) {
        log.info("Received request to update profile for userId={}", userId);
        userSecurity.validateUserAccess(userId);
        User updated = userProfileService.updateProfile(userId, request.name(), request.profilePictureUrl());
        return ResponseEntity.ok(UserProfileDto.from(updated));
    }

    // ─── PUT /api/users/{userId}/security-pin ──────────────────────────────────

    @Operation(
        summary = "Set or update 6-digit Security PIN",
        description = "Sets or updates the user's 6-digit Security PIN for zero-email account recovery and biometrics."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Security PIN updated successfully"),
        @ApiResponse(responseCode = "400", description = "Invalid PIN format or user not found",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "429", description = "Too many attempts (rate limit exceeded)",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PutMapping("/{userId}/security-pin")
    @RateLimited(key = "update-pin", windowSeconds = 300,
                 message = "Too many PIN update attempts. Please try again in %d seconds.")
    public ResponseEntity<Map<String, String>> updateSecurityPin(
            @Parameter(description = "Database ID of the user.", required = true, example = "1")
            @PathVariable Long userId,
            @RequestBody Map<String, String> body) {
        log.info("Received request to update Security PIN for userId={}", userId);
        userSecurity.validateUserAccess(userId);

        String pin = body != null ? body.get("pin") : null;
        if (pin == null || !pin.trim().matches("^\\d{6}$")) {
            throw new IllegalArgumentException("Security PIN must be exactly 6 numeric digits");
        }

        userSecurityPinService.updateSecurityPin(userId, pin.trim());
        log.info("Security PIN successfully updated for userId={}", userId);
        return ResponseEntity.ok(Map.of("message", "Security PIN updated successfully"));
    }

    // ─── POST /api/users/{userId}/verify-security-pin ──────────────────────────

    @Operation(
        summary = "Verify 6-digit Security PIN",
        description = "Verifies the provided 6-digit PIN. Tracks failed attempts to prevent brute force."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "PIN verification evaluated"),
        @ApiResponse(responseCode = "400", description = "Invalid PIN format or user not found",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "429", description = "Too many failed attempts (rate limit exceeded)",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping("/{userId}/verify-security-pin")
    @RateLimited(key = "verify-pin", windowSeconds = 300,
                 message = "Too many verification attempts. Please try again later.")
    public ResponseEntity<PinVerificationResponse> verifySecurityPin(
            @Parameter(description = "Database ID of the user.", required = true, example = "1")
            @PathVariable Long userId,
            @RequestBody Map<String, String> body) {
        log.info("Received request to verify Security PIN for userId={}", userId);
        userSecurity.validateUserAccess(userId);

        String pin = body != null ? body.get("pin") : null;
        if (pin == null || !pin.trim().matches("^\\d{6}$")) {
            throw new IllegalArgumentException("Security PIN must be exactly 6 numeric digits");
        }

        boolean valid = userSecurityPinService.verifySecurityPin(userId, pin.trim());
        return ResponseEntity.ok(new PinVerificationResponse(valid, valid ? null : "Incorrect Security PIN"));
    }

    // ─── DELETE /api/users/{userId} ───────────────────────────────────────────

    @Operation(
        summary = "Permanently delete user account",
        description = """
            Permanently deletes a user account and cascades deletion to all associated expenses,
            budgets, recurring rules, and custom categories.
            Requires re-authentication with current password, 6-digit PIN, or Google ID token.
            """
    )
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Account permanently deleted"),
        @ApiResponse(responseCode = "400", description = "No user found with the given ID",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "401", description = "Missing or invalid password confirmation",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "403", description = "Access denied (IDOR protection)",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "429", description = "Too many account deletion attempts",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class)))
    })
    @DeleteMapping("/{userId}")
    @RateLimited(key = "delete-account", maxRequests = 5, windowSeconds = 300,
                 message = "Too many account deletion attempts. Please try again in %d seconds.")
    public ResponseEntity<Void> deleteAccount(
            @Parameter(description = "Database ID of the user account to delete.", required = true, example = "1")
            @PathVariable Long userId,
            @Valid @RequestBody(required = false) DeleteAccountRequest request) {
        log.info("Received request to permanently delete account for userId={}", userId);
        userSecurity.validateUserAccess(userId);

        User user = userProfileService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        boolean verified = false;
        if (request != null) {
            if (request.password() != null && !request.password().isBlank()) {
                verified = passwordEncoder.matches(request.password(), user.getPassword());
            } else if (request.securityPin() != null && !request.securityPin().isBlank()) {
                verified = userSecurityPinService.verifySecurityPin(userId, request.securityPin().trim());
            } else if (request.googleIdToken() != null && !request.googleIdToken().isBlank()) {
                try {
                    GoogleIdTokenVerifier.VerifiedIdentity identity =
                            googleIdTokenVerifier.verify(request.googleIdToken());
                    verified = identity != null && identity.email().equalsIgnoreCase(user.getEmail());
                } catch (Exception e) {
                    log.warn("Google ID token verification failed during account deletion for userId={}: {}",
                            userId, e.getMessage());
                }
            }
        }

        if (!verified) {
            log.warn("Account deletion denied for userId={}: Invalid credentials confirmation", userId);
            boolean hasPassword = request != null && request.password() != null && !request.password().isBlank();
            String errorMsg = hasPassword
                    ? "Incorrect password. Account deletion requires valid password confirmation."
                    : "Invalid or missing password confirmation. Account deletion requires re-authentication.";
            throw new BadCredentialsException(errorMsg);
        }

        userAccountManagementService.deleteUser(userId);
        log.info("Account userId={} permanently deleted", userId);
        return ResponseEntity.noContent().build();
    }

    // ─── PUT /api/users/{userId}/currency ─────────────────────────────────────

    @Operation(
        summary = "Update currency preference",
        description = "Updates the preferred display currency for the given user account. Accepts any ISO 4217 code."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Currency preference updated"),
        @ApiResponse(responseCode = "400", description = "User not found or invalid currency code",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PutMapping("/{userId}/currency")
    public ResponseEntity<Map<String, String>> updateCurrency(
            @Parameter(description = "Database ID of the user whose currency to update.",
                       required = true, example = "1")
            @PathVariable Long userId,
            @RequestBody Map<String, String> body) {
        log.info("Received request to update currency for userId={}", userId);
        userSecurity.validateUserAccess(userId);

        String currency = body != null ? body.get("currency") : null;
        if (currency == null || !currency.trim().matches("^[A-Za-z]{3}$")) {
            throw new IllegalArgumentException("Currency must be a valid 3-letter ISO 4217 code (e.g., USD, EUR, INR)");
        }

        String normalizedCurrency = currency.trim().toUpperCase(Locale.ROOT);
        userProfileService.updateCurrency(userId, normalizedCurrency);
        log.info("Currency successfully updated to '{}' for userId={}", normalizedCurrency, userId);
        return ResponseEntity.ok(Map.of("message", "Currency preference updated successfully",
                "currency", normalizedCurrency));
    }

    // ─── GET /api/users/{userId}/appearance ───────────────────────────────────

    @Operation(
        summary = "Get user appearance preferences",
        description = "Returns font, theme palette, and studio personalization preferences for cross-device cloud sync."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Appearance preferences returned"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @GetMapping("/{userId}/appearance")
    public ResponseEntity<UserAppearanceDto> getUserAppearance(
            @Parameter(description = "Database ID of the user whose appearance to fetch.", required = true, example = "1")
            @PathVariable Long userId) {
        log.info("Received request for user appearance: userId={}", userId);
        userSecurity.validateUserAccess(userId);
        return ResponseEntity.ok(userAppearanceService.getAppearance(userId));
    }

    // ─── PUT /api/users/{userId}/appearance ───────────────────────────────────

    @Operation(
        summary = "Update user appearance preferences",
        description = "Updates typography, custom hex palette, wallpaper, and dynamic theming preferences."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Appearance preferences updated"),
        @ApiResponse(responseCode = "400", description = "Invalid appearance payload"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @PutMapping("/{userId}/appearance")
    public ResponseEntity<UserAppearanceDto> updateUserAppearance(
            @Parameter(description = "Database ID of the user whose appearance to update.", required = true, example = "1")
            @PathVariable Long userId,
            @Valid @RequestBody UserAppearanceDto dto) {
        log.info("Received request to update user appearance: userId={}", userId);
        userSecurity.validateUserAccess(userId);
        return ResponseEntity.ok(userAppearanceService.updateAppearance(userId, dto));
    }

    // ─── POST /api/users/{userId}/avatar ─────────────────────────────────────

    @Operation(
        summary = "Upload user avatar image",
        description = "Uploads a profile picture image (JPEG, PNG, WebP, GIF) directly from device files."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Avatar image uploaded"),
        @ApiResponse(responseCode = "400", description = "Unsupported file type or empty file"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @PostMapping(value = "/{userId}/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AvatarUploadResponse> uploadAvatar(
            @PathVariable Long userId,
            @RequestParam("file") MultipartFile file) {
        log.info("Received request to upload avatar for userId={}", userId);
        userSecurity.validateUserAccess(userId);

        String avatarUrl = userAvatarService.storeAvatar(userId, file);
        return ResponseEntity.ok(new AvatarUploadResponse(avatarUrl, "Profile picture updated successfully"));
    }

    // ─── GET /api/users/{userId}/avatar ──────────────────────────────────────

    @Operation(
        summary = "Get user avatar image",
        description = "Streams the user avatar image binary directly."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Avatar image bytes returned"),
        @ApiResponse(responseCode = "302", description = "Redirect to hosted avatar URL"),
        @ApiResponse(responseCode = "404", description = "No avatar stored for user")
    })
    @GetMapping("/{userId}/avatar")
    public ResponseEntity<byte[]> getAvatar(@PathVariable Long userId) {
        return userAvatarService.getAvatar(userId)
                .map(avatar -> {
                    if (avatar.isRedirect()) {
                        return ResponseEntity.status(HttpStatus.FOUND)
                                .location(URI.create(avatar.redirectUrl()))
                                .<byte[]>build();
                    }
                    return ResponseEntity.ok()
                            .contentType(MediaType.parseMediaType(avatar.contentType()))
                            .header(HttpHeaders.CACHE_CONTROL, "public, max-age=3600")
                            .header("X-Content-Type-Options", "nosniff")
                            .body(avatar.data());
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    // ─── DELETE /api/users/{userId}/avatar ───────────────────────────────────

    @Operation(
        summary = "Delete user avatar image",
        description = "Removes uploaded user avatar and resets to default."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Avatar removed"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @DeleteMapping("/{userId}/avatar")
    public ResponseEntity<Void> deleteAvatar(@PathVariable Long userId) {
        log.info("Received request to delete avatar for userId={}", userId);
        userSecurity.validateUserAccess(userId);

        userAvatarService.deleteAvatar(userId);
        return ResponseEntity.noContent().build();
    }
}
