package com.example.expensetracker.controller;

import com.example.expensetracker.dto.ErrorResponse;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.security.RateLimited;
import com.example.expensetracker.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.HashMap;

@Tag(
    name        = "User Management",
    description = """
        User account lookup, profile management, and cascading account deletion.
        """
)
@RestController
@RequestMapping("/api/users")
public class UserController {

    private static final Logger log = LoggerFactory.getLogger(UserController.class);

    private final UserService userService;
    private final UserRepository userRepository;
    private final com.example.expensetracker.security.UserSecurity userSecurity;

    public UserController(UserService userService, UserRepository userRepository,
                          com.example.expensetracker.security.UserSecurity userSecurity) {
        this.userService = userService;
        this.userRepository = userRepository;
        this.userSecurity = userSecurity;
    }

    // ─── GET /api/users/check-username ───────────────────────────────────────────

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
        boolean validFormat = trimmed.matches("^[a-zA-Z0-9_]{3,30}$");
        if (!validFormat) {
            Map<String, Object> invalid = new HashMap<>();
            invalid.put("available", false);
            invalid.put("message", "Username must be 3-30 alphanumeric characters or underscores");
            return ResponseEntity.ok(invalid);
        }

        boolean exists = userRepository.findByUsernameIgnoreCase(trimmed).isPresent();
        Map<String, Object> res = new HashMap<>();
        res.put("available", !exists);
        res.put("username", trimmed);
        res.put("message", exists ? "Username is already taken" : "Username is available!");
        return ResponseEntity.ok(res);
    }

    // ─── GET /api/users/suggest-usernames ────────────────────────────────────────

    @Operation(
        summary = "Generate username suggestions",
        description = "Generates 4 unique, creative username suggestions based on a name or keyword."
    )
    @GetMapping("/suggest-usernames")
    public ResponseEntity<Map<String, Object>> suggestUsernames(
            @RequestParam(required = false, defaultValue = "user") String base) {
        String clean = base.replaceAll("[^a-zA-Z0-9]", "").toLowerCase();
        if (clean.isEmpty()) clean = "user";

        java.util.Set<String> uniqueSuggestions = new java.util.LinkedHashSet<>();
        java.util.Random rand = new java.util.Random();

        String[] prefixes = {"iam", "the", "real", "hey", "go"};
        for (String p : prefixes) {
            if (uniqueSuggestions.size() >= 4) break;
            String candidate = (p + "_" + clean).replaceAll("[^a-zA-Z0-9_]", "");
            if (candidate.length() > 30) candidate = candidate.substring(0, 30);
            if (!userRepository.findByUsernameIgnoreCase(candidate).isPresent()) {
                uniqueSuggestions.add(candidate);
            }
        }

        int attempts = 0;
        while (uniqueSuggestions.size() < 4 && attempts < 20) {
            attempts++;
            int num = 100 + rand.nextInt(900);
            String candidate = clean + num;
            if (candidate.length() > 30) candidate = candidate.substring(0, 30);
            if (!userRepository.findByUsernameIgnoreCase(candidate).isPresent()) {
                uniqueSuggestions.add(candidate);
            }
        }

        log.info("Generated {} username suggestions for base='{}'", uniqueSuggestions.size(), base);
        Map<String, Object> response = new HashMap<>();
        response.put("suggestions", new java.util.ArrayList<>(uniqueSuggestions));
        return ResponseEntity.ok(response);
    }

    // ─── GET /api/users/{userId} ─────────────────────────────────────────────────

    @Operation(
        summary = "Get user profile",
        description = "Returns the user's basic profile fields — id, name, email, currency, and whether a Security PIN is set."
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
        map.put("email", user.getEmail());
        map.put("currency", user.getCurrency());
        map.put("hasSecurityPin", user.hasSecurityPin());
        return ResponseEntity.ok(map);
    }

    // ─── PUT /api/users/{userId}/security-pin ─────────────────────────────────────

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
    @RateLimited(key = "update-pin", maxRequests = 10, windowSeconds = 300, message = "Too many PIN update attempts. Please try again in %d seconds.")
    public ResponseEntity<Map<String, String>> updateSecurityPin(
            @PathVariable Long userId,
            @RequestBody Map<String, String> body) {
        String pin = body.get("securityPin");
        log.info("Request to update Security PIN for userId={}", userId);
        userSecurity.validateUserAccess(userId);
        if (pin == null || !pin.trim().matches("^[0-9]{6}$")) {
            throw new IllegalArgumentException("Security PIN must be exactly 6 numeric digits.");
        }
        userService.updateSecurityPin(userId, pin.trim());
        return ResponseEntity.ok(Map.of("message", "Security PIN updated successfully"));
    }

    // ─── POST /api/users/{userId}/verify-security-pin ────────────────────────────

    @Operation(
        summary = "Verify 6-digit Security PIN",
        description = "Verifies the provided 6-digit Security PIN against the user's stored hash. Rate-limited to prevent brute forcing."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "PIN verification succeeded"),
        @ApiResponse(responseCode = "400", description = "Invalid PIN format or user not found",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "401", description = "Incorrect Security PIN",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "403", description = "Access is denied (IDOR protection)",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "429", description = "Too many requests (rate limit exceeded)",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping("/{userId}/verify-security-pin")
    @RateLimited(key = "verify-pin", maxRequests = 5, windowSeconds = 300, message = "Too many PIN verification attempts. Please try again in %d seconds.")
    public ResponseEntity<Map<String, Object>> verifySecurityPin(
            @PathVariable Long userId,
            @RequestBody Map<String, String> body) {
        log.info("Request to verify Security PIN for userId={}", userId);
        userSecurity.validateUserAccess(userId);
        String pin = body.get("securityPin");
        if (pin == null || !pin.trim().matches("^[0-9]{6}$")) {
            throw new IllegalArgumentException("Security PIN must be exactly 6 numeric digits.");
        }
        boolean valid = userService.verifySecurityPin(userId, pin.trim());
        if (!valid) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("valid", false, "message", "Invalid security PIN."));
        }
        return ResponseEntity.ok(Map.of("valid", true, "message", "Security PIN verified successfully."));
    }

    // ─── DELETE /api/users/{userId} ──────────────────────────────────────────────

    @Operation(
        summary = "Delete account",
        description = """
            Permanently deletes a user account and all data associated with it.
            """
    )
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Account and all associated data permanently deleted"),
        @ApiResponse(responseCode = "400", description = "No user found with the given ID",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "401", description = "JWT token missing or invalid",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class)))
    })
    @DeleteMapping("/{userId}")
    public ResponseEntity<Void> deleteAccount(
            @Parameter(description = "Database ID of the user account to permanently delete.", required = true, example = "1")
            @PathVariable Long userId) {
        log.info("Received request to permanently delete account for userId={}", userId);
        userSecurity.validateUserAccess(userId);
        userService.deleteUser(userId);
        log.info("Account userId={} permanently deleted", userId);
        return ResponseEntity.noContent().build();
    }

    // ─── PUT /api/users/{userId}/currency ────────────────────────────────────────

    @Operation(
        summary = "Update currency preference",
        description = "Updates the preferred display currency for the given user account. Accepts any ISO 4217 3-letter code."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Currency preference updated"),
        @ApiResponse(responseCode = "400", description = "User not found or invalid currency code",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PutMapping("/{userId}/currency")
    public ResponseEntity<Map<String, String>> updateCurrency(
            @PathVariable Long userId,
            @RequestBody Map<String, String> body) {
        String currency = body.get("currency");
        log.info("Received request to update currency for userId={} to {}", userId, currency);
        userSecurity.validateUserAccess(userId);
        if (currency == null || currency.isBlank() || currency.length() != 3) {
            log.warn("Invalid currency format '{}' for userId={}", currency, userId);
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "currency must be a 3-letter ISO 4217 code"));
        }
        userService.updateCurrency(userId, currency.toUpperCase());
        log.info("Currency preference updated for userId={} to {}", userId, currency.toUpperCase());
        return ResponseEntity.ok(Map.of("currency", currency.toUpperCase()));
    }
}
