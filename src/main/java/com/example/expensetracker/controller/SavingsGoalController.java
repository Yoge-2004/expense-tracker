package com.example.expensetracker.controller;

import com.example.expensetracker.dto.SavingsDepositRequest;
import com.example.expensetracker.dto.SavingsGoalDto;
import com.example.expensetracker.dto.SavingsGoalRequest;
import com.example.expensetracker.model.User;
import com.example.expensetracker.service.SavingsGoalService;
import com.example.expensetracker.service.UserService;
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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST controller exposing endpoints for managing savings goals, milestone targets, and deposit contributions.
 *
 * <p>Enables users to establish financial objectives, make progress contributions, and track progress
 * percentage towards achievement.</p>
 *
 * @author Yogeshwaran
 */
@Tag(
    name = "Savings",
    description = """
        Savings Goals and Milestones management for Expense Tracker.
        Allows users to set financial targets (e.g. Emergency Fund, Travel, Gadgets),
        record deposits towards them, track percentage progress, and manage target completion.
        All endpoints require Bearer JWT authentication.
        """
)
@SecurityRequirement(name = "BearerAuth")
@RestController
@RequestMapping("/api/savings/goals")
public class SavingsGoalController {

    private static final Logger log = LoggerFactory.getLogger(SavingsGoalController.class);

    private final SavingsGoalService savingsGoalService;
    private final UserService userService;
    private final com.example.expensetracker.security.UserSecurity userSecurity;

    /**
     * Constructs {@link SavingsGoalController} with required services.
     *
     * @param savingsGoalService the savings goal service
     * @param userService the user service
     * @param userSecurity the user security component
     */
    public SavingsGoalController(SavingsGoalService savingsGoalService, UserService userService,
                                 com.example.expensetracker.security.UserSecurity userSecurity) {
        this.savingsGoalService = savingsGoalService;
        this.userService = userService;
        this.userSecurity = userSecurity;
    }

