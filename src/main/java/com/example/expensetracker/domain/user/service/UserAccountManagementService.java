package com.example.expensetracker.domain.user.service;

import com.example.expensetracker.domain.user.model.User;


/**
 * Segregated service contract dedicated to account deletion and administrative elevation.
 *
 * <p>Fulfills the Interface Segregation Principle (ISP) by separating high-privilege
 * account lifecycle modifications from daily user profile and ledger interactions.</p>
 *
 * @author Yogeshwaran
 */
public interface UserAccountManagementService {

    /**
     * Deletes the user account identified by the given ID along with all associated ledger data.
     *
     * @param id primary key of the user to permanently delete
     */
    void deleteUser(Long id);

    /**
     * Ensures that the specified user holds the super admin role if their email matches bootstrap configuration.
     *
     * @param user       user entity
     * @param adminEmail configured bootstrap admin email
     * @return updated user entity
     */
    User ensureAdminRole(User user, String adminEmail);
}
