package com.example.expensetracker.controller;

import com.example.expensetracker.dto.DeleteAccountRequest;
import com.example.expensetracker.dto.UpdateProfileRequest;
import com.example.expensetracker.dto.UserAppearanceDto;
import com.example.expensetracker.dto.ErrorResponse;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.security.GoogleIdTokenVerifier;
import com.example.expensetracker.security.RateLimited;
import com.example.expensetracker.security.UserSecurity;
import com.example.expensetracker.service.UserAppearanceService;
import com.example.expensetracker.service.UserService;
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
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.security.SecureRandom;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

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

    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserService userService;
    private final UserRepository userRepository;
    private final UserSecurity userSecurity;
    private final PasswordEncoder passwordEncoder;
    private final GoogleIdTokenVerifier googleIdTokenVerifier;
    private final UserAppearanceService userAppearanceService;

    private java.nio.file.Path getAvatarDir() {
        String dataDir = System.getenv("DATA_DIR");
        if (dataDir != null && !dataDir.isBlank()) {
            return java.nio.file.Path.of(dataDir, "avatars");
        }
        return java.nio.file.Path.of(System.getProperty("user.home"), ".expensetracker", "avatars");
    }

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
    public ResponseEntity<Map<String, Object>> checkUsername(
            @RequestParam(required = false) String username) {
        if (username == null || username.trim().isEmpty()) {
            Map<String, Object> err = new HashMap<>();
            err.put("available", false);
            err.put("message", "Username cannot be empty");
            return ResponseEntity.badRequest().body(err);
        }

        String trimmed = username.trim();
        boolean validFormat = trimmed.matches("^[a-zA-Z0-9._]{3,30}$");
        if (!validFormat) {
            Map<String, Object> invalid = new HashMap<>();
            invalid.put("available", false);
            invalid.put("message", "Username must be 3-30 alphanumeric characters, dots, or underscores");
            return ResponseEntity.ok(invalid);
        }

        boolean exists = userRepository.findByUsernameIgnoreCase(trimmed).isPresent();
        Map<String, Object> res = new HashMap<>();
        res.put("available", !exists);
        res.put("username", trimmed);
        res.put("message", exists ? "Username is already taken" : "Username is available!");
        return ResponseEntity.ok(res);
    }

    // ─── GET /api/users/suggest-usernames ──────────────────────────────────────

    @Operation(
        summary = "Generate username suggestions",
        description = "Generates exactly 3 unique, creative username suggestions based on a name or keyword."
    )
    @RateLimited(key = "user-suggest-usernames", maxRequests = 20,
                 message = "Too many username suggestion requests. Please try again later.")
    @GetMapping("/suggest-usernames")
    public ResponseEntity<Map<String, Object>> suggestUsernames(
            @RequestParam(required = false, defaultValue = "user") String base) {
        String clean = base.replaceAll("[^a-zA-Z0-9]", "").toLowerCase(Locale.ROOT);
        if (clean.isEmpty()) clean = "user";

        java.util.Set<String> uniqueSuggestions = new java.util.LinkedHashSet<>();

        String[] prefixes = {"iam", "the", "real", "hey", "go"};
        for (String p : prefixes) {
            if (uniqueSuggestions.size() >= 3) break;
            String candidate = (p + "_" + clean).replaceAll("[^a-zA-Z0-9_]", "");
            if (candidate.length() > 30) candidate = candidate.substring(0, 30);
            if (userRepository.findByUsernameIgnoreCase(candidate).isEmpty()) {
                uniqueSuggestions.add(candidate);
            }
        }

        int attempts = 0;
        while (uniqueSuggestions.size() < 3 && attempts < 100) {
            attempts++;
            int num = 100 + RANDOM.nextInt(900);
            String candidate = clean + num;
            if (candidate.length() > 30) candidate = candidate.substring(0, 30);
            if (userRepository.findByUsernameIgnoreCase(candidate).isEmpty()) {
                uniqueSuggestions.add(candidate);
            }
        }

        log.info("Generated {} username suggestions for base='{}'", uniqueSuggestions.size(), base);
        Map<String, Object> response = new HashMap<>();
        response.put("suggestions", new java.util.ArrayList<>(uniqueSuggestions));
        return ResponseEntity.ok(response);
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
    public ResponseEntity<Map<String, Object>> getUserProfile(
            @Parameter(description = "Database ID of the user whose profile to fetch.", required = true, example = "1")
            @PathVariable Long userId) {
        log.info("Received request for user profile: userId={}", userId);
        userSecurity.validateUserAccess(userId);
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Map<String, Object> map = new HashMap<>();
        map.put("id", user.getId());
        map.put("name", user.getName());
        map.put("username", user.getUsername());
        map.put("email", user.getEmail());
        map.put("currency", user.getCurrency());
        map.put("hasSecurityPin", user.hasSecurityPin());
        map.put("profilePictureUrl", user.getProfilePictureUrl());
        map.put("role", user.getRole().name());
        return ResponseEntity.ok(map);
    }

    // ─── PUT /api/users/{userId} ───────────────────────────────────────────────

    @Operation(
        summary = "Update user profile",
        description = "Updates editable profile fields such as display name."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Profile updated successfully"),
        @ApiResponse(responseCode = "400", description = "Invalid request or user not found",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PutMapping("/{userId}")
    public ResponseEntity<Map<String, Object>> updateProfile(
            @Parameter(description = "Database ID of the user.", required = true, example = "1")
            @PathVariable Long userId,
            @Valid @RequestBody UpdateProfileRequest request) {
        log.info("Received request to update profile for userId={}", userId);
        userSecurity.validateUserAccess(userId);

        userService.updateName(userId, request.name());
        if (request.profilePictureUrl() != null && !request.profilePictureUrl().isBlank()) {
            userService.updateProfilePicture(userId, request.profilePictureUrl().trim());
        }
        User updated = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        Map<String, Object> map = new HashMap<>();
        map.put("id", updated.getId());
        map.put("name", updated.getName());
        map.put("username", updated.getUsername());
        map.put("email", updated.getEmail());
        map.put("currency", updated.getCurrency());
        map.put("hasSecurityPin", updated.hasSecurityPin());
        map.put("profilePictureUrl", updated.getProfilePictureUrl());
        return ResponseEntity.ok(map);
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

        userService.updateSecurityPin(userId, pin.trim());
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
    public ResponseEntity<Map<String, Object>> verifySecurityPin(
            @Parameter(description = "Database ID of the user.", required = true, example = "1")
            @PathVariable Long userId,
            @RequestBody Map<String, String> body) {
        log.info("Received request to verify Security PIN for userId={}", userId);
        userSecurity.validateUserAccess(userId);

        String pin = body != null ? body.get("pin") : null;
        if (pin == null || !pin.trim().matches("^\\d{6}$")) {
            throw new IllegalArgumentException("Security PIN must be exactly 6 numeric digits");
        }

        boolean valid = userService.verifySecurityPin(userId, pin.trim());
        Map<String, Object> response = new HashMap<>();
        response.put("valid", valid);
        if (!valid) {
            response.put("message", "Incorrect Security PIN");
        }
        return ResponseEntity.ok(response);
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

        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        boolean verified = false;
        if (request != null) {
            if (request.password() != null && !request.password().isBlank()) {
                verified = passwordEncoder.matches(request.password(), user.getPassword());
            } else if (request.securityPin() != null && !request.securityPin().isBlank()) {
                verified = userService.verifySecurityPin(userId, request.securityPin().trim());
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

        userService.deleteUser(userId);
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

        userService.updateCurrency(userId, currency.trim().toUpperCase(Locale.ROOT));
        log.info("Currency successfully updated to '{}' for userId={}", currency.toUpperCase(Locale.ROOT), userId);
        return ResponseEntity.ok(Map.of("message", "Currency preference updated successfully",
                "currency", currency.trim().toUpperCase(Locale.ROOT)));
    }

    // ─── GET /api/users/{userId}/appearance ───────────────────────────────────

    @Operation(
        summary = "Get user appearance preferences",
        description = "Returns font, theme palette, and studio personalization preferences for cross-device cloud sync."
    )
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
    @PostMapping(value = "/{userId}/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> uploadAvatar(
            @PathVariable Long userId,
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        log.info("Received request to upload avatar for userId={}", userId);
        userSecurity.validateUserAccess(userId);

        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Avatar file must not be empty");
        }
        if (file.getSize() > 5 * 1024 * 1024) {
            throw new IllegalArgumentException("Avatar file size must not exceed 5MB");
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
            throw new IllegalArgumentException("Only image files (JPEG, PNG, WebP, GIF) are supported");
        }

        try {
            java.nio.file.Path avatarDir = getAvatarDir();
            java.nio.file.Files.createDirectories(avatarDir);

            String ext = ".jpg";
            String lower = contentType.toLowerCase(Locale.ROOT);
            if (lower.contains("png")) ext = ".png";
            else if (lower.contains("webp")) ext = ".webp";
            else if (lower.contains("gif")) ext = ".gif";

            // Remove any existing avatar files for this user
            for (String oldExt : java.util.List.of(".jpg", ".png", ".webp", ".gif", ".img")) {
                try {
                    java.nio.file.Files.deleteIfExists(avatarDir.resolve("user_" + userId + oldExt));
                } catch (Exception ex) {
                    log.debug("Notice while removing old avatar extension {} for userId={}: {}", oldExt, userId, ex.getMessage());
                }
            }

            byte[] rawBytes = file.getBytes();
            byte[] compressedBytes = compressAvatarImage(rawBytes, contentType);
            boolean isCompressed = compressedBytes != null && compressedBytes.length < rawBytes.length;
            String savedContentType = isCompressed && !contentType.toLowerCase(Locale.ROOT).contains("png")
                    ? "image/jpeg"
                    : contentType;
            if (isCompressed && "image/jpeg".equals(savedContentType)) {
                ext = ".jpg";
            }

            java.nio.file.Path targetFile = avatarDir.resolve("user_" + userId + ext);
            java.nio.file.Files.write(targetFile, isCompressed ? compressedBytes : rawBytes);

            java.nio.file.Path metaFile = avatarDir.resolve("user_" + userId + ".meta");
            java.nio.file.Files.writeString(metaFile, savedContentType);

            String avatarUrl = "/api/users/" + userId + "/avatar?v=" + System.currentTimeMillis();
            userService.updateProfilePicture(userId, avatarUrl);

            Map<String, Object> response = new HashMap<>();
            response.put("profilePictureUrl", avatarUrl);
            response.put("message", "Profile picture updated successfully");
            return ResponseEntity.ok(response);
        } catch (java.io.IOException e) {
            log.error("Failed to store avatar file for userId={}: {}", userId, e.getMessage(), e);
            throw new RuntimeException("Could not store avatar image", e);
        }
    }

    // ─── GET /api/users/{userId}/avatar ──────────────────────────────────────

    @Operation(
        summary = "Get user avatar image",
        description = "Streams the user avatar image binary directly."
    )
    @GetMapping("/{userId}/avatar")
    public ResponseEntity<byte[]> getAvatar(@PathVariable Long userId) {
        java.nio.file.Path avatarDir = getAvatarDir();

        for (String ext : java.util.List.of(".jpg", ".png", ".webp", ".gif", ".img")) {
            java.nio.file.Path file = avatarDir.resolve("user_" + userId + ext);
            if (java.nio.file.Files.exists(file)) {
                try {
                    byte[] data = java.nio.file.Files.readAllBytes(file);
                    java.nio.file.Path metaFile = avatarDir.resolve("user_" + userId + ".meta");
                    String contentType = "image/jpeg";
                    if (java.nio.file.Files.exists(metaFile)) {
                        contentType = java.nio.file.Files.readString(metaFile).trim();
                    } else if (ext.equals(".png")) {
                        contentType = "image/png";
                    } else if (ext.equals(".webp")) {
                        contentType = "image/webp";
                    } else if (ext.equals(".gif")) {
                        contentType = "image/gif";
                    }
                    return ResponseEntity.ok()
                            .contentType(MediaType.parseMediaType(contentType))
                            .header(org.springframework.http.HttpHeaders.CACHE_CONTROL, "public, max-age=3600")
                            .body(data);
                } catch (java.io.IOException ex) {
                    log.warn("Could not read avatar file {} for userId={}: {}", file, userId, ex.getMessage());
                }
            }
        }

        User user = userService.findById(userId).orElse(null);
        if (user != null && user.getProfilePictureUrl() != null && !user.getProfilePictureUrl().isBlank()
                && !user.getProfilePictureUrl().contains("/avatar")) {
            String profileUrl = user.getProfilePictureUrl().trim();
            // Mitigate Open Redirect / SSRF: only allow HTTP redirects to trusted avatar/OAuth CDNs
            boolean isSafeExternal = profileUrl.startsWith("https://lh3.googleusercontent.com/")
                    || profileUrl.startsWith("https://avatars.githubusercontent.com/")
                    || profileUrl.startsWith("https://secure.gravatar.com/")
                    || profileUrl.startsWith("https://www.gravatar.com/");
            if (isSafeExternal) {
                return ResponseEntity.status(org.springframework.http.HttpStatus.FOUND)
                        .location(java.net.URI.create(profileUrl))
                        .build();
            }
            log.warn("Blocked untrusted external avatar redirect for userId={}: {}", userId, profileUrl);
        }

        return ResponseEntity.notFound().build();
    }

    /**
     * Compresses and resizes raw avatar bytes to a max dimension of 256x256 using bilinear
     * filtering and JPEG 0.82 compression (or PNG if transparency is present).
     * Shrinks 5MB photos down to ~15KB - 35KB before storage and database synchronization.
     */
    private byte[] compressAvatarImage(byte[] rawBytes, String contentType) {
        if (rawBytes == null || rawBytes.length == 0) return rawBytes;
        try {
            java.io.ByteArrayInputStream bais = new java.io.ByteArrayInputStream(rawBytes);
            java.awt.image.BufferedImage original = javax.imageio.ImageIO.read(bais);
            if (original == null) {
                return rawBytes;
            }

            int origWidth = original.getWidth();
            int origHeight = original.getHeight();
            int maxDim = 256;
            int targetWidth = origWidth;
            int targetHeight = origHeight;

            if (origWidth > maxDim || origHeight > maxDim) {
                if (origWidth > origHeight) {
                    targetWidth = maxDim;
                    targetHeight = Math.max(1, (int) Math.round((double) origHeight * maxDim / origWidth));
                } else {
                    targetHeight = maxDim;
                    targetWidth = Math.max(1, (int) Math.round((double) origWidth * maxDim / origHeight));
                }
            }

            boolean isPng = contentType != null && contentType.toLowerCase(Locale.ROOT).contains("png");
            boolean hasAlpha = original.getColorModel().hasAlpha();

            int imageType = (hasAlpha && isPng)
                    ? java.awt.image.BufferedImage.TYPE_INT_ARGB
                    : java.awt.image.BufferedImage.TYPE_INT_RGB;
            java.awt.image.BufferedImage resized = new java.awt.image.BufferedImage(targetWidth, targetHeight, imageType);

            java.awt.Graphics2D g2d = resized.createGraphics();
            try {
                g2d.setRenderingHint(java.awt.RenderingHints.KEY_INTERPOLATION, java.awt.RenderingHints.VALUE_INTERPOLATION_BILINEAR);
                g2d.setRenderingHint(java.awt.RenderingHints.KEY_RENDERING, java.awt.RenderingHints.VALUE_RENDER_QUALITY);
                g2d.setRenderingHint(java.awt.RenderingHints.KEY_ANTIALIASING, java.awt.RenderingHints.VALUE_ANTIALIAS_ON);
                if (imageType == java.awt.image.BufferedImage.TYPE_INT_RGB) {
                    g2d.setColor(java.awt.Color.WHITE);
                    g2d.fillRect(0, 0, targetWidth, targetHeight);
                }
                g2d.drawImage(original, 0, 0, targetWidth, targetHeight, null);
            } finally {
                g2d.dispose();
            }

            java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
            if (hasAlpha && isPng) {
                javax.imageio.ImageIO.write(resized, "png", baos);
            } else {
                java.util.Iterator<javax.imageio.ImageWriter> writers = javax.imageio.ImageIO.getImageWritersByFormatName("jpg");
                if (writers.hasNext()) {
                    javax.imageio.ImageWriter writer = writers.next();
                    try (javax.imageio.stream.ImageOutputStream ios = javax.imageio.ImageIO.createImageOutputStream(baos)) {
                        writer.setOutput(ios);
                        javax.imageio.ImageWriteParam param = writer.getDefaultWriteParam();
                        if (param.canWriteCompressed()) {
                            param.setCompressionMode(javax.imageio.ImageWriteParam.MODE_EXPLICIT);
                            param.setCompressionQuality(0.82f);
                        }
                        writer.write(null, new javax.imageio.IIOImage(resized, null, null), param);
                    } finally {
                        writer.dispose();
                    }
                } else {
                    javax.imageio.ImageIO.write(resized, "jpg", baos);
                }
            }

            byte[] compressed = baos.toByteArray();
            if (compressed.length > 0 && compressed.length < rawBytes.length) {
                log.info("Compressed avatar image for storage: {} bytes -> {} bytes ({}% reduction)",
                        rawBytes.length, compressed.length,
                        Math.round((1.0 - (double) compressed.length / rawBytes.length) * 100));
                return compressed;
            }
            return rawBytes;
        } catch (Exception e) {
            log.warn("Avatar image compression failed, preserving original: {}", e.getMessage());
            return rawBytes;
        }
    }

    // ─── DELETE /api/users/{userId}/avatar ───────────────────────────────────

    @Operation(
        summary = "Delete user avatar image",
        description = "Removes uploaded user avatar and resets to default."
    )
    @DeleteMapping("/{userId}/avatar")
    public ResponseEntity<Void> deleteAvatar(@PathVariable Long userId) {
        log.info("Received request to delete avatar for userId={}", userId);
        userSecurity.validateUserAccess(userId);

        java.nio.file.Path avatarDir = getAvatarDir();
        for (String ext : java.util.List.of(".jpg", ".png", ".webp", ".gif", ".img", ".meta")) {
            try {
                java.nio.file.Files.deleteIfExists(avatarDir.resolve("user_" + userId + ext));
            } catch (Exception ex) {
                    log.debug("Notice while removing old avatar extension {} for userId={}: {}", ext, userId, ex.getMessage());
                }
        }
        userService.updateProfilePicture(userId, null);
        return ResponseEntity.noContent().build();
    }
}
