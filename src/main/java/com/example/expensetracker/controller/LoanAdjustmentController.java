package com.example.expensetracker.controller;

import com.example.expensetracker.dto.LoanAdjustmentDto;
import com.example.expensetracker.dto.LoanAdjustmentRequest;
import com.example.expensetracker.dto.LoanMetricsDto;
import com.example.expensetracker.security.UserSecurity;
import com.example.expensetracker.service.LoanAdjustmentService;
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

import java.util.List;

/**
 * REST controller for managing peer loans, friend adjustments, and debt positions.
 *
 * @author Yogeshwaran
 */
@Tag(
    name = "Loans & Adjustments",
    description = """
        Peer loans, borrowings, and casual friend adjustment management.
        Allows users to track money lent to friends (receivables / IOUs) vs money borrowed
        from friends/lenders (payables), calculate separate net positions, and manage 1-click settlements.
        All endpoints require Bearer JWT authentication and validate user ownership.
        """
)
@Slf4j
@RequiredArgsConstructor
@SecurityRequirement(name = "BearerAuth")
@RestController
@RequestMapping("/api/loans")
public class LoanAdjustmentController {

    private final LoanAdjustmentService loanAdjustmentService;
    private final UserSecurity userSecurity;

    @Operation(summary = "Get all loans and friend adjustments for a user")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "List of loan adjustments retrieved successfully",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                array = @ArraySchema(schema = @Schema(implementation = LoanAdjustmentDto.class)))),
        @ApiResponse(responseCode = "403", description = "Access denied")
    })
    @GetMapping("/user/{userId}")
    public ResponseEntity<List<LoanAdjustmentDto>> getLoansForUser(
            @Parameter(description = "ID of user", required = true) @PathVariable Long userId) {
        userSecurity.validateUserAccess(userId);
        List<LoanAdjustmentDto> list = loanAdjustmentService.getLoansForUser(userId);
        return ResponseEntity.ok(list);
    }

    @Operation(summary = "Get dedicated loan and adjustment metrics for a user")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Loan metrics retrieved successfully",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = LoanMetricsDto.class))),
        @ApiResponse(responseCode = "403", description = "Access denied")
    })
    @GetMapping("/metrics/user/{userId}")
    public ResponseEntity<LoanMetricsDto> getLoanMetrics(
            @Parameter(description = "ID of user", required = true) @PathVariable Long userId) {
        userSecurity.validateUserAccess(userId);
        LoanMetricsDto metrics = loanAdjustmentService.getLoanMetrics(userId);
        return ResponseEntity.ok(metrics);
    }

    @Operation(summary = "Get a single loan adjustment by ID")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Loan adjustment retrieved",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = LoanAdjustmentDto.class))),
        @ApiResponse(responseCode = "403", description = "Access denied"),
        @ApiResponse(responseCode = "404", description = "Loan adjustment not found")
    })
    @GetMapping("/{id}/user/{userId}")
    public ResponseEntity<LoanAdjustmentDto> getLoanById(
            @Parameter(description = "Loan adjustment ID", required = true) @PathVariable Long id,
            @Parameter(description = "ID of user", required = true) @PathVariable Long userId) {
        userSecurity.validateUserAccess(userId);
        LoanAdjustmentDto dto = loanAdjustmentService.getLoanById(id, userId);
        return ResponseEntity.ok(dto);
    }

    @Operation(summary = "Create a new peer loan or friend adjustment")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Loan adjustment created successfully",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = LoanAdjustmentDto.class))),
        @ApiResponse(responseCode = "400", description = "Validation failed"),
        @ApiResponse(responseCode = "403", description = "Access denied")
    })
    @PostMapping("/user/{userId}")
    public ResponseEntity<LoanAdjustmentDto> createLoan(
            @Parameter(description = "ID of user", required = true) @PathVariable Long userId,
            @Valid @RequestBody LoanAdjustmentRequest request) {
        userSecurity.validateUserAccess(userId);
        LoanAdjustmentDto created = loanAdjustmentService.createLoan(request, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @Operation(summary = "Update an existing peer loan or friend adjustment")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Loan adjustment updated successfully",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = LoanAdjustmentDto.class))),
        @ApiResponse(responseCode = "400", description = "Validation failed"),
        @ApiResponse(responseCode = "403", description = "Access denied"),
        @ApiResponse(responseCode = "404", description = "Loan adjustment not found")
    })
    @PutMapping("/{id}/user/{userId}")
    public ResponseEntity<LoanAdjustmentDto> updateLoan(
            @Parameter(description = "Loan adjustment ID", required = true) @PathVariable Long id,
            @Parameter(description = "ID of user", required = true) @PathVariable Long userId,
            @Valid @RequestBody LoanAdjustmentRequest request) {
        userSecurity.validateUserAccess(userId);
        LoanAdjustmentDto updated = loanAdjustmentService.updateLoan(id, request, userId);
        return ResponseEntity.ok(updated);
    }

    @Operation(summary = "Toggle settlement status of a loan or friend adjustment")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Settlement status toggled",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = LoanAdjustmentDto.class))),
        @ApiResponse(responseCode = "403", description = "Access denied"),
        @ApiResponse(responseCode = "404", description = "Loan adjustment not found")
    })
    @PutMapping("/{id}/settle/user/{userId}")
    public ResponseEntity<LoanAdjustmentDto> toggleSettleLoan(
            @Parameter(description = "Loan adjustment ID", required = true) @PathVariable Long id,
            @Parameter(description = "ID of user", required = true) @PathVariable Long userId) {
        userSecurity.validateUserAccess(userId);
        LoanAdjustmentDto toggled = loanAdjustmentService.toggleSettleLoan(id, userId);
        return ResponseEntity.ok(toggled);
    }

    @Operation(summary = "Delete a loan adjustment record")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Loan adjustment deleted successfully"),
        @ApiResponse(responseCode = "403", description = "Access denied"),
        @ApiResponse(responseCode = "404", description = "Loan adjustment not found")
    })
    @DeleteMapping("/{id}/user/{userId}")
    public ResponseEntity<Void> deleteLoan(
            @Parameter(description = "Loan adjustment ID", required = true) @PathVariable Long id,
            @Parameter(description = "ID of user", required = true) @PathVariable Long userId) {
        userSecurity.validateUserAccess(userId);
        loanAdjustmentService.deleteLoan(id, userId);
        return ResponseEntity.noContent().build();
    }
}
