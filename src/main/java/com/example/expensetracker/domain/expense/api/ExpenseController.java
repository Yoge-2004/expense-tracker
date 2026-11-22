package com.example.expensetracker.domain.expense.api;

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
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.math.BigDecimal;
import java.util.*;

import com.example.expensetracker.common.ErrorResponse;
import com.example.expensetracker.domain.expense.dto.ExpenseDto;
import com.example.expensetracker.domain.expense.dto.ExpenseRequest;
import com.example.expensetracker.domain.expense.mapper.ExpenseMapper;
import com.example.expensetracker.domain.expense.model.Category;
import com.example.expensetracker.domain.expense.model.Expense;
import com.example.expensetracker.domain.expense.model.RecurringExpense;
import com.example.expensetracker.domain.expense.service.CategoryService;
import com.example.expensetracker.domain.expense.service.ExpenseService;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.domain.user.service.UserService;
import com.example.expensetracker.infrastructure.security.UserSecurity;



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
    private final CategoryService categoryService;
    private final UserSecurity userSecurity;

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
            Category category = categoryService.getCategoryById(expenseDto.categoryId());
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
        return ResponseEntity.ok(ExpenseMapper.toDto(updated));
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



}
