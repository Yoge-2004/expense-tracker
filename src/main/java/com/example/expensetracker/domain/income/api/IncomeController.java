package com.example.expensetracker.domain.income.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
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
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;

import com.example.expensetracker.domain.income.dto.CashFlowSummaryDto;
import com.example.expensetracker.domain.income.dto.IncomeDto;
import com.example.expensetracker.domain.income.dto.IncomeRequest;
import com.example.expensetracker.domain.income.service.IncomeService;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.domain.user.service.UserProfileService;
import com.example.expensetracker.domain.user.security.UserSecurity;

/**
 * REST controller exposing endpoints for managing user income streams and cash flow metrics.
 *
 * <p>Supports recording salary, dividends, freelance gigs, and other income inflows.
 * Provides monthly cash flow analytics comparing earnings to expenditures.</p>
 *
 * @author Yogeshwaran
 */
@Tag(
    name = "Income",
    description = """
        Income and earnings management for Expense Tracker.
        Enables tracking of salary, freelance work, investments, business earnings, and other income streams.
        Also calculates net cash flow and savings rate by comparing income against recorded expenses.
        All endpoints require Bearer JWT authentication.
        """
)
@Slf4j
@RequiredArgsConstructor
@SecurityRequirement(name = "BearerAuth")
@RestController
@RequestMapping("/api/incomes")
public class IncomeController {

    private final IncomeService incomeService;
    private final UserProfileService userService;
    private final com.example.expensetracker.domain.user.security.UserSecurity userSecurity;

    /**
     * Creates a new income entry for a user.
     *
     * @param userId user identifier
     * @param request income creation payload
     * @return response entity with created income and HTTP 201
     */
    @Operation(summary = "Create income record", description = "Records a new earnings or income entry for the user.")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Income recorded successfully",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = IncomeDto.class))),
        @ApiResponse(responseCode = "400", description = "Validation failed or user not found"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @PostMapping("/user/{userId}")
    public ResponseEntity<IncomeDto> createIncome(
            @Parameter(description = "ID of the authenticated user", required = true, example = "1")
            @PathVariable Long userId,
            @Valid @RequestBody IncomeRequest request) {
        userSecurity.validateUserAccess(userId);
        log.info("Received request to create income for userId={}: amount={}, source={}, date={}, recurring={}",
                userId, request.amount(), request.source(), request.incomeDate(), request.isRecurring());
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        IncomeDto created = incomeService.createIncome(request, user);
        log.info("Income successfully created with id={} for userId={}", created.id(), userId);
        return new ResponseEntity<>(created, HttpStatus.CREATED);
    }

    /**
     * Retrieves all income entries for a user.
     *
     * @param userId user identifier
     * @return list of income DTOs
     */
    @Operation(summary = "Get user incomes", description = "Retrieves all income entries for the user.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "List of incomes",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                array = @ArraySchema(schema = @Schema(implementation = IncomeDto.class)))),
        @ApiResponse(responseCode = "400", description = "User not found"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @GetMapping("/user/{userId}")
    public ResponseEntity<List<IncomeDto>> getUserIncomes(
            @Parameter(description = "ID of the authenticated user", required = true, example = "1")
            @PathVariable Long userId) {
        userSecurity.validateUserAccess(userId);
        log.debug("Fetching income list for userId={}", userId);
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        List<IncomeDto> incomes = incomeService.getUserIncomes(user);
        log.info("Fetched {} income records for userId={}", incomes.size(), userId);
        return ResponseEntity.ok(incomes);
    }

    /**
     * Updates an existing income record owned by a user.
     *
     * @param incomeId income record identifier
     * @param userId user identifier
     * @param request updated income payload
     * @return updated income DTO
     */
    @Operation(summary = "Update income", description = "Modifies an existing income record owned by the user.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Income updated successfully",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = IncomeDto.class))),
        @ApiResponse(responseCode = "400", description = "Income not found or does not belong to user"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @PutMapping("/{incomeId}/user/{userId}")
    public ResponseEntity<IncomeDto> updateIncome(
            @Parameter(description = "ID of the income record", required = true, example = "1")
            @PathVariable Long incomeId,
            @Parameter(description = "ID of the authenticated user", required = true, example = "1")
            @PathVariable Long userId,
            @Valid @RequestBody IncomeRequest request) {
        userSecurity.validateUserAccess(userId);
        log.info("Received request to update income id={} for userId={}: amount={}, source={}",
                incomeId, userId, request.amount(), request.source());
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        IncomeDto updated = incomeService.updateIncome(incomeId, request, user);
        log.info("Income id={} updated successfully for userId={}", incomeId, userId);
        return ResponseEntity.ok(updated);
    }

    /**
     * Deletes an income record owned by a user.
     *
     * @param incomeId income record identifier
     * @param userId user identifier
     * @return HTTP 204 No Content
     */
    @Operation(summary = "Delete income", description = "Permanently deletes an income record owned by the user.")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Income deleted successfully"),
        @ApiResponse(responseCode = "400", description = "Income not found or does not belong to user"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @DeleteMapping("/{incomeId}/user/{userId}")
    public ResponseEntity<Void> deleteIncome(
            @Parameter(description = "ID of the income record", required = true, example = "1")
            @PathVariable Long incomeId,
            @Parameter(description = "ID of the authenticated user", required = true, example = "1")
            @PathVariable Long userId) {
        userSecurity.validateUserAccess(userId);
        log.info("Received request to delete income id={} for userId={}", incomeId, userId);
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        incomeService.deleteIncome(incomeId, user);
        log.info("Income id={} deleted successfully for userId={}", incomeId, userId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Retrieves the monthly cash flow summary for a user.
     *
     * @param userId user identifier
     * @param year calendar year (optional)
     * @param month calendar month (optional)
     * @return cash flow summary metrics
     */
    @Operation(summary = "Get monthly cash flow summary",
        description = "Computes total income, total expenses, net savings, and savings rate for a given month.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Cash flow summary",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = CashFlowSummaryDto.class))),
        @ApiResponse(responseCode = "400", description = "User not found"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @GetMapping("/summary/user/{userId}")
    public ResponseEntity<CashFlowSummaryDto> getCashFlowSummary(
            @Parameter(description = "ID of the authenticated user", required = true, example = "1")
            @PathVariable Long userId,
            @Parameter(description = "Year (defaults to current year)", example = "2026")
            @RequestParam(required = false) Integer year,
            @Parameter(description = "Month (1-12, defaults to current month)", example = "8")
            @RequestParam(required = false) Integer month) {
        userSecurity.validateUserAccess(userId);
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        LocalDate now = LocalDate.now();
        int targetYear = (year != null) ? year : now.getYear();
        int targetMonth = (month != null) ? month : now.getMonthValue();

        log.info("Generating cash flow summary for userId={}, period={}-{}",
                userId, targetYear, String.format("%02d", targetMonth));
        CashFlowSummaryDto summary = incomeService.getCashFlowSummary(user, targetYear, targetMonth);
        log.info("Cash flow summary generated for userId={}: totalIncome={}, totalExpense={}, "
                + "netSavings={}, savingsRate={}%",
               
                userId, summary.totalIncome(), summary.totalExpense(), summary.netSavings(), summary.savingsRate());
        return ResponseEntity.ok(summary);
    }
}
