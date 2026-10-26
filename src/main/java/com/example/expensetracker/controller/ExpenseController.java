package com.example.expensetracker.controller;

import com.example.expensetracker.dto.*;
import com.example.expensetracker.mapper.ExpenseMapper;
import com.example.expensetracker.model.*;
import com.example.expensetracker.repository.*;
import com.example.expensetracker.service.ExpenseService;
import com.example.expensetracker.service.BudgetService;
import com.example.expensetracker.service.ExportService;
import com.example.expensetracker.service.RecurringExpenseService;
import com.example.expensetracker.service.ImportService;
import com.example.expensetracker.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

@Tag(
    name        = "Expenses",
    description = """
        Central resource of the Expense Tracker — covers three sub-domains:

        **1. Expense Records** (`/api/expenses/user/{userId}`)
        Full CRUD for individual expense entries. Each expense has an amount,
        description, date, and a category (global or personal). Ownership is
        enforced — a user can only view, edit, or delete their own records.

        **2. Budgets** (`/api/expenses/budget/...`)
        Set a monthly spending cap per category. Query real-time utilisation
        (spent vs limit, percentage consumed) for the current calendar month.
        A percentage > 100 means the user is over budget for that category.

        **3. Recurring Expenses** (`/api/expenses/recurring/...`)
        Register subscription-style charges (e.g. Netflix, Spotify). Adding a
        recurring expense immediately creates the first `Expense` occurrence and
        stores a `RecurringExpense` record with `frequency=MONTHLY` and
        `nextDueDate` set to one month ahead. Subscriptions can be updated or
        cancelled without removing historical expense records.

        All endpoints require a valid **JWT Bearer token**.
        """
)
@Slf4j
@RequiredArgsConstructor
@SecurityRequirement(name = "BearerAuth")
@RestController
@RequestMapping("/api/expenses")
public class ExpenseController {

    private final ExpenseService expenseService;
    private final UserService userService;
    private final CategoryRepository categoryRepository;
    private final BudgetService budgetService;
    private final RecurringExpenseService recurringExpenseService;
    private final ExpenseRepository expenseRepository;
    private final ExportService exportService;
    private final ImportService importService;
    private final com.example.expensetracker.security.UserSecurity userSecurity;


    // ═════════════════════════════════════════════════════════════════════
    //  EXPENSE CRUD
    // ═════════════════════════════════════════════════════════════════════

