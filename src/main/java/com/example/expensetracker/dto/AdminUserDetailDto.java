package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Deep inspection record for an individual user account.
 * Accessible by administrative operators from the slide-over inspector drawer.
 *
 * @author Yogeshwaran
 */
@Schema(description = "Deep security and financial inspection record for a specific user")
public record AdminUserDetailDto(
        Long id,
        String name,
        String username,
        String email,
        String role,
        boolean enabled,
        boolean accountLocked,
        Integer failedPinAttempts,
        LocalDateTime pinLockedUntil,
        String currency,
        boolean hasSecurityPin,
        String profilePictureUrl,
        LocalDateTime createdAt,
        long expenseCount,
        BigDecimal totalExpenseSum,
        long incomeCount,
        BigDecimal totalIncomeSum,
        long deviceTokensCount
) {}
