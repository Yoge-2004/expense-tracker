package com.example.expensetracker.controller;

import com.example.expensetracker.dto.*;
import com.example.expensetracker.mapper.ExpenseMapper;
import com.example.expensetracker.model.*;
import com.example.expensetracker.repository.*;
import com.example.expensetracker.service.ExpenseService;
import com.example.expensetracker.service.ExportService;
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
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

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
@SecurityRequirement(name = "BearerAuth")
@RestController
@RequestMapping("/api/expenses")
public class ExpenseController {

    private final ExpenseService expenseService;
    private final UserService userService;
    private final CategoryRepository categoryRepository;
    private final BudgetRepository budgetRepository;
    private final RecurringExpenseRepository recurringRepository;
    private final ExpenseRepository expenseRepository;
    private final ExportService exportService;
    private final ImportService importService;

    public ExpenseController(ExpenseService expenseService, UserService userService,
                             CategoryRepository categoryRepository,
                             BudgetRepository budgetRepository,
                             RecurringExpenseRepository recurringRepository,
                             ExpenseRepository expenseRepository,
                             ExportService exportService,
                             ImportService importService) {
        this.expenseService = expenseService;
        this.userService = userService;
        this.categoryRepository = categoryRepository;
        this.budgetRepository = budgetRepository;
        this.recurringRepository = recurringRepository;
        this.expenseRepository = expenseRepository;
        this.exportService = exportService;
        this.importService = importService;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  EXPENSE CRUD
    // ═══════════════════════════════════════════════════════════════════════

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
            value = "{ \"amount\": 199.99, \"description\": \"Lunch at Saravana Bhavan\", \"expenseDate\": \"2025-06-15\", \"categoryId\": 1 }"
        )
    ))
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Expense saved — returns the complete record with generated ID",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ExpenseDto.class),
                examples = @ExampleObject(name = "expense-create-201", summary = "Saved expense with ID and category name",
                    value = "{ \"id\": 42, \"amount\": 199.99, \"description\": \"Lunch at Saravana Bhavan\", \"expenseDate\": \"2025-06-15\", \"categoryId\": 1, \"categoryName\": \"Food\" }"
                ))
        ),
        @ApiResponse(responseCode = "400", description = "Validation failed — amount ≤ 0, missing date, missing categoryId, or unknown category",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "expense-create-400",
                    value = "{ \"status\": 400, \"error\": \"Bad Request\", \"message\": \"amount: must be greater than 0\", \"path\": \"/api/expenses/user/1\" }"
                ))
        ),
        @ApiResponse(responseCode = "401", description = "JWT token missing or invalid",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "expense-create-401",
                    value = "{ \"status\": 401, \"error\": \"Unauthorized\", \"message\": \"JWT token is missing or invalid\", \"path\": \"/api/expenses/user/1\" }"
                ))
        )
    })
    @PostMapping("/user/{userId}")
    public ResponseEntity<ExpenseDto> createExpense(
            @Parameter(description = "ID of the authenticated user creating the expense.", required = true, example = "1")
            @PathVariable Long userId,
            @Valid @org.springframework.web.bind.annotation.RequestBody ExpenseRequest request) {
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Expense expense = new Expense();
        expense.setAmount(request.getAmount());
        expense.setDescription(request.getDescription());
        expense.setExpenseDate(request.getExpenseDate());
        Category category = new Category();
        category.setId(request.getCategoryId());
        expense.setCategory(category);
        Expense saved = expenseService.createExpense(expense, user);
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
                examples = @ExampleObject(name = "expense-list-200", summary = "Two expenses across different categories",
                    value = "[ { \"id\": 42, \"amount\": 199.99, \"description\": \"Lunch at Saravana Bhavan\", \"expenseDate\": \"2025-06-15\", \"categoryId\": 1, \"categoryName\": \"Food\" }, { \"id\": 43, \"amount\": 55.00, \"description\": \"Metro card recharge\", \"expenseDate\": \"2025-06-10\", \"categoryId\": 2, \"categoryName\": \"Transport\" } ]"
                ))
        ),
        @ApiResponse(responseCode = "400", description = "No user found with the given ID",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "expense-list-400",
                    value = "{ \"status\": 400, \"error\": \"Bad Request\", \"message\": \"User not found\", \"path\": \"/api/expenses/user/99\" }"
                ))
        ),
        @ApiResponse(responseCode = "401", description = "JWT token missing or invalid",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "expense-list-401",
                    value = "{ \"status\": 401, \"error\": \"Unauthorized\", \"message\": \"JWT token is missing or invalid\", \"path\": \"/api/expenses/user/1\" }"
                ))
        )
    })
    @GetMapping("/user/{userId}")
    public ResponseEntity<List<ExpenseDto>> getExpenses(
            @Parameter(description = "ID of the user whose expense records to retrieve.", required = true, example = "1")
            @PathVariable Long userId) {
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        List<ExpenseDto> expenses = expenseService.getUserExpenses(user)
                .stream().map(ExpenseMapper::toDto).collect(Collectors.toList());
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
            value = "{ \"amount\": 225.00, \"description\": \"Lunch + dessert\", \"expenseDate\": \"2025-06-15\", \"categoryId\": 1 }"
        )
    ))
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Expense updated — full updated record returned",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ExpenseDto.class),
                examples = @ExampleObject(name = "expense-update-200", summary = "Updated expense record",
                    value = "{ \"id\": 42, \"amount\": 225.00, \"description\": \"Lunch + dessert\", \"expenseDate\": \"2025-06-15\", \"categoryId\": 1, \"categoryName\": \"Food\" }"
                ))
        ),
        @ApiResponse(responseCode = "400", description = "Expense does not belong to this user",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "expense-update-400",
                    value = "{ \"status\": 400, \"error\": \"Bad Request\", \"message\": \"Expense does not belong to this user\", \"path\": \"/api/expenses/42/user/2\" }"
                ))
        ),
        @ApiResponse(responseCode = "500", description = "Expense not found (expense ID does not exist)",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "expense-update-500",
                    value = "{ \"status\": 500, \"error\": \"Internal Server Error\", \"message\": \"Unexpected error occurred\", \"path\": \"/api/expenses/999/user/1\" }"
                ))
        ),
        @ApiResponse(responseCode = "401", description = "JWT token missing or invalid",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "expense-update-401",
                    value = "{ \"status\": 401, \"error\": \"Unauthorized\", \"message\": \"JWT token is missing or invalid\", \"path\": \"/api/expenses/42/user/1\" }"
                ))
        )
    })
    @PutMapping("/{expenseId}/user/{userId}")
    public ResponseEntity<ExpenseDto> updateExpense(
            @Parameter(description = "ID of the expense record to update.", required = true, example = "42")
            @PathVariable Long expenseId,
            @Parameter(description = "ID of the user who owns the expense.", required = true, example = "1")
            @PathVariable Long userId,
            @org.springframework.web.bind.annotation.RequestBody ExpenseDto expenseDto) {
        User user = userService.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        Expense expenseUpdates = new Expense();
        expenseUpdates.setDescription(expenseDto.getDescription());
        expenseUpdates.setAmount(expenseDto.getAmount());
        expenseUpdates.setExpenseDate(expenseDto.getExpenseDate());
        if (expenseDto.getCategoryId() != null) {
            Category category = categoryRepository.findById(expenseDto.getCategoryId())
                    .orElseThrow(() -> new RuntimeException("Category not found"));
            expenseUpdates.setCategory(category);
        }
        Expense updated = expenseService.updateExpense(expenseId, expenseUpdates, user);
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
                    value = "{ \"status\": 400, \"error\": \"Bad Request\", \"message\": \"Expense does not belong to this user\", \"path\": \"/api/expenses/42/user/2\" }"
                ))
        ),
        @ApiResponse(responseCode = "401", description = "JWT token missing or invalid",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "expense-delete-401",
                    value = "{ \"status\": 401, \"error\": \"Unauthorized\", \"message\": \"JWT token is missing or invalid\", \"path\": \"/api/expenses/42/user/1\" }"
                ))
        )
    })
    @DeleteMapping("/{expenseId}/user/{userId}")
    public ResponseEntity<Void> deleteExpense(
            @Parameter(description = "ID of the user who owns the expense.", required = true, example = "1")
            @PathVariable Long userId,
            @Parameter(description = "ID of the expense record to permanently delete.", required = true, example = "42")
            @PathVariable Long expenseId) {
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        expenseService.deleteExpense(expenseId, user);
        return ResponseEntity.noContent().build();
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  BUDGET
    // ═══════════════════════════════════════════════════════════════════════

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
                    value = "{ \"status\": 401, \"error\": \"Unauthorized\", \"message\": \"JWT token is missing or invalid\", \"path\": \"/api/expenses/budget/user/1\" }"
                ))
        )
    })
    @PostMapping("/budget/user/{userId}")
    public ResponseEntity<?> setBudget(
            @Parameter(description = "ID of the user setting the budget.", required = true, example = "1")
            @PathVariable Long userId,
            @org.springframework.web.bind.annotation.RequestBody BudgetDto dto) {
        if (dto.getLimitAmount() == null || dto.getLimitAmount().compareTo(BigDecimal.ZERO) <= 0) {
            return ResponseEntity.badRequest()
                    .body(Collections.singletonMap("error", "Budget limit must be a positive number"));
        }
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Category category = categoryRepository.findById(dto.getCategoryId())
                .orElseThrow(() -> new IllegalArgumentException("Category not found"));
        Budget budget = budgetRepository.findByUserAndCategoryId(user, dto.getCategoryId())
                .orElse(new Budget());
        budget.setUser(user);
        budget.setCategory(category);
        budget.setLimitAmount(dto.getLimitAmount());
        budget.setPeriod(dto.getPeriod() != null ? dto.getPeriod() : "MONTHLY");
        budget.setStartDate(dto.getStartDate());
        budget.setEndDate(dto.getEndDate());
        budgetRepository.save(budget);
        return ResponseEntity.ok(Collections.singletonMap("message", "Budget set successfully"));
    }

    @Operation(
        summary = "Delete budget by ID",
        description = """
            Deletes a single budget limit by its own database ID.

            ⚠️ **Known authorization gap:** unlike every other mutating endpoint in
            this controller, this one does not take a `userId` and never verifies
            the budget belongs to the authenticated caller before deleting it — it
            calls `budgetRepository.deleteById(budgetId)` directly. Any
            authenticated user can delete any budget in the system if they know
            or guess its ID. Prefer `DELETE /budget/user/{userId}/category/{categoryId}`
            below, which is correctly scoped to the calling user, until this is
            fixed to verify ownership first.
            """
    )
    @ApiResponse(responseCode = "200", description = "Budget deleted (or silently no-op if the ID didn't exist — deleteById does not throw on a missing row)")
    @DeleteMapping("/budget/{budgetId}")
    public ResponseEntity<?> deleteBudgetById(
            @Parameter(description = "Database ID of the budget to delete. NOTE: not verified against any user — see the authorization gap above.", required = true, example = "3")
            @PathVariable Long budgetId) {
        budgetRepository.deleteById(budgetId);
        return ResponseEntity.ok(Collections.singletonMap("message", "Budget limit deleted successfully"));
    }

    @Operation(
        summary = "Delete budget by user and category",
        description = "Deletes the budget limit set for a specific category, scoped to a specific user — unlike deleteBudgetById above, this correctly verifies the user exists first and only ever deletes that user's own budget for the given category."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Budget deleted (or silently no-op if no matching budget existed for this user/category pair)"),
        @ApiResponse(responseCode = "400", description = "No user found with the given userId")
    })
    @DeleteMapping("/budget/user/{userId}/category/{categoryId}")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> deleteBudgetByCategory(
            @Parameter(description = "ID of the user who owns the budget.", required = true, example = "1")
            @PathVariable Long userId,
            @Parameter(description = "ID of the category whose budget limit should be removed.", required = true, example = "3")
            @PathVariable Long categoryId) {
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        budgetRepository.deleteByUserAndCategoryId(user, categoryId);
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
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        List<Budget> budgets = budgetRepository.findByUser(user);
        LocalDate now = LocalDate.now();

        List<BudgetStatusDto> statusList = budgets.stream().map(b -> {
            LocalDate start;
            LocalDate end;
            String period = b.getPeriod() != null ? b.getPeriod() : "MONTHLY";

            switch (period.toUpperCase()) {
                case "WEEKLY" -> {
                    start = now.with(java.time.DayOfWeek.MONDAY);
                    end = now.with(java.time.DayOfWeek.SUNDAY);
                }
                case "YEARLY" -> {
                    start = now.withDayOfYear(1);
                    end = now.withDayOfYear(now.lengthOfYear());
                }
                case "CUSTOM" -> {
                    start = b.getStartDate() != null ? b.getStartDate() : now.withDayOfMonth(1);
                    end = b.getEndDate() != null ? b.getEndDate() : now;
                }
                default -> { // MONTHLY
                    start = now.withDayOfMonth(1);
                    end = now.plusMonths(1).withDayOfMonth(1).minusDays(1);
                }
            }

            BigDecimal spent = expenseRepository.findByUserAndExpenseDateBetween(user, start, end)
                    .stream()
                    .filter(e -> e.getCategory() != null && e.getCategory().getId().equals(b.getCategory().getId()))
                    .map(Expense::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
            double pct = b.getLimitAmount().doubleValue() > 0
                    ? spent.doubleValue() / b.getLimitAmount().doubleValue() * 100 : 0;

            return new BudgetStatusDto(
                    b.getId(),
                    b.getCategory().getId(),
                    b.getCategory().getName(),
                    b.getLimitAmount(),
                    spent,
                    pct,
                    period,
                    start,
                    end
            );
        }).collect(Collectors.toList());
        return ResponseEntity.ok(statusList);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  RECURRING EXPENSES
    // ═══════════════════════════════════════════════════════════════════════

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
            value = "{ \"amount\": 649.00, \"description\": \"Netflix Premium\", \"expenseDate\": \"2025-06-01\", \"categoryId\": 4 }"
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
                    value = "{ \"status\": 400, \"error\": \"Bad Request\", \"message\": \"Category not found\", \"path\": \"/api/expenses/recurring/user/1\" }"
                ))
        ),
        @ApiResponse(responseCode = "401", description = "JWT token missing or invalid",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "recurring-add-401",
                    value = "{ \"status\": 401, \"error\": \"Unauthorized\", \"message\": \"JWT token is missing or invalid\", \"path\": \"/api/expenses/recurring/user/1\" }"
                ))
        )
    })
    @PostMapping("/recurring/user/{userId}")
    public ResponseEntity<?> addRecurring(
            @Parameter(description = "ID of the user registering the recurring expense.", required = true, example = "1")
            @PathVariable Long userId,
            @org.springframework.web.bind.annotation.RequestBody ExpenseDto dto) {
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Category category = categoryRepository.findById(dto.getCategoryId())
                .orElseThrow(() -> new IllegalArgumentException("Category not found"));
        RecurringExpense rec = new RecurringExpense();
        rec.setAmount(dto.getAmount());
        rec.setDescription(dto.getDescription());
        String frequency = normalizeFrequency(dto.getFrequency());
        Integer intervalDays = "CUSTOM".equals(frequency) ? dto.getIntervalDays() : null;
        if ("CUSTOM".equals(frequency) && (intervalDays == null || intervalDays < 1)) {
            throw new IllegalArgumentException("Custom frequency requires a positive interval in days");
        }
        rec.setFrequency(frequency);
        rec.setIntervalDays(intervalDays);
        rec.setNextDueDate(nextOccurrence(dto.getExpenseDate(), frequency, intervalDays));
        rec.setCategory(category);
        rec.setUser(user);
        recurringRepository.save(rec);
        Expense firstExp = new Expense();
        firstExp.setAmount(dto.getAmount());
        firstExp.setDescription(dto.getDescription());
        firstExp.setExpenseDate(dto.getExpenseDate());
        firstExp.setCategory(category);
        expenseService.createExpense(firstExp, user);
        return ResponseEntity.ok(Collections.singletonMap("message", "Recurring Expense Setup Successfully"));
    }

    @Operation(
        summary = "Get subscriptions",
        description = """
            Returns all active recurring expense subscriptions for the specified user.

            **Returned fields per subscription:**
            - `id` — the `RecurringExpense` ID used for update and cancel operations.
            - `description` — the subscription name (e.g. "Netflix Premium").
            - `amount` — the monthly charge amount.
            - `nextDueDate` — the next scheduled billing date (ISO-8601).
            - `frequency` — always `"MONTHLY"` in the current version.
            - `categoryName` — name of the linked category.

            **Cancelled subscriptions** are not returned — they are permanently deleted
            and will not appear in this list.

            **Empty list:** if the user has no active subscriptions, an empty array `[]`
            is returned.
            """
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "List of active subscriptions (empty array if none)",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                examples = @ExampleObject(name = "recurring-list-200", summary = "Two active subscriptions",
                    value = "[ { \"id\": 3, \"description\": \"Netflix Premium\", \"amount\": 649.00, \"nextDueDate\": \"2025-07-01\", \"frequency\": \"MONTHLY\", \"categoryName\": \"Entertainment\" }, { \"id\": 4, \"description\": \"Spotify\", \"amount\": 119.00, \"nextDueDate\": \"2025-07-05\", \"frequency\": \"MONTHLY\", \"categoryName\": \"Entertainment\" } ]"
                ))
        ),
        @ApiResponse(responseCode = "400", description = "No user found with the given ID",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "recurring-list-400",
                    value = "{ \"status\": 400, \"error\": \"Bad Request\", \"message\": \"User not found\", \"path\": \"/api/expenses/recurring/user/99\" }"
                ))
        ),
        @ApiResponse(responseCode = "401", description = "JWT token missing or invalid",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "recurring-list-401",
                    value = "{ \"status\": 401, \"error\": \"Unauthorized\", \"message\": \"JWT token is missing or invalid\", \"path\": \"/api/expenses/recurring/user/1\" }"
                ))
        )
    })
    @GetMapping("/recurring/user/{userId}")
    public ResponseEntity<List<Map<String, Object>>> getUserSubscriptions(
            @Parameter(description = "ID of the user whose subscriptions to retrieve.", required = true, example = "1")
            @PathVariable Long userId) {
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        List<RecurringExpense> subs = recurringRepository.findByUser(user);
        List<Map<String, Object>> response = subs.stream().map(sub -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id",          sub.getId());
            map.put("description", sub.getDescription());
            map.put("amount",      sub.getAmount());
            map.put("nextDueDate", sub.getNextDueDate());
            map.put("frequency",   sub.getFrequency());
            map.put("intervalDays", sub.getIntervalDays());
            map.put("categoryId", sub.getCategory() != null ? sub.getCategory().getId() : null);
            map.put("categoryName", sub.getCategory() != null ? sub.getCategory().getName() : "Uncategorized");
            return map;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(response);
    }

    @Operation(
        summary = "Update subscription",
        description = """
            Partially updates a recurring expense subscription.

            **Supported keys in the request body (all optional):**

            | Key           | Type   | Description                                           |
            |---------------|--------|-------------------------------------------------------|
            | `amount`      | number | New monthly charge amount (e.g. `799.00`).            |
            | `description` | string | New subscription label (e.g. `"Netflix 4K Plan"`).   |
            | `nextDueDate` | string | Reschedule the next billing date (ISO-8601 date).     |

            Only keys that are present in the request body are updated.
            Omitted keys are left unchanged. At least one key should be provided.

            **Example use cases:**
            - Upgrading a plan: update `amount` and `description`.
            - Skipping a month: update `nextDueDate` to a later date.
            """
    )
    @RequestBody(required = true, content = @Content(
        mediaType = MediaType.APPLICATION_JSON_VALUE,
        examples = @ExampleObject(
            name = "recurring-update-request", summary = "Upgrade to premium plan and reschedule",
            value = "{ \"amount\": 799.00, \"description\": \"Netflix Premium (4K)\", \"nextDueDate\": \"2025-08-01\" }"
        )
    ))
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Subscription updated successfully",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                examples = @ExampleObject(name = "recurring-update-200",
                    value = "{ \"message\": \"Subscription updated successfully\" }"
                ))
        ),
        @ApiResponse(responseCode = "400", description = "Subscription not found",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "recurring-update-400",
                    value = "{ \"status\": 400, \"error\": \"Bad Request\", \"message\": \"Subscription not found\", \"path\": \"/api/expenses/recurring/99\" }"
                ))
        ),
        @ApiResponse(responseCode = "401", description = "JWT token missing or invalid",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "recurring-update-401",
                    value = "{ \"status\": 401, \"error\": \"Unauthorized\", \"message\": \"JWT token is missing or invalid\", \"path\": \"/api/expenses/recurring/3\" }"
                ))
        )
    })
    @PutMapping("/recurring/{recId}")
    public ResponseEntity<?> updateSubscription(
            @Parameter(description = "ID of the recurring expense subscription to update.", required = true, example = "3")
            @PathVariable Long recId,
            @org.springframework.web.bind.annotation.RequestBody Map<String, Object> updates) {
        RecurringExpense rec = recurringRepository.findById(recId)
                .orElseThrow(() -> new IllegalArgumentException("Subscription not found"));
        if (updates.containsKey("amount"))      rec.setAmount(new BigDecimal(updates.get("amount").toString()));
        if (updates.containsKey("description")) rec.setDescription((String) updates.get("description"));
        if (updates.containsKey("nextDueDate")) rec.setNextDueDate(LocalDate.parse((String) updates.get("nextDueDate")));
        if (updates.containsKey("frequency")) {
            String frequency = normalizeFrequency((String) updates.get("frequency"));
            Integer intervalDays = "CUSTOM".equals(frequency)
                    ? numberValue(updates.get("intervalDays")) : null;
            if ("CUSTOM".equals(frequency) && (intervalDays == null || intervalDays < 1)) {
                throw new IllegalArgumentException("Custom frequency requires a positive interval in days");
            }
            rec.setFrequency(frequency);
            rec.setIntervalDays(intervalDays);
        } else if (updates.containsKey("intervalDays") && "CUSTOM".equals(rec.getFrequency())) {
            Integer intervalDays = numberValue(updates.get("intervalDays"));
            if (intervalDays == null || intervalDays < 1) {
                throw new IllegalArgumentException("Custom frequency requires a positive interval in days");
            }
            rec.setIntervalDays(intervalDays);
        }
        recurringRepository.save(rec);
        return ResponseEntity.ok(Collections.singletonMap("message", "Subscription updated successfully"));
    }

    @Operation(
        summary = "Cancel subscription",
        description = """
            Permanently cancels (deletes) a recurring expense subscription.

            **What is deleted:**
            The `RecurringExpense` record identified by `recId`. The subscription will
            no longer appear in `GET /api/expenses/recurring/user/{userId}`.

            **What is NOT deleted:**
            All `Expense` records that were previously created by this subscription
            (including the first-payment record created at registration) are **preserved**.
            These represent historical charges and remain visible in the expense list.

            **After cancellation:**
            The subscription cannot be re-activated. To resume the same subscription,
            create a new one via `POST /api/expenses/recurring/user/{userId}`.
            """
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Subscription cancelled — historical expenses preserved",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                examples = @ExampleObject(name = "recurring-delete-200",
                    value = "{ \"message\": \"Subscription cancelled successfully\" }"
                ))
        ),
        @ApiResponse(responseCode = "401", description = "JWT token missing or invalid",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "recurring-delete-401",
                    value = "{ \"status\": 401, \"error\": \"Unauthorized\", \"message\": \"JWT token is missing or invalid\", \"path\": \"/api/expenses/recurring/3\" }"
                ))
        )
    })
    @DeleteMapping("/recurring/{recId}")
    public ResponseEntity<?> deleteSubscription(
            @Parameter(description = "ID of the recurring expense subscription to cancel.", required = true, example = "3")
            @PathVariable Long recId) {
        recurringRepository.deleteById(recId);
        return ResponseEntity.ok(Collections.singletonMap("message", "Subscription cancelled successfully"));
    }

    private ExpenseDto mapToDto(Expense expense) {
        return new ExpenseDto(
                expense.getId(), expense.getAmount(), expense.getDescription(),
                expense.getExpenseDate(),
                expense.getCategory() != null ? expense.getCategory().getId()   : null,
                expense.getCategory() != null ? expense.getCategory().getName() : "Uncategorized"
        );
    }

    private String normalizeFrequency(String frequency) {
        String value = frequency == null || frequency.isBlank() ? "MONTHLY" : frequency.trim().toUpperCase(Locale.ROOT);
        if (!List.of("DAILY", "WEEKLY", "MONTHLY", "YEARLY", "CUSTOM").contains(value)) {
            throw new IllegalArgumentException("Frequency must be DAILY, WEEKLY, MONTHLY, YEARLY, or CUSTOM");
        }
        return value;
    }

    private Integer numberValue(Object value) {
        return value == null ? null : Integer.valueOf(value.toString());
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  EXPORT & IMPORT (CSV, JSON, PDF, EXCEL)
    // ═══════════════════════════════════════════════════════════════════════

    @Operation(summary = "Export expenses to CSV")
    @GetMapping("/user/{userId}/export/csv")
    public ResponseEntity<byte[]> exportCsv(@PathVariable Long userId) {
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        byte[] bytes = exportService.exportExpensesToCsv(user);
        return ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"expenses.csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(bytes);
    }

    @Operation(summary = "Export expenses to JSON")
    @GetMapping("/user/{userId}/export/json")
    public ResponseEntity<byte[]> exportJson(@PathVariable Long userId) {
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        byte[] bytes = exportService.exportExpensesToJson(user);
        return ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"expenses.json\"")
                .contentType(MediaType.APPLICATION_JSON)
                .body(bytes);
    }

    @Operation(summary = "Export expenses to PDF report")
    @GetMapping("/user/{userId}/export/pdf")
    public ResponseEntity<byte[]> exportPdf(@PathVariable Long userId) {
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        byte[] bytes = exportService.exportExpensesToPdf(user);
        return ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"expenses.pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(bytes);
    }

    @Operation(summary = "Export expenses to Excel workbook (.xlsx)")
    @GetMapping({"/user/{userId}/export/excel", "/user/{userId}/export/xlsx"})
    public ResponseEntity<byte[]> exportExcel(@PathVariable Long userId) {
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        byte[] bytes = exportService.exportExpensesToExcel(user);
        return ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"expenses.xlsx\"")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
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
    public ResponseEntity<?> importCsv(@PathVariable Long userId, @RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Map<String, Object> result = importService.importExpensesFromCsv(file, user);
        return ResponseEntity.ok(result);
    }

    @Operation(summary = "Import expenses from JSON file")
    @PostMapping(value = "/user/{userId}/import/json", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> importJson(@PathVariable Long userId, @RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Map<String, Object> result = importService.importExpensesFromJson(file, user);
        return ResponseEntity.ok(result);
    }

    /**
     * Imports expenses from an uploaded Microsoft Excel (.xlsx / .xls) workbook for the given user.
     *
     * @param userId target user ID
     * @param file uploaded Excel spreadsheet
     * @return summary map containing imported count, failed row count, and per-row error messages
     */
    @Operation(summary = "Import expenses from Excel file (.xlsx / .xls)", description = "Uploads a Microsoft Excel workbook containing expense entries. Supports dynamic header detection and per-row error tracking.")
    @PostMapping(value = {"/user/{userId}/import/excel", "/user/{userId}/import/xlsx"}, consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> importExcel(@PathVariable Long userId, @RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Map<String, Object> result = importService.importExpensesFromExcel(file, user);
        return ResponseEntity.ok(result);
    }

    private LocalDate nextOccurrence(LocalDate date, String frequency, Integer intervalDays) {
        return switch (frequency) {
            case "DAILY" -> date.plusDays(1);
            case "WEEKLY" -> date.plusWeeks(1);
            case "YEARLY" -> date.plusYears(1);
            case "CUSTOM" -> date.plusDays(intervalDays);
            default -> date.plusMonths(1);
        };
    }
}
