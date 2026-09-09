package com.example.expensetracker.controller;

import com.example.expensetracker.dto.DeleteAccountRequest;
import com.example.expensetracker.dto.ErrorResponse;
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

    @Operation(summary = "Check username availability", description = "Returns whether a username is available, valid, or already taken in real time.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Availability status returned"),
        @ApiResponse(responseCode = "400", description = "Username query parameter is empty")
    })
    @GetMapping("/check-username")
    public ResponseEntity<Map<String, Object>> checkUsername(@RequestParam(required = false) String username) {
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

    @Operation(summary = "Get user profile", description = "Returns the user's basic profile fields — id, name, email, currency, and whether a Security PIN is set.")
    @GetMapping("/{userId}")
    public ResponseEntity<Map<String, Object>> getUserProfile(
            @Parameter(description = "Database ID of the user whose profile to fetch.", required = true, example = "1")
            @PathVariable Long userId) {
        userSecurity.validateUserAccess(userId);
        User user = userService.findById(userId).orElseThrow(() -> new IllegalArgumentException("User not found"));
        Map<String, Object> map = new HashMap<>();
        map.put("id", user.getId()); map.put("name", user.getName()); map.put("email", user.getEmail());
        map.put("currency", user.getCurrency()); map.put("hasSecurityPin", user.hasSecurityPin());
        return ResponseEntity.ok(map);
    }

    @PutMapping("/{userId}/security-pin")
    @RateLimited(key = "update-pin", maxRequests = 10, windowSeconds = 300, message = "Too many PIN update attempts. Please try again in %d seconds.")
    public ResponseEntity<Map<String, String>> updateSecurityPin(@PathVariable Long userId, @RequestBody Map<String, String> body) {
        userSecurity.validateUserAccess(userId);
        String pin = body.get("securityPin");
        if (pin == null || !pin.trim().matches("^[0-9]{6}$")) throw new IllegalArgumentException("Security PIN must be exactly 6 numeric digits.");
        userService.updateSecurityPin(userId, pin.trim());
        return ResponseEntity.ok(Map.of("message", "Security PIN updated successfully"));
    }

    @PostMapping("/{userId}/verify-security-pin")
    @RateLimited(key = "verify-pin", maxRequests = 5, windowSeconds = 300, message = "Too many PIN verification attempts. Please try again in %d seconds.")
    public ResponseEntity<Map<String, Object>> verifySecurityPin(@PathVariable Long userId, @RequestBody Map<String, String> body) {
        userSecurity.validateUserAccess(userId);
        String pin = body.get("securityPin");
        if (pin == null || !pin.trim().matches("^[0-9]{6}$")) throw new IllegalArgumentException("Security PIN must be exactly 6 numeric digits.");
        boolean valid = userService.verifySecurityPin(userId, pin.trim());
        if (!valid) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("valid", false, "message", "Invalid security PIN."));
        return ResponseEntity.ok(Map.of("valid", true, "message", "Security PIN verified successfully."));
    }

    @DeleteMapping("/{userId}")
    @RateLimited(key = "delete-account", maxRequests = 5, windowSeconds = 300, message = "Too many account deletion attempts. Please try again in %d seconds.")
    public ResponseEntity<Void> deleteAccount(@PathVariable Long userId, @RequestBody(required = false) DeleteAccountRequest request) {
        userSecurity.validateUserAccess(userId);
        User user = userService.findById(userId).orElseThrow(() -> new IllegalArgumentException("User not found"));
        boolean verified = false;
        if (request != null) {
            if (request.getPassword() != null && !request.getPassword().isBlank()) verified = passwordEncoder.matches(request.getPassword(), user.getPassword());
            else if (request.getSecurityPin() != null && !request.getSecurityPin().isBlank()) verified = userService.verifySecurityPin(userId, request.getSecurityPin().trim());
            else if (request.getGoogleIdToken() != null && !request.getGoogleIdToken().isBlank()) {
                try { var identity = googleIdTokenVerifier.verify(request.getGoogleIdToken()); verified = identity.email() != null && identity.email().equalsIgnoreCase(user.getEmail()); }
                catch (Exception e) { log.warn("Google ID token verification failed during account deletion for userId={}: {}", userId, e.getMessage()); }
            }
        }
        if (!verified) throw new BadCredentialsException("Invalid or missing password confirmation. Account deletion requires re-authentication.");
        userService.deleteUser(userId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{userId}/currency")
    public ResponseEntity<Map<String, String>> updateCurrency(@PathVariable Long userId, @RequestBody Map<String, String> body) {
        userSecurity.validateUserAccess(userId);
        String currency = body.get("currency");
        if (currency == null || currency.isBlank() || currency.length() != 3) return ResponseEntity.badRequest().body(Map.of("message", "currency must be a 3-letter ISO 4217 code"));
        userService.updateCurrency(userId, currency.toUpperCase());
        return ResponseEntity.ok(Map.of("currency", currency.toUpperCase()));
    }
}
