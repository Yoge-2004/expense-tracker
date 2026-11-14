package com.example.expensetracker.domain.user.service;

/**
 * Segregated service contract dedicated to managing and verifying the 6-digit Security PIN.
 *
 * <p>Fulfills the Interface Segregation Principle (ISP) by separating high-security
 * step-up PIN credential handling from general profile operations.</p>
 *
 * @author Yogeshwaran
 */
public interface UserSecurityPinService {

    /**
     * Sets or updates the 6-digit Security PIN for an account.
     *
     * @param userId user identifier
     * @param newPin 6-digit numeric PIN string
     */
    void updateSecurityPin(Long userId, String newPin);

    /**
     * Verifies the provided 6-digit PIN against the user's stored hash.
     * Enforces temporary lockout upon consecutive failed attempts.
     *
     * @param userId user identifier
     * @param pin    6-digit numeric PIN string
     * @return true if valid, false otherwise
     */
    boolean verifySecurityPin(Long userId, String pin);
}
