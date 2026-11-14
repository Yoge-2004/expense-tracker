package com.example.expensetracker.domain.user.service;

import com.example.expensetracker.domain.user.model.User;


/**
 * Service dedicated to executing cascading deletions across all user-owned domain records.
 *
 * <p>Fulfills the Single Responsibility Principle (SRP) and Open/Closed Principle (OCP)
 * by isolating schema-wide cascading cleanup logic away from core user account operations.</p>
 *
 * @author Yogeshwaran
 */
public interface UserCascadeDeletionService {

    /**
     * Cascades deletion across all ledger, preference, authentication, and notification child records
     * owned by the specified user.
     *
     * @param userId primary key of the user being deleted
     * @param user   user entity
     */
    void cascadeDeleteUserData(Long userId, User user);
}
