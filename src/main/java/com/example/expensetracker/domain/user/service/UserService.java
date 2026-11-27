package com.example.expensetracker.domain.user.service;

/**
 * Service interface defining the business operations for managing user accounts.
 *
 * <p>This interface abstracts the user management layer, providing methods for
 * user registration, lookup, password reset, and account deletion. The concrete
 * implementation is provided by
 * {@link com.example.expensetracker.domain.user.service.UserServiceImpl}.</p>
 *
 * <p>Business rules enforced at this layer:</p>
 * <ul>
 *   <li>Email addresses must be unique — duplicate registrations are rejected.</li>
 *   <li>Passwords are BCrypt-encoded before storage and never stored in plain text.</li>
 *   <li>Account deletion cascades to all associated expenses and user-created categories.</li>
 * </ul>
 *
 * @author Yogeshwaran
 * @version 1.0
 * @see com.example.expensetracker.domain.user.service.UserServiceImpl
 */
@SuppressWarnings("unused")
public interface UserService
        extends UserRegistrationService, UserProfileService, UserSecurityPinService, UserAccountManagementService {
}
