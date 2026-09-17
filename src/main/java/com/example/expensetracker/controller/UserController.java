package com.example.expensetracker.controller;

import com.example.expensetracker.dto.DeleteAccountRequest;
import com.example.expensetracker.dto.ErrorResponse;
import com.example.expensetracker.dto.UserProfileDto;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.security.GoogleIdTokenVerifier;
import com.example.expensetracker.security.RateLimited;
import com.example.expensetracker.security.UserSecurity;
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
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
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
    private final UserSecurity userSecurity;
    private final PasswordEncoder passwordEncoder;
    private final GoogleIdTokenVerifier googleIdTokenVerifier;

    public UserController(UserService userService,
                          UserRepository userRepository,
                          UserSecurity userSecurity,
                          PasswordEncoder passwordEncoder,
                          GoogleIdTokenVerifier googleIdTokenVerifier) {
        this.userService = userService;
        this.userRepository = userRepository;
        this.userSecurity = userSecurity;
        this.passwordEncoder = passwordEncoder;
        this.googleIdTokenVerifier = googleIdTokenVerifier;
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
    @RateLimited(key = "user-suggest-usernames", maxRequests = 20, windowSeconds = 60, message = "Too many username suggestion requests. Please try again later.")
    @GetMapping("/suggest-usernames")
    public ResponseEntity<Map<String, Object>> suggestUsernames(
            @RequestParam(required = false, defaultValue = "user") String base) {
        String clean = base.replaceAll("[^a-zA-Z0-9]", "").toLowerCase();
        if (clean.isEmpty()) clean = "user";

        java.util.Set<String> uniqueSuggestions = new java.util.LinkedHashSet<>();
        java.util.Random rand = new java.util.Random();

        String[] prefixes = {"iam", "the", "real", "hey", "go"};
        for (String p : prefixes) {
            if (uniqueSuggestions.size() >= 3) break;
            String candidate = (p + "_" + clean).replaceAll("[^a-zA-Z0-9_]", "");
            if (candidate.length() > 30) candidate = candidate.substring(0, 30);
            if (!userRepository.findByUsernameIgnoreCase(candidate).isPresent()) {
                uniqueSuggestions.add(candidate);
            }
        }

        int attempts = 0;
        while (uniqueSuggestions.size() < 3 && attempts < 100) {
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

    // ─── GET /api/users/{userId} ──────────────────────────────────────────────

    @Operation(
        summary = "Get user profile",
        description = "Returns the user's basic profile fields — id, name, username, email, currency, and whether a Security PIN is set."
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
    @RateLimited(key = "update-pin", maxRequests = 10, windowSeconds = 300, message = "Too many PIN update attempts. Please try again in %d seconds.")
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
    @RateLimited(key = "verify-pin", maxRequests = 10, windowSeconds = 300, message = "Too many verification attempts. Please try again later.")
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
    @RateLimited(key = "delete-account", maxRequests = 5, windowSeconds = 300, message = "Too many account deletion attempts. Please try again in %d seconds.")
    public ResponseEntity<Void> deleteAccount(
            @Parameter(description = "Database ID of the user account to permanently delete.", required = true, example = "1")
            @PathVariable Long userId,
            @RequestBody(required = false) DeleteAccountRequest request) {
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
                    verified = identity.email() != null && identity.email().equalsIgnoreCase(user.getEmail());
                } catch (Exception e) {
                    log.warn("Google ID token verification failed during account deletion for userId={}: {}", userId, e.getMessage());
                    verified = false;
                }
            }
        }

        if (!verified) {
            log.warn("Account deletion denied for userId={}: Invalid or missing credentials confirmation", userId);
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
            @Parameter(description = "Database ID of the user whose currency to update.", required = true, example = "1")
            @PathVariable Long userId,
            @RequestBody Map<String, String> body) {
        log.info("Received request to update currency for userId={}", userId);
        userSecurity.validateUserAccess(userId);

        String currency = body != null ? body.get("currency") : null;
        if (currency == null || !currency.trim().matches("^[A-Za-z]{3}$")) {
            throw new IllegalArgumentException("Currency must be a valid 3-letter ISO 4217 code (e.g., USD, EUR, INR)");
        }

        userService.updateCurrency(userId, currency.trim().toUpperCase(java.util.Locale.ROOT));
        log.info("Currency successfully updated to '{}' for userId={}", currency.toUpperCase(), userId);
        return ResponseEntity.ok(Map.of("message", "Currency preference updated successfully",
                "currency", currency.trim().toUpperCase(java.util.Locale.ROOT)));
    }
}