    /**
     * Creates a new savings goal for the user.
     *
     * @param userId user identifier
     * @param request savings goal creation payload
     * @return response entity with created savings goal and HTTP 201
     */
    @Operation(summary = "Create savings goal", description = "Creates a new savings goal for the user.")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Savings goal created successfully",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = SavingsGoalDto.class))),
        @ApiResponse(responseCode = "400", description = "Validation failed or user not found"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @PostMapping("/user/{userId}")
    public ResponseEntity<SavingsGoalDto> createGoal(
            @Parameter(description = "ID of the authenticated user", required = true, example = "1")
            @PathVariable Long userId,
            @Valid @RequestBody SavingsGoalRequest request) {
        userSecurity.validateUserAccess(userId);
        log.info("Received request to create savings goal for userId={}: name={}, targetAmount={}, targetDate={}",
                userId, request.getName(), request.getTargetAmount(), request.getTargetDate());
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        SavingsGoalDto created = savingsGoalService.createGoal(request, user);
        log.info("Savings goal created with id={} for userId={}", created.getId(), userId);
        return new ResponseEntity<>(created, HttpStatus.CREATED);
    }

    /**
     * Retrieves all savings goals configured by the user.
     *
     * @param userId user identifier
     * @return list of savings goals
     */
    @Operation(summary = "Get user savings goals", description = "Retrieves all savings goals for the user.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "List of savings goals",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, array = @ArraySchema(schema = @Schema(implementation = SavingsGoalDto.class)))),
        @ApiResponse(responseCode = "400", description = "User not found"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @GetMapping("/user/{userId}")
    public ResponseEntity<List<SavingsGoalDto>> getUserGoals(
            @Parameter(description = "ID of the authenticated user", required = true, example = "1")
            @PathVariable Long userId) {
        userSecurity.validateUserAccess(userId);
        log.debug("Fetching savings goals for userId={}", userId);
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        List<SavingsGoalDto> goals = savingsGoalService.getUserGoals(user);
        log.info("Retrieved {} savings goals for userId={}", goals.size(), userId);
        return ResponseEntity.ok(goals);
    }

    /**
     * Updates an existing savings goal.
     *
     * @param goalId goal identifier
     * @param userId user identifier
     * @param request updated savings goal payload
     * @return updated savings goal DTO
     */
    @Operation(summary = "Update savings goal", description = "Updates details of a savings goal.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Savings goal updated successfully",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = SavingsGoalDto.class))),
        @ApiResponse(responseCode = "400", description = "Goal not found or does not belong to user"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @PutMapping("/{goalId}/user/{userId}")
    public ResponseEntity<SavingsGoalDto> updateGoal(
            @Parameter(description = "ID of the savings goal", required = true, example = "1")
            @PathVariable Long goalId,
            @Parameter(description = "ID of the authenticated user", required = true, example = "1")
            @PathVariable Long userId,
            @Valid @RequestBody SavingsGoalRequest request) {
        userSecurity.validateUserAccess(userId);
        log.info("Received request to update savings goal id={} for userId={}: name={}, targetAmount={}",
                goalId, userId, request.getName(), request.getTargetAmount());
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        SavingsGoalDto updated = savingsGoalService.updateGoal(goalId, request, user);
        log.info("Savings goal id={} updated successfully for userId={}", goalId, userId);
        return ResponseEntity.ok(updated);
    }

    /**
     * Records a deposit contribution towards a savings goal.
     *
     * @param goalId goal identifier
     * @param userId user identifier
     * @param request deposit amount payload
     * @return updated savings goal with updated balance and progress percentage
     */
    @Operation(summary = "Deposit to savings goal", description = "Adds a contribution towards the savings goal. Automatically sets status to COMPLETED if target reached.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Deposit recorded successfully",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = SavingsGoalDto.class))),
        @ApiResponse(responseCode = "400", description = "Goal not found, deposit non-positive, or does not belong to user"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @PostMapping("/{goalId}/deposit/user/{userId}")
    public ResponseEntity<SavingsGoalDto> depositToGoal(
            @Parameter(description = "ID of the savings goal", required = true, example = "1")
            @PathVariable Long goalId,
            @Parameter(description = "ID of the authenticated user", required = true, example = "1")
            @PathVariable Long userId,
            @Valid @RequestBody SavingsDepositRequest request) {
        userSecurity.validateUserAccess(userId);
        log.info("Received deposit contribution to savings goal id={} for userId={}: depositAmount={}",
                goalId, userId, request.getAmount());
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        SavingsGoalDto updated = savingsGoalService.depositToGoal(goalId, request.getAmount(), user);
        log.info("Deposit applied to savings goal id={} for userId={}, newSavedAmount={}, status={}",
                goalId, userId, updated.getCurrentAmount(), updated.getStatus());
        return ResponseEntity.ok(updated);
    }

    /**
     * Permanently deletes a savings goal.
     *
     * @param goalId goal identifier
     * @param userId user identifier
     * @return HTTP 204 No Content
     */
    @Operation(summary = "Delete savings goal", description = "Permanently removes a savings goal.")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Savings goal deleted successfully"),
        @ApiResponse(responseCode = "400", description = "Goal not found or does not belong to user"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @DeleteMapping("/{goalId}/user/{userId}")
    public ResponseEntity<Void> deleteGoal(
            @Parameter(description = "ID of the savings goal", required = true, example = "1")
            @PathVariable Long goalId,
            @Parameter(description = "ID of the authenticated user", required = true, example = "1")
            @PathVariable Long userId) {
        userSecurity.validateUserAccess(userId);
        log.info("Received request to delete savings goal id={} for userId={}", goalId, userId);
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        savingsGoalService.deleteGoal(goalId, user);
        log.info("Savings goal id={} deleted successfully for userId={}", goalId, userId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Retrieves all recurring savings goals (chits, recurring deposits, SIPs) configured by the user.
     *
     * @param userId user identifier
     * @return list of recurring savings goals
     */
    @Operation(summary = "Get recurring savings goals", description = "Retrieves all recurring savings goals and chits for the user.")
    @GetMapping("/recurring/user/{userId}")
    public ResponseEntity<List<SavingsGoalDto>> getRecurringGoals(
            @Parameter(description = "ID of the authenticated user", required = true, example = "1")
            @PathVariable Long userId) {
        userSecurity.validateUserAccess(userId);
        log.debug("Fetching recurring savings goals for userId={}", userId);
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        List<SavingsGoalDto> goals = savingsGoalService.getRecurringGoals(user);
        log.info("Retrieved {} recurring savings goals for userId={}", goals.size(), userId);
        return ResponseEntity.ok(goals);
    }
}