    @Operation(
        summary = "Create expense",
        description = """
            Records a new expense for the specified user.

            **Required fields:**
            - `amount` — must be a **positive number** greater than zero (validated by `@Positive`).
            - `expenseDate` — ISO-8601 date string, e.g. `"2025-06-15"`.
            - `categoryId` — must reference an existing category (global or personal).

            **Optional fields:**
            - `description` — a short note about the expense (no length limit enforced).

            **Category ownership validation:**
            The referenced category must be either:
            - A **global** category (e.g. Food = 1, Transport = 2), or
            - A **personal** category created by the same user.

            Attempting to use another user's personal category returns `400`.

            **Returns:** the saved expense with a generated `id` and the resolved `categoryName`.
            """
    )
    @RequestBody(required = true, content = @Content(
        mediaType = MediaType.APPLICATION_JSON_VALUE,
        schema = @Schema(implementation = ExpenseRequest.class),
        examples = @ExampleObject(
            name = "expense-create-request", summary = "Lunch expense under Food category",
            value = """
                { "amount": 199.99, "description": "Lunch at Saravana Bhavan",
                  "expenseDate": "2025-06-15", "categoryId": 1 }
                """
        )
    ))
    @ApiResponses({
        @ApiResponse(responseCode = "201",
            description = "Expense saved — returns the complete record with generated ID",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ExpenseDto.class),
                examples = @ExampleObject(name = "expense-create-201",
                    summary = "Saved expense with ID and category name",
                    value = """
                        { "id": 42, "amount": 199.99, "description": "Lunch at Saravana Bhavan",
                          "expenseDate": "2025-06-15", "categoryId": 1, "categoryName": "Food" }
                        """
                ))
        ),
        @ApiResponse(responseCode = "400",
            description = "Validation failed — amount ≤ 0, missing date, missing categoryId, or unknown category",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "expense-create-400",
                    value = """
                        { "status": 400, "error": "Bad Request",
                          "message": "amount: must be greater than 0", "path": "/api/expenses/user/1" }
                        """
                ))
        ),
        @ApiResponse(responseCode = "401", description = "JWT token missing or invalid",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "expense-create-401",
                    value = """
                        { "status": 401, "error": "Unauthorized",
                          "message": "JWT token is missing or invalid", "path": "/api/expenses/user/1" }
                        """
                ))
        )
    })
    @PostMapping("/user/{userId}")
    public ResponseEntity<ExpenseDto> createExpense(
            @Parameter(description = "ID of the authenticated user creating the expense.",
                    required = true, example = "1")
            @PathVariable Long userId,
            @Valid @org.springframework.web.bind.annotation.RequestBody ExpenseRequest request) {
        userSecurity.validateUserAccess(userId);
        log.info("Received request to create expense for userId={}: amount={}, date={}, categoryId={}",
                userId, request.amount(), request.expenseDate(), request.categoryId());
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Expense expense = new Expense();
        expense.setAmount(request.amount());
        expense.setDescription(request.description());
        expense.setExpenseDate(request.expenseDate());
        expense.setRecurring(Boolean.TRUE.equals(request.isRecurring()));
        Category category = new Category();
        category.setId(request.categoryId());
        expense.setCategory(category);
        Expense saved = expenseService.createExpense(expense, user);
        log.info("Expense created successfully with id={} for userId={}", saved.getId(), userId);
        return new ResponseEntity<>(ExpenseMapper.toDto(saved), HttpStatus.CREATED);
    }

    @Operation(
        summary = "Get expenses",
        description = """
            Returns all expense records belonging to the specified user.

            **Ordering:** expenses are returned in the order they were persisted
            (no explicit sort applied at the query level).

            **Empty list:** a new user with no recorded expenses will receive `[]`.
            This is a valid, non-error response.

            **Filtering / pagination:** not supported in the current version.
            All expenses for the user are returned in a single response.
            Use `GET /api/expenses/budget/status/user/{userId}` to see a
            category-level spending summary for the current month.
            """
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "All expense records for the user (empty array if none exist)",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                array = @ArraySchema(schema = @Schema(implementation = ExpenseDto.class)),
                examples = @ExampleObject(name = "expense-list-200",
                    summary = "Two expenses across different categories",
                    value = """
                        [ { "id": 42, "amount": 199.99, "description": "Lunch at Saravana Bhavan",
                            "expenseDate": "2025-06-15", "categoryId": 1, "categoryName": "Food" },
                          { "id": 43, "amount": 55.00, "description": "Metro card recharge",
                            "expenseDate": "2025-06-10", "categoryId": 2, "categoryName": "Transport" } ]
                        """
                ))
        ),
        @ApiResponse(responseCode = "400", description = "No user found with the given ID",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "expense-list-400",
                    value = """
                        { "status": 400, "error": "Bad Request",
                          "message": "User not found", "path": "/api/expenses/user/99" }
                        """
                ))
        ),
        @ApiResponse(responseCode = "401", description = "JWT token missing or invalid",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "expense-list-401",
                    value = """
                        { "status": 401, "error": "Unauthorized",
                          "message": "JWT token is missing or invalid", "path": "/api/expenses/user/1" }
                        """
                ))
        )
    })
    @GetMapping("/user/{userId}")
    public ResponseEntity<List<ExpenseDto>> getExpenses(
            @Parameter(description = "ID of the user whose expense records to retrieve.",
                    required = true, example = "1")
            @PathVariable Long userId) {
        userSecurity.validateUserAccess(userId);
        log.debug("Fetching expense records for userId={}", userId);
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        List<ExpenseDto> expenses = expenseService.getUserExpenses(user)
                .stream().map(ExpenseMapper::toDto).toList();
        log.info("Retrieved {} expense records for userId={}", expenses.size(), userId);
        return ResponseEntity.ok(expenses);
    }

    @Operation(
        summary = "Update expense",
        description = """
            Updates one or more fields of an existing expense record.

            **Updatable fields:** `amount`, `description`, `expenseDate`, `categoryId`.
            Only fields present in the request body are applied — omitted fields
            retain their current values.

            **Ownership validation:**
            The expense identified by `expenseId` must belong to the user identified
            by `userId`. If the expense exists but belongs to a different user,
            the request is rejected.

            **Category change:**
            If `categoryId` is provided, the new category must exist in the database.
            The same ownership rules apply — global or the user's own personal categories only.
            """
    )
    @RequestBody(required = true, content = @Content(
        mediaType = MediaType.APPLICATION_JSON_VALUE,
        schema = @Schema(implementation = ExpenseDto.class),
        examples = @ExampleObject(
            name = "expense-update-request", summary = "Adjust amount and description",
            value = """
                { "amount": 225.00, "description": "Lunch + dessert",
                  "expenseDate": "2025-06-15", "categoryId": 1 }
                """
        )
    ))
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Expense updated — full updated record returned",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ExpenseDto.class),
                examples = @ExampleObject(name = "expense-update-200", summary = "Updated expense record",
                    value = """
                        { "id": 42, "amount": 225.00, "description": "Lunch + dessert",
                          "expenseDate": "2025-06-15", "categoryId": 1, "categoryName": "Food" }
                        """
                ))
        ),
        @ApiResponse(responseCode = "400", description = "Expense does not belong to this user",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "expense-update-400",
                    value = """
                        { "status": 400, "error": "Bad Request",
                          "message": "Expense does not belong to this user", "path": "/api/expenses/42/user/2" }
                        """
                ))
        ),
        @ApiResponse(responseCode = "500", description = "Expense not found (expense ID does not exist)",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "expense-update-500",
                    value = """
                        { "status": 500, "error": "Internal Server Error",
                          "message": "Unexpected error occurred", "path": "/api/expenses/999/user/1" }
                        """
                ))
        ),
        @ApiResponse(responseCode = "401", description = "JWT token missing or invalid",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "expense-update-401",
                    value = """
                        { "status": 401, "error": "Unauthorized",
                          "message": "JWT token is missing or invalid", "path": "/api/expenses/42/user/1" }
                        """
                ))
        )
    })
    @PutMapping("/{expenseId}/user/{userId}")
    public ResponseEntity<ExpenseDto> updateExpense(
            @Parameter(description = "ID of the expense record to update.", required = true, example = "42")
            @PathVariable Long expenseId,
            @Parameter(description = "ID of the user who owns the expense.", required = true, example = "1")
            @PathVariable Long userId,
            @Valid @org.springframework.web.bind.annotation.RequestBody ExpenseDto expenseDto) {
        userSecurity.validateUserAccess(userId);
        log.info("Received request to update expense id={} for userId={}: amount={}, categoryId={}",
                expenseId, userId, expenseDto.amount(), expenseDto.categoryId());
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Expense expenseUpdates = new Expense();
        expenseUpdates.setDescription(expenseDto.description());
        expenseUpdates.setAmount(expenseDto.amount());
        expenseUpdates.setExpenseDate(expenseDto.expenseDate());
        if (expenseDto.isRecurring() != null) {
            expenseUpdates.setRecurring(expenseDto.isRecurring());
        }
        if (expenseDto.categoryId() != null) {
            Category category = categoryRepository.findById(expenseDto.categoryId())
                    .orElseThrow(() -> new IllegalArgumentException("Category not found"));
            // Ownership check: prevent IDOR — user must not be able to assign another user's
            // private category to their own expense. Global categories (user == null) are shared.
            if (category.getUser() != null && !category.getUser().getId().equals(user.getId())) {
                log.warn("IDOR attempt: user {} tried to assign foreign category {} to expense {}",
                        userId, expenseDto.categoryId(), expenseId);
                throw new AccessDeniedException("Category does not belong to this user");
            }
            expenseUpdates.setCategory(category);
        }
        Expense updated = expenseService.updateExpense(expenseId, expenseUpdates, user);
        log.info("Expense id={} successfully updated for userId={}", expenseId, userId);
        return ResponseEntity.ok(mapToDto(updated));
    }

    @Operation(
        summary = "Delete expense",
        description = """
            Permanently deletes a single expense record.

            **Ownership validation:**
            The expense identified by `expenseId` must belong to the user identified
            by `userId`. If ownership does not match, the request is rejected with `400`
            and the record is **not** deleted.

            **Irreversible:** deleted expenses cannot be recovered. There is no
            soft-delete or undo mechanism.

            **Recurring expenses:**
            Deleting an expense record created by a recurring subscription does NOT
            cancel the subscription itself. Use `DELETE /api/expenses/recurring/{recId}`
            to cancel the recurring schedule.
            """
    )
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Expense deleted — no body returned"),
        @ApiResponse(responseCode = "400", description = "User not found or expense does not belong to this user",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "expense-delete-400",
                    value = """
                        { "status": 400, "error": "Bad Request",
                          "message": "Expense does not belong to this user", "path": "/api/expenses/42/user/2" }
                        """
                ))
        ),
        @ApiResponse(responseCode = "401", description = "JWT token missing or invalid",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "expense-delete-401",
                    value = """
                        { "status": 401, "error": "Unauthorized",
                          "message": "JWT token is missing or invalid", "path": "/api/expenses/42/user/1" }
                        """
                ))
        )
    })
    @DeleteMapping("/{expenseId}/user/{userId}")
    public ResponseEntity<Void> deleteExpense(
            @Parameter(description = "ID of the user who owns the expense.", required = true, example = "1")
            @PathVariable Long userId,
            @Parameter(description = "ID of the expense record to permanently delete.", required = true, example = "42")
            @PathVariable Long expenseId) {
        userSecurity.validateUserAccess(userId);
        log.info("Received request to delete expense id={} for userId={}", expenseId, userId);
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        expenseService.deleteExpense(expenseId, user);
        log.info("Expense id={} successfully deleted for userId={}", expenseId, userId);
        return ResponseEntity.noContent().build();
    }

    // ═════════════════════════════════════════════════════════════════════
    //  BUDGET
    // ═════════════════════════════════════════════════════════════════════

    @Operation(
        summary = "Set category budget",
        description = """
            Sets or updates the monthly spending limit for a specific category.

            **Upsert behaviour:**
            - If no budget exists for this user + category combination, a new record is created.
            - If a budget already exists, the `limitAmount` is overwritten.

            **Validation:**
            - `limitAmount` must be **greater than zero**. Zero and negative values are
              rejected with `400` before the database is touched.
            - `categoryId` must reference an existing category.

            **Budget tracking:**
            The budget limit is not enforced at the point of expense creation — users can
            always record an expense even if a budget has been exceeded. The budget is purely
            for monitoring purposes via `GET /api/expenses/budget/status/user/{userId}`.
            """
    )
    @RequestBody(required = true, content = @Content(
        mediaType = MediaType.APPLICATION_JSON_VALUE,
        schema = @Schema(implementation = BudgetDto.class),
        examples = @ExampleObject(
            name = "budget-set-request", summary = "Set ₹3000/month budget for Food",
            value = "{ \"categoryId\": 1, \"limitAmount\": 3000.00 }"
        )
    ))
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Budget saved (created or updated)",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                examples = @ExampleObject(name = "budget-set-200",
                    value = "{ \"message\": \"Budget set successfully\" }"
                ))
        ),
        @ApiResponse(responseCode = "400", description = "limitAmount ≤ 0, or user / category not found",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "budget-set-400",
                    value = "{ \"error\": \"Budget limit must be a positive number\" }"
                ))
        ),
        @ApiResponse(responseCode = "401", description = "JWT token missing or invalid",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "budget-set-401",
                    value = """
                        { "status": 401, "error": "Unauthorized",
                          "message": "JWT token is missing or invalid", "path": "/api/expenses/budget/user/1" }
                        """
                ))
        )
    })
    @PostMapping("/budget/user/{userId}")
    public ResponseEntity<?> setBudget(
            @Parameter(description = "ID of the user setting the budget.", required = true, example = "1")
            @PathVariable Long userId,
            @org.springframework.web.bind.annotation.RequestBody BudgetDto dto) {
        budgetService.setBudget(userId, dto);
        return ResponseEntity.ok(Collections.singletonMap("message", "Budget set successfully"));
    }

    @Operation(
        summary = "Delete budget by ID",
        description = """
            Deletes a single budget limit by its own database ID.

            **Ownership check:** the budget's owning user must match the authenticated caller.
            Returns 404 if the budget does not exist, and 403 if the caller does not own it.
            """
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Budget deleted"),
        @ApiResponse(responseCode = "403", description = "Budget belongs to a different user"),
        @ApiResponse(responseCode = "404", description = "No budget found with that ID")
    })
    @DeleteMapping("/budget/{budgetId}")
    public ResponseEntity<?> deleteBudgetById(
            @Parameter(description = "Database ID of the budget to delete.", required = true, example = "3")
            @PathVariable Long budgetId) {
        budgetService.deleteBudgetById(budgetId);
        return ResponseEntity.ok(Collections.singletonMap("message", "Budget limit deleted successfully"));
    }

    @Operation(
        summary = "Delete budget by user and category",
        description = "Deletes budget limit for category scoped to specific user."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200",
            description = "Budget deleted (or silently no-op if no matching budget existed)"),
        @ApiResponse(responseCode = "400", description = "No user found with the given userId")
    })
    @DeleteMapping("/budget/user/{userId}/category/{categoryId}")
    public ResponseEntity<?> deleteBudgetByCategory(
            @Parameter(description = "ID of the user who owns the budget.", required = true, example = "1")
            @PathVariable Long userId,
            @Parameter(description = "ID of category whose budget limit should be removed.",
                    required = true, example = "3")
            @PathVariable Long categoryId) {
        budgetService.deleteBudgetByCategory(userId, categoryId);
        return ResponseEntity.ok(Collections.singletonMap("message", "Budget limit deleted successfully"));
    }

    @Operation(
        summary = "Get budget status",
        description = "Returns budget utilisation for every category with custom period calculations."
    )
    @GetMapping("/budget/status/user/{userId}")
    public ResponseEntity<List<BudgetStatusDto>> getBudgetStatus(
            @Parameter(description = "ID of the user whose budget status to retrieve.", required = true, example = "1")
            @PathVariable Long userId) {
        return ResponseEntity.ok(budgetService.getBudgetStatus(userId));
    }

    // ═════════════════════════════════════════════════════════════════════
    //  RECURRING EXPENSES
    // ═════════════════════════════════════════════════════════════════════

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
    @RequestBody(required = true, content = @Content(
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
    @PostMapping("/recurring/user/{userId}")
    public ResponseEntity<?> addRecurring(
            @Parameter(description = "ID of user registering recurring expense.",
                    required = true, example = "1")
            @PathVariable Long userId,
            @org.springframework.web.bind.annotation.RequestBody ExpenseDto dto) {
        recurringExpenseService.createRecurringExpense(userId, dto);
        return ResponseEntity.ok(Collections.singletonMap("message", "Recurring Expense Setup Successfully"));
    }

    @Operation(
        summary = "Get subscriptions",
        description = """
            Returns all active recurring expense subscriptions for the specified user.
            """
    )
    @GetMapping("/recurring/user/{userId}")
    public ResponseEntity<List<Map<String, Object>>> getUserSubscriptions(
            @Parameter(description = "ID of the user whose subscriptions to retrieve.", required = true, example = "1")
            @PathVariable Long userId) {
        return ResponseEntity.ok(recurringExpenseService.getUserSubscriptions(userId));
    }

    @Operation(
        summary = "Update subscription",
        description = """
            Partially updates a recurring expense subscription.
            """
    )
    @PutMapping({"/recurring/{recId}", "/recurring/{recId}/user/{userId}"})
    public ResponseEntity<?> updateSubscription(
            @Parameter(description = "ID of recurring expense subscription to update.",
                    required = true, example = "3")
            @PathVariable Long recId,
            @PathVariable(value = "userId", required = false) Long userId,
            @org.springframework.web.bind.annotation.RequestBody Map<String, Object> updates) {
        recurringExpenseService.updateSubscription(recId, updates);
        return ResponseEntity.ok(Collections.singletonMap("message", "Subscription updated successfully"));
    }

    @Operation(
        summary = "Cancel subscription",
        description = """
            Permanently cancels (deletes) a recurring expense subscription.
            """
    )
    @DeleteMapping({"/recurring/{recId}", "/recurring/{recId}/user/{userId}"})
    public ResponseEntity<?> deleteSubscription(
            @Parameter(description = "ID of recurring expense subscription to cancel.",
                    required = true, example = "3")
            @PathVariable Long recId,
            @PathVariable(value = "userId", required = false) Long userId) {
        recurringExpenseService.deleteSubscription(recId);
        return ResponseEntity.ok(Collections.singletonMap("message", "Subscription cancelled successfully"));
    }

    private ExpenseDto mapToDto(Expense expense) {
        return new ExpenseDto(
                expense.getId(), expense.getAmount(), expense.getDescription(),
                expense.getExpenseDate(),
                expense.getCategory() != null ? expense.getCategory().getId()   : null,
                expense.getCategory() != null ? expense.getCategory().getName() : "Uncategorized",
                expense.isRecurring()
        );
    }


    // ═════════════════════════════════════════════════════════════════════
    //  EXPORT & IMPORT (CSV, JSON, PDF, EXCEL)
    // ═════════════════════════════════════════════════════════════════════

    @Operation(summary = "Export expenses to CSV")
    @GetMapping("/user/{userId}/export/csv")
    public ResponseEntity<byte[]> exportCsv(@PathVariable Long userId) {
        userSecurity.validateUserAccess(userId);
        log.info("Exporting expenses to CSV for userId={}", userId);
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        byte[] bytes = exportService.exportExpensesToCsv(user);
        log.info("Expenses CSV export generated for userId={}, byteCount={}", userId, bytes != null ? bytes.length : 0);
        return ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"expenses.csv\"")
                // FIXED: specify charset=UTF-8 so non-ASCII characters in descriptions (currency
                // symbols, accented names, emoji) are not corrupted. Without charset, text/csv
                // defaults to ISO-8859-1 per RFC 4180.
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .contentLength(bytes != null ? bytes.length : 0)
                .body(bytes);
    }

    @Operation(summary = "Export expenses to JSON")
    @GetMapping("/user/{userId}/export/json")
    public ResponseEntity<byte[]> exportJson(@PathVariable Long userId) {
        userSecurity.validateUserAccess(userId);
        log.info("Exporting expenses to JSON for userId={}", userId);
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        byte[] bytes = exportService.exportExpensesToJson(user);
        log.info("Expenses JSON export generated for userId={}, byteCount={}",
                userId, bytes != null ? bytes.length : 0);
        return ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"expenses.json\"")
                .contentType(MediaType.APPLICATION_JSON)
                .contentLength(bytes != null ? bytes.length : 0)
                .body(bytes);
    }

    @Operation(summary = "Export expenses to PDF report")
    @GetMapping("/user/{userId}/export/pdf")
    public ResponseEntity<byte[]> exportPdf(
            @PathVariable Long userId,
            @RequestParam(value = "currency", required = false) String currencyParam,
            @RequestHeader(value = "X-Currency", required = false) String currencyHeader) {
        userSecurity.validateUserAccess(userId);
        log.info("Exporting expenses to PDF for userId={}, currencyParam={}, currencyHeader={}",
                userId, currencyParam, currencyHeader);
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        String preferredCurrency = (currencyParam != null && !currencyParam.isBlank()) ? currencyParam : currencyHeader;
        byte[] bytes = exportService.exportExpensesToPdf(user, preferredCurrency);
        log.info("Expenses PDF export generated for userId={}, byteCount={}", userId, bytes != null ? bytes.length : 0);
        return ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"expenses.pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .contentLength(bytes != null ? bytes.length : 0)
                .body(bytes);
    }

    @Operation(summary = "Export expenses to Excel workbook (.xlsx)")
    @GetMapping({"/user/{userId}/export/excel", "/user/{userId}/export/xlsx"})
    public ResponseEntity<byte[]> exportExcel(
            @PathVariable Long userId,
            @RequestParam(value = "currency", required = false) String currencyParam,
            @RequestHeader(value = "X-Currency", required = false) String currencyHeader) {
        userSecurity.validateUserAccess(userId);
        log.info("Exporting expenses to Excel for userId={}, currencyParam={}, currencyHeader={}",
                userId, currencyParam, currencyHeader);
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        String preferredCurrency = (currencyParam != null && !currencyParam.isBlank()) ? currencyParam : currencyHeader;
        byte[] bytes = exportService.exportExpensesToExcel(user, preferredCurrency);
        log.info("Expenses Excel export generated for userId={}, byteCount={}",
                userId, bytes != null ? bytes.length : 0);
        return ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"expenses.xlsx\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .contentLength(bytes != null ? bytes.length : 0)
                .body(bytes);
    }

    @Operation(
        summary = "Import expenses from CSV file",
        description = """
            Columns are matched by header name, not fixed position — so this accepts any
            reasonable column order/subset, not just this app's own export format. Required
            headers (case-insensitive): Date, Category, Amount. Description is optional.

            Each row is parsed independently: a problem in one row (bad date, non-numeric
            amount, etc.) is recorded and skipped rather than aborting the entire import.
            The response reports how many rows imported successfully and lists any that
            didn't, with a reason, so a partially-malformed file still gets you most of the
            way there instead of an all-or-nothing failure.
            """
    )
    @PostMapping(value = "/user/{userId}/import/csv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> importCsv(
            @PathVariable Long userId,
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        userSecurity.validateUserAccess(userId);
        log.info("Importing expenses from CSV for userId={}, filename={}, size={}",
                userId, file.getOriginalFilename(), file.getSize());
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Map<String, Object> result = importService.importExpensesFromCsv(file, user);
        log.info("CSV expense import completed for userId={}", userId);
        return ResponseEntity.ok(result);
    }

    @Operation(summary = "Import expenses from JSON file")
    @PostMapping(value = "/user/{userId}/import/json", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> importJson(
            @PathVariable Long userId,
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        userSecurity.validateUserAccess(userId);
        log.info("Importing expenses from JSON for userId={}, filename={}, size={}",
                userId, file.getOriginalFilename(), file.getSize());
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Map<String, Object> result = importService.importExpensesFromJson(file, user);
        log.info("JSON expense import completed for userId={}", userId);
        return ResponseEntity.ok(result);
    }

    /**
     * Imports expenses from an uploaded Microsoft Excel (.xlsx / .xls) workbook for the given user.
     *
     * @param userId target user ID
     * @param file uploaded Excel spreadsheet
     * @return summary map containing imported count, failed row count, and per-row error messages
     */
    @Operation(summary = "Import expenses from Excel file (.xlsx / .xls)",
            description = "Uploads a Microsoft Excel workbook containing expense entries. "
                    + "Supports dynamic header detection and per-row error tracking.")
    @PostMapping(value = {"/user/{userId}/import/excel", "/user/{userId}/import/xlsx"},
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> importExcel(
            @PathVariable Long userId,
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        userSecurity.validateUserAccess(userId);
        log.info("Importing expenses from Excel for userId={}, filename={}, size={}",
                userId, file.getOriginalFilename(), file.getSize());
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Map<String, Object> result = importService.importExpensesFromExcel(file, user);
        log.info("Excel expense import completed for userId={}", userId);
        return ResponseEntity.ok(result);
    }

    /**
     * Reconciles an uploaded bank statement (.csv, .xlsx, .xls) against existing user records.
     * Auto-detects and adds unrecorded debits and credits missed by SMS alerts.
     */
    @Operation(summary = "Reconcile bank statement (.csv, .xlsx, .xls)",
            description = "Parses bank statements across major banks, matches existing entries, "
                    + "and automatically captures 100% of missed debits and credits.")
    @PostMapping(value = "/user/{userId}/import/statement",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> reconcileBankStatement(
            @PathVariable Long userId,
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        userSecurity.validateUserAccess(userId);
        log.info("Reconciling bank statement for userId={}, filename={}, size={}",
                userId, file.getOriginalFilename(), file.getSize());
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Map<String, Object> result = importService.reconcileBankStatement(file, user);
        log.info("Bank statement reconciliation completed for userId={}: {}", userId, result.get("message"));
        return ResponseEntity.ok(result);
    }

}
