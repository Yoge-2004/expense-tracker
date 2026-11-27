package com.example.expensetracker.domain.expense.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import com.example.expensetracker.common.ErrorResponse;
import com.example.expensetracker.domain.expense.dto.ExpenseDto;
import com.example.expensetracker.domain.expense.service.RecurringExpenseService;
import com.example.expensetracker.domain.user.security.UserSecurity;

/**
 * Controller dedicated exclusively to recurring expense (subscription) lifecycle management.
 *
 * <p>Enforces Single Responsibility Principle (SRP) by decoupling recurring billing from core expense CRUD.</p>
 *
 * @author Yogeshwaran
 */
@Tag(
    name        = "Recurring Expenses",
    description = """
        Register and manage subscription-style charges (e.g. Netflix, Spotify, gym memberships).
        Adding a recurring expense immediately creates the first Expense occurrence and
        stores a RecurringExpense record with nextDueDate scheduled ahead.
        Subscriptions can be updated or cancelled without removing historical expense records.
        All endpoints require a valid JWT Bearer token.
        """
)
@Slf4j
@RequiredArgsConstructor
@SecurityRequirement(name = "BearerAuth")
@RestController
@RequestMapping("/api/expenses/recurring")
public class RecurringExpenseController {

    private final RecurringExpenseService recurringExpenseService;
    private final UserSecurity userSecurity;

    @Operation(
        summary = "Add recurring expense",
        description = """
            Registers a new monthly subscription and records the first payment.

            **What this endpoint does in a single call:**

            1. Creates a `RecurringExpense` record with:
               - `frequency = MONTHLY`
               - `nextDueDate = expenseDate + 1 month`
               - the provided `amount`, `description`, and `categoryId`.
            2. Creates an immediate `Expense` record for the first billing cycle
               dated at `expenseDate`.

            **Supported frequency:**

            Currently only `MONTHLY` recurring expenses are supported.
            The `nextDueDate` is informational — the system does not auto-charge.
            Use `GET /api/expenses/recurring/user/{userId}` to list upcoming due dates.

            **Cancelling:**

            Use `DELETE /api/expenses/recurring/{recId}` to cancel the subscription.
            Historical expense records created by the subscription are **not** deleted.
            """
    )
    @io.swagger.v3.oas.annotations.parameters.RequestBody(required = true, content = @Content(
        mediaType = MediaType.APPLICATION_JSON_VALUE,
        schema = @Schema(implementation = ExpenseDto.class),
        examples = @ExampleObject(
            name = "recurring-add-request", summary = "Netflix Premium monthly subscription",
            value = """
                { "amount": 649.00, "description": "Netflix Premium",
                  "expenseDate": "2025-06-01", "categoryId": 4 }
                """
        )
    ))
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Recurring expense registered and first payment recorded",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                examples = @ExampleObject(name = "recurring-add-200",
                    value = "{ \"message\": \"Recurring Expense Setup Successfully\" }"
                ))
        ),
        @ApiResponse(responseCode = "400", description = "User or category not found",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "recurring-add-400",
                    value = """
                        { "status": 400, "error": "Bad Request",
                          "message": "Category not found", "path": "/api/expenses/recurring/user/1" }
                        """
                ))
        ),
        @ApiResponse(responseCode = "401", description = "JWT token missing or invalid",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "recurring-add-401",
                    value = """
                        { "status": 401, "error": "Unauthorized",
                          "message": "JWT token is missing or invalid", "path": "/api/expenses/recurring/user/1" }
                        """
                ))
        )
    })
    @PostMapping("/user/{userId}")
    public ResponseEntity<?> addRecurring(
            @Parameter(description = "ID of user registering recurring expense.",
                    required = true, example = "1")
            @PathVariable Long userId,
            @RequestBody ExpenseDto dto) {
        userSecurity.validateUserAccess(userId);
        log.info("Received request to setup recurring expense for userId={}: amount={}, frequency={}, intervalDays={}, categoryId={}",
                userId, dto.amount(), dto.frequency(), dto.intervalDays(), dto.categoryId());
        recurringExpenseService.createRecurringExpense(userId, dto);
        return ResponseEntity.ok(Collections.singletonMap("message", "Recurring Expense Setup Successfully"));
    }

    @Operation(
        summary = "Get subscriptions",
        description = "Returns all recurring expenses registered by the user with next billing dates."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "List of recurring expenses (empty if none exist)"),
        @ApiResponse(responseCode = "400", description = "No user found with the given ID",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "401", description = "JWT token missing or invalid")
    })
    @GetMapping("/user/{userId}")
    public ResponseEntity<List<Map<String, Object>>> getSubscriptions(
            @Parameter(description = "ID of the user whose recurring expenses to retrieve.",
                    required = true, example = "1")
            @PathVariable Long userId) {
        userSecurity.validateUserAccess(userId);
        log.debug("Fetching recurring subscriptions for userId={}", userId);
        List<Map<String, Object>> response = recurringExpenseService.getUserSubscriptions(userId);
        return ResponseEntity.ok(response);
    }

    @Operation(
        summary = "Update subscription",
        description = "Partially updates a recurring expense subscription."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Subscription updated successfully",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                examples = @ExampleObject(name = "recurring-update-200",
                    value = "{ \"message\": \"Subscription updated successfully\" }"
                ))
        ),
        @ApiResponse(responseCode = "400", description = "Subscription not found",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "401", description = "JWT token missing or invalid")
    })
    @PutMapping({"", "/{recId}", "/{recId}/user/{userId}"})
    public ResponseEntity<?> updateSubscription(
            @Parameter(description = "ID of recurring expense subscription to update.",
                    required = true, example = "3")
            @PathVariable(value = "recId", required = false) Long recId,
            @PathVariable(value = "userId", required = false) Long userId,
            @RequestBody Map<String, Object> updates) {
        log.info("Received request to update subscription id={}, userId={}: fields={}",
                recId, userId, updates != null ? updates.keySet() : Collections.emptySet());
        if (userId != null) {
            userSecurity.validateUserAccess(userId);
        }
        recurringExpenseService.updateSubscription(recId, updates);
        return ResponseEntity.ok(Collections.singletonMap("message", "Subscription updated successfully"));
    }

    @Operation(
        summary = "Cancel subscription",
        description = "Permanently cancels (deletes) a recurring expense subscription."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Subscription cancelled — historical expenses preserved",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                examples = @ExampleObject(name = "recurring-delete-200",
                    value = "{ \"message\": \"Subscription cancelled successfully\" }"
                ))
        ),
        @ApiResponse(responseCode = "401", description = "JWT token missing or invalid")
    })
    @DeleteMapping({"", "/{recId}", "/{recId}/user/{userId}"})
    public ResponseEntity<?> deleteSubscription(
            @Parameter(description = "ID of recurring expense subscription to cancel.",
                    required = true, example = "3")
            @PathVariable(value = "recId", required = false) Long recId,
            @PathVariable(value = "userId", required = false) Long userId) {
        log.info("Received request to cancel recurring subscription id={}, userId={}", recId, userId);
        if (userId != null) {
            userSecurity.validateUserAccess(userId);
        }
        recurringExpenseService.deleteSubscription(recId);
        return ResponseEntity.ok(Collections.singletonMap("message", "Subscription cancelled successfully"));
    }
}
