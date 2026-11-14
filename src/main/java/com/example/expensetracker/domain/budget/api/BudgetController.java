package com.example.expensetracker.domain.budget.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;

import com.example.expensetracker.common.ErrorResponse;
import com.example.expensetracker.domain.budget.dto.BudgetDto;
import com.example.expensetracker.domain.budget.dto.BudgetStatusDto;
import com.example.expensetracker.domain.budget.model.Budget;
import com.example.expensetracker.domain.budget.service.BudgetService;
import com.example.expensetracker.infrastructure.security.UserSecurity;



/**
 * Controller dedicated exclusively to category budget limit management and real-time utilisation tracking.
 *
 * <p>Enforces Single Responsibility Principle (SRP) by decoupling budget operations from core expense CRUD.</p>
 *
 * @author Yogeshwaran
 */
@Tag(
    name        = "Budgets",
    description = """
        Set and monitor monthly spending caps per category.
        Query real-time utilisation (spent vs limit, percentage consumed).
        A percentage > 100 indicates over-budget spending for that category.
        All endpoints require a valid JWT Bearer token.
        """
)
@Slf4j
@RequiredArgsConstructor
@SecurityRequirement(name = "BearerAuth")
@RestController
@RequestMapping("/api/expenses/budget")
public class BudgetController {

    private final BudgetService budgetService;
    private final UserSecurity userSecurity;

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
    @PostMapping("/user/{userId}")
    public ResponseEntity<?> setBudget(
            @Parameter(description = "ID of the user setting the budget.", required = true, example = "1")
            @PathVariable Long userId,
            @org.springframework.web.bind.annotation.RequestBody BudgetDto dto) {
        userSecurity.validateUserAccess(userId);
        log.info("Setting budget for userId={}, categoryId={}: limitAmount={}, period={}",
                userId, dto.categoryId(), dto.limitAmount(), dto.period());
        if (dto.limitAmount() == null || dto.limitAmount().compareTo(BigDecimal.ZERO) <= 0) {
            log.warn("Rejected budget for userId={}: limitAmount must be greater than zero", userId);
            return ResponseEntity.badRequest()
                    .body(Collections.singletonMap("error", "Budget limit must be a positive number"));
        }
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
    @DeleteMapping("/{budgetId}")
    public ResponseEntity<?> deleteBudgetById(
            @Parameter(description = "Database ID of the budget to delete.", required = true, example = "3")
            @PathVariable Long budgetId) {
        log.info("Deleting budget by budgetId={}", budgetId);
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
    @DeleteMapping("/user/{userId}/category/{categoryId}")
    public ResponseEntity<?> deleteBudgetByCategory(
            @Parameter(description = "ID of the user who owns the budget.", required = true, example = "1")
            @PathVariable Long userId,
            @Parameter(description = "ID of category whose budget limit should be removed.",
                    required = true, example = "3")
            @PathVariable Long categoryId) {
        userSecurity.validateUserAccess(userId);
        log.info("Deleting budget for userId={}, categoryId={}", userId, categoryId);
        budgetService.deleteBudgetByCategory(userId, categoryId);
        return ResponseEntity.ok(Collections.singletonMap("message", "Budget limit deleted successfully"));
    }

    @Operation(
        summary = "Get budget status",
        description = "Returns budget utilisation for every category with custom period calculations."
    )
    @GetMapping("/status/user/{userId}")
    public ResponseEntity<List<BudgetStatusDto>> getBudgetStatus(
            @Parameter(description = "ID of the user whose budget status to retrieve.", required = true, example = "1")
            @PathVariable Long userId) {
        userSecurity.validateUserAccess(userId);
        log.debug("Calculating budget status for userId={}", userId);
        List<BudgetStatusDto> statusList = budgetService.getBudgetStatus(userId);
        return ResponseEntity.ok(statusList);
    }
}
