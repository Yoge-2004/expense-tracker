package com.example.expensetracker.domain.user.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Optional;

import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.domain.user.repository.UserRepository;

/**
 * Composite facade implementing {@link UserService} by delegating to the focused
 * segregated services ({@link UserRegistrationService}, {@link UserProfileService},
 * {@link UserSecurityPinService}, and {@link UserAccountManagementService}).
 *
 * <p>New code should depend directly on the narrow role-specific interfaces rather than
 * this composite facade.</p>
 */
@Service
@Transactional(readOnly = true)
public class UserServiceImpl implements UserService {

    private final UserRegistrationService registrationService;
    private final UserProfileService profileService;
    private final UserSecurityPinService securityPinService;
    private final UserAccountManagementService accountManagementService;

    /**
     * Constructs the facade wired to the four focused user service implementations.
     *
     * @param registrationService      registration and uniqueness validation service
     * @param profileService           profile lookup, mutation, and username suggestion service
     * @param securityPinService       security PIN lifecycle and lockout service
     * @param accountManagementService account deletion and admin bootstrap service
     */
    @Autowired
    public UserServiceImpl(
            UserRegistrationService registrationService,
            UserProfileService profileService,
            UserSecurityPinService securityPinService,
            UserAccountManagementService accountManagementService) {
        this.registrationService = registrationService;
        this.profileService = profileService;
        this.securityPinService = securityPinService;
        this.accountManagementService = accountManagementService;
    }

    /**
     * Backward-compatible constructor for unit tests instantiating the facade directly.
     *
     * @param userRepository             user persistence repository
     * @param passwordEncoder            password and PIN encoder
     * @param userCascadeDeletionService cascade cleanup helper for account deletion
     */
    public UserServiceImpl(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            UserCascadeDeletionService userCascadeDeletionService) {
        this(
                new UserRegistrationServiceImpl(userRepository, passwordEncoder),
                new UserProfileServiceImpl(userRepository),
                new UserSecurityPinServiceImpl(userRepository, passwordEncoder),
                new UserAccountManagementServiceImpl(userRepository, userCascadeDeletionService));
    }

    @Override
    @Transactional
    public User registerUser(User user) {
        return registrationService.registerUser(user);
    }

    @Override
    public Optional<User> findByIdentifier(String identifier) {
        return profileService.findByIdentifier(identifier);
    }

    @Override
    public Optional<User> findByEmail(String email) {
        return profileService.findByEmail(email);
    }

    @Override
    public Optional<User> findById(Long id) {
        return profileService.findById(id);
    }

    @Override
    @Transactional
    public void updateSecurityPin(Long userId, String newPin) {
        securityPinService.updateSecurityPin(userId, newPin);
    }

    @Override
    @Transactional
    public boolean verifySecurityPin(Long userId, String pin) {
        return securityPinService.verifySecurityPin(userId, pin);
    }

    @Override
    @Transactional
    public void updateName(Long userId, String name) {
        profileService.updateName(userId, name);
    }

    @Override
    @Transactional
    public void updateCurrency(Long userId, String currency) {
        profileService.updateCurrency(userId, currency);
    }

    @Override
    @Transactional
    public void deleteUser(Long id) {
        accountManagementService.deleteUser(id);
    }

    @Override
    public boolean userExistsByEmail(String email) {
        return registrationService.userExistsByEmail(email);
    }

    @Override
    public boolean userExistsByUsername(String username) {
        return registrationService.userExistsByUsername(username);
    }

    @Override
    @Transactional
    public void updateProfilePicture(Long userId, String profilePictureUrl) {
        profileService.updateProfilePicture(userId, profilePictureUrl);
    }

    @Override
    @Transactional
    public User updateProfile(Long userId, String name, String profilePictureUrl) {
        return profileService.updateProfile(userId, name, profilePictureUrl);
    }

    @Override
    @Transactional
    public User ensureAdminRole(User user, String adminEmail) {
        return accountManagementService.ensureAdminRole(user, adminEmail);
    }

    @Override
    public List<String> suggestUsernames(String base) {
        return profileService.suggestUsernames(base);
    }
}
