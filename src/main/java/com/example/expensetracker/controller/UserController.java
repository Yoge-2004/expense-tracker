package com.example.expensetracker.controller;

import com.example.expensetracker.dto.ErrorResponse;
import com.example.expensetracker.service.UserService;
import com.example.expensetracker.model.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Tag(
    name        = "Users",
    description = """
        Manages user account-level operations.

        Currently exposes a single endpoint for **permanent account deletion**.
        Deletion is cascading — all data owned by the user (expenses and personal
        categories) is removed before the account itself is deleted, ensuring no
        orphaned records remain in the database.

        All endpoints require a valid **JWT Bearer token**.
        """
)
@SecurityRequirement(name = "BearerAuth")
@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;
    private final com.example.expensetracker.repository.UserRepository userRepository;

    public UserController(UserService userService, com.example.expensetracker.repository.UserRepository userRepository) {
        this.userService = userService;
        this.userRepository = userRepository;
    }

    @io.swagger.v3.oas.annotations.security.SecurityRequirements
    @GetMapping("/suggest-usernames")
    public ResponseEntity<java.util.Map<String, Object>> suggestUsernames(
            @RequestParam(defaultValue = "user") String base) {

        String prefix = base.trim().toLowerCase().replaceAll("[^a-z0-9]", "");
        if (prefix.isBlank()) prefix = "user";

        java.util.Random rnd = new java.util.Random();

        // 1. Hardcoded suffix '_26'
        String s1 = prefix + "_26";
        while (userRepository.existsByNameIgnoreCase(s1)) {
            s1 = prefix + "_26" + rnd.nextInt(90 + 10);
        }

        // 2. Hardcoded suffix '.pro'
        String s2 = prefix + ".pro";
        while (userRepository.existsByNameIgnoreCase(s2)) {
            s2 = prefix + ".pro" + rnd.nextInt(90 + 10);
        }

        // 3. Random suffix
        String s3 = prefix + "_" + (10 + rnd.nextInt(89));
        while (userRepository.existsByNameIgnoreCase(s3)) {
            s3 = prefix + "_" + (100 + rnd.nextInt(899));
        }

        java.util.Map<String, Object> response = new java.util.HashMap<>();
        response.put("suggestions", java.util.List.of(s1, s2, s3));
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{userId}")
    public ResponseEntity<java.util.Map<String, Object>> getUserProfile(@PathVariable Long userId) {
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        java.util.Map<String, Object> map = new java.util.HashMap<>();
        map.put("id", user.getId());
        map.put("name", user.getName());
        map.put("email", user.getEmail());
        map.put("currency", user.getCurrency());
        return ResponseEntity.ok(map);
    }

    // ─── DELETE /api/users/{userId} ───────────────────────────────────────

    @Operation(
        summary = "Delete account",
        description = """
            Permanently deletes a user account and all data associated with it.

            **Deletion order (three-step cascade inside a single transaction):**
            1. All `Expense` records owned by the user are deleted first.
            2. All user-created `Category` records (personal categories) are deleted.
            3. The `User` record itself is deleted last.

            **What is NOT deleted:**
            - Global (system-seeded) categories — these have `user_id = NULL`
              and are shared across all users.
            - `RecurringExpense` records are not explicitly cascaded in this flow;
              they should be cancelled via `DELETE /api/expenses/recurring/{recId}`
              before deleting the account.

            ⚠️ **This action is irreversible.** There is no soft-delete or recycle bin.
            Once confirmed, the account and all its financial records are permanently gone.

            **After deletion:**
            Any JWT token issued to this user before deletion will be rejected on the next
            protected request because Spring Security can no longer load the UserDetails
            for the deleted email.
            """
    )
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Account and all associated data permanently deleted — no body returned"),
        @ApiResponse(responseCode = "400", description = "No user found with the given ID",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "user-delete-400",
                    value = "{ \"status\": 400, \"error\": \"Bad Request\", \"message\": \"User not found\", \"path\": \"/api/users/99\" }"
                ))
        ),
        @ApiResponse(responseCode = "401", description = "JWT token missing or invalid — request rejected before reaching the controller",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "user-delete-401",
                    value = "{ \"status\": 401, \"error\": \"Unauthorized\", \"message\": \"JWT token is missing or invalid\", \"path\": \"/api/users/1\" }"
                ))
        )
    })
    @DeleteMapping("/{userId}")
    public ResponseEntity<Void> deleteAccount(
            @Parameter(
                description = "Database ID of the user account to permanently delete.",
                required = true, example = "1"
            )
            @PathVariable Long userId) {
        userService.deleteUser(userId);
        return ResponseEntity.noContent().build();
    }

    // ─── PUT /api/users/{userId}/currency ─────────────────────────────────

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
    public ResponseEntity<java.util.Map<String, String>> updateCurrency(
            @PathVariable Long userId,
            @org.springframework.web.bind.annotation.RequestBody java.util.Map<String, String> body) {
        String currency = body.get("currency");
        if (currency == null || currency.isBlank() || currency.length() != 3) {
            return ResponseEntity.badRequest()
                    .body(java.util.Map.of("message", "currency must be a 3-letter ISO 4217 code"));
        }
        userService.updateCurrency(userId, currency.toUpperCase());
        return ResponseEntity.ok(java.util.Map.of("currency", currency.toUpperCase()));
    }
}
