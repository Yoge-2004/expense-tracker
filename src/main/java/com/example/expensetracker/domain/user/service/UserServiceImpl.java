package com.example.expensetracker.domain.user.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.*;

import com.example.expensetracker.domain.ai.repository.MlFeedbackRepository;
import com.example.expensetracker.domain.budget.repository.BudgetRepository;
import com.example.expensetracker.domain.expense.repository.CategoryRepository;
import com.example.expensetracker.domain.expense.repository.ExpenseRepository;
import com.example.expensetracker.domain.expense.repository.RecurringExpenseRepository;
import com.example.expensetracker.domain.goal.repository.SavingsGoalRepository;
import com.example.expensetracker.domain.income.repository.IncomeRepository;
import com.example.expensetracker.domain.loan.repository.LoanAdjustmentRepository;
import com.example.expensetracker.domain.notification.repository.AppNotificationRepository;
import com.example.expensetracker.domain.notification.repository.DeviceTokenRepository;
import com.example.expensetracker.domain.notification.repository.NotificationPreferenceRepository;
import com.example.expensetracker.domain.report.repository.MonthlyReportLogRepository;
import com.example.expensetracker.domain.user.model.Role;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.domain.user.repository.UserAppearanceRepository;
import com.example.expensetracker.domain.user.repository.UserRepository;
import com.example.expensetracker.domain.user.repository.WebAuthnCredentialRepository;



/**
 * Concrete implementation of {@link UserService} providing business logic
 * for user registration, lookup, password management, and account deletion.
 */
@Slf4j
@Service
@Transactional(readOnly = true)
public class UserServiceImpl implements UserService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final ExpenseRepository expenseRepository;
    private final CategoryRepository categoryRepository;
    private final BudgetRepository budgetRepository;
    private final RecurringExpenseRepository recurringRepository;
    private final IncomeRepository incomeRepository;
    private final SavingsGoalRepository savingsGoalRepository;
    private final MonthlyReportLogRepository reportLogRepository;
    private final WebAuthnCredentialRepository webAuthnCredentialRepository;
    private final AppNotificationRepository appNotificationRepository;
    private final DeviceTokenRepository deviceTokenRepository;
    private final LoanAdjustmentRepository loanAdjustmentRepository;
    private final MlFeedbackRepository mlFeedbackRepository;
    private final NotificationPreferenceRepository notificationPreferenceRepository;
    private final UserAppearanceRepository userAppearanceRepository;
    private final com.example.expensetracker.domain.user.service.UserCascadeDeletionService userCascadeDeletionService;

    @org.springframework.beans.factory.annotation.Autowired
    public UserServiceImpl(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            ExpenseRepository expenseRepository,
            CategoryRepository categoryRepository,
            BudgetRepository budgetRepository,
            RecurringExpenseRepository recurringRepository,
            IncomeRepository incomeRepository,
            SavingsGoalRepository savingsGoalRepository,
            MonthlyReportLogRepository reportLogRepository,
            WebAuthnCredentialRepository webAuthnCredentialRepository,
            @org.springframework.beans.factory.annotation.Autowired(required = false) AppNotificationRepository appNotificationRepository,
            @org.springframework.beans.factory.annotation.Autowired(required = false) DeviceTokenRepository deviceTokenRepository,
            @org.springframework.beans.factory.annotation.Autowired(required = false) LoanAdjustmentRepository loanAdjustmentRepository,
            @org.springframework.beans.factory.annotation.Autowired(required = false) MlFeedbackRepository mlFeedbackRepository,
            @org.springframework.beans.factory.annotation.Autowired(required = false) NotificationPreferenceRepository notificationPreferenceRepository,
            @org.springframework.beans.factory.annotation.Autowired(required = false) UserAppearanceRepository userAppearanceRepository,
            @org.springframework.beans.factory.annotation.Autowired(required = false) com.example.expensetracker.domain.user.service.UserCascadeDeletionService userCascadeDeletionService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.expenseRepository = expenseRepository;
        this.categoryRepository = categoryRepository;
        this.budgetRepository = budgetRepository;
        this.recurringRepository = recurringRepository;
        this.incomeRepository = incomeRepository;
        this.savingsGoalRepository = savingsGoalRepository;
        this.reportLogRepository = reportLogRepository;
        this.webAuthnCredentialRepository = webAuthnCredentialRepository;
        this.appNotificationRepository = appNotificationRepository;
        this.deviceTokenRepository = deviceTokenRepository;
        this.loanAdjustmentRepository = loanAdjustmentRepository;
        this.mlFeedbackRepository = mlFeedbackRepository;
        this.notificationPreferenceRepository = notificationPreferenceRepository;
        this.userAppearanceRepository = userAppearanceRepository;
        this.userCascadeDeletionService = (userCascadeDeletionService != null)
                ? userCascadeDeletionService
                : new UserCascadeDeletionServiceImpl(
                        expenseRepository, categoryRepository, budgetRepository, recurringRepository,
                        incomeRepository, savingsGoalRepository, reportLogRepository, webAuthnCredentialRepository,
                        appNotificationRepository, deviceTokenRepository, loanAdjustmentRepository,
                        mlFeedbackRepository, notificationPreferenceRepository, userAppearanceRepository);
    }

    /**
     * Backward-compatible constructor for testing without auxiliary repositories.
     */
    public UserServiceImpl(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            ExpenseRepository expenseRepository,
            CategoryRepository categoryRepository,
            BudgetRepository budgetRepository,
            RecurringExpenseRepository recurringRepository,
            IncomeRepository incomeRepository,
            SavingsGoalRepository savingsGoalRepository,
            MonthlyReportLogRepository reportLogRepository,
            WebAuthnCredentialRepository webAuthnCredentialRepository) {
        this(userRepository, passwordEncoder, expenseRepository, categoryRepository,
                budgetRepository, recurringRepository, incomeRepository, savingsGoalRepository,
                reportLogRepository, webAuthnCredentialRepository, null, null, null, null, null, null, null);
    }

    @Override
    @Transactional
    public User registerUser(User user) {
        log.info("Attempting to register user");
        if (user == null) {
            throw new IllegalArgumentException("User cannot be null");
        }
        if (user.getEmail() == null || user.getEmail().isBlank()) {
            throw new IllegalArgumentException("User email cannot be blank");
        }
        if (user.getPassword() == null || user.getPassword().isBlank()) {
            throw new IllegalArgumentException("User password cannot be blank");
        }

        String normalizedEmail = user.getEmail().trim();
        if (userRepository.findByEmailIgnoreCase(normalizedEmail).isPresent()) {
            log.warn("Registration rejected because email is already registered");
            throw new IllegalArgumentException("User with this email already exists");
        }
        if (user.getUsername() != null && !user.getUsername().isBlank()) {
            String normalizedUsername = user.getUsername().trim();
            if (userRepository.findByUsernameIgnoreCase(normalizedUsername).isPresent()) {
                log.warn("Registration rejected because username is already registered");
                throw new IllegalArgumentException("Username '" + normalizedUsername
                        + "' is already taken. Please choose another.");
            }
            user.setUsername(normalizedUsername);
        }
        user.setEmail(normalizedEmail);
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        if (user.getSecurityPinHash() != null && !user.getSecurityPinHash().isBlank()) {
            user.setSecurityPinHash(passwordEncoder.encode(user.getSecurityPinHash().trim()));
        }
        user.setEnabled(true);
        if (user.getCurrency() == null || user.getCurrency().isBlank()) {
            user.setCurrency("INR");
        } else {
            // Re-validate at the service boundary so all entry paths are covered.
            String c = user.getCurrency().trim();
            if (!c.matches("^[A-Za-z]{3}$")) {
                throw new IllegalArgumentException(
                        "Currency must be a 3-letter ISO 4217 code (got '" + c + "')");
            }
            user.setCurrency(c.toUpperCase(java.util.Locale.ROOT));
        }
        User savedUser = userRepository.save(user);
        log.info("User registered successfully with id={}", savedUser.getId());
        return savedUser;
    }

    @Override
    public Optional<User> findByIdentifier(String identifier) {
        if (identifier == null || identifier.isBlank()) {
            return Optional.empty();
        }
        String q = identifier.trim();
        log.debug("Finding user by supplied identifier");
        return userRepository.findByEmailIgnoreCase(q)
                .or(() -> userRepository.findByUsernameIgnoreCase(q));
    }

    @Override
    public Optional<User> findByEmail(String email) {
        if (email == null || email.isBlank()) return Optional.empty();
        log.debug("Finding user by email identifier");
        return userRepository.findByEmailIgnoreCase(email.trim())
                .or(() -> userRepository.findByEmail(email));
    }

    @Override
    public Optional<User> findById(Long id) {
        if (id == null) return Optional.empty();
        log.debug("Finding user by id: {}", id);
        return userRepository.findById(id);
    }

    @Override
    @Transactional
    public void updateSecurityPin(Long userId, String newPin) {
        if (userId == null) {
            throw new IllegalArgumentException("User ID cannot be null");
        }
        if (newPin == null || !newPin.matches("^[0-9]{6}$")) {
            throw new IllegalArgumentException("Security PIN must be exactly 6 digits.");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.setSecurityPinHash(passwordEncoder.encode(newPin));
        user.setFailedPinAttempts(0);
        user.setPinLockedUntil(null);
        userRepository.save(user);
        log.info("Security PIN updated successfully for userId={}", userId);
    }

    @Override
    @Transactional
    public boolean verifySecurityPin(Long userId, String pin) {
        if (userId == null) {
            throw new IllegalArgumentException("User ID cannot be null");
        }
        if (pin == null || !pin.matches("^[0-9]{6}$")) {
            throw new IllegalArgumentException("Security PIN must be exactly 6 numeric digits");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (user.getPinLockedUntil() != null) {
            if (user.getPinLockedUntil().isAfter(LocalDateTime.now())) {
                log.warn("Security PIN verification blocked: userId={} is locked until {}",
                        userId, user.getPinLockedUntil());
                throw new IllegalStateException("Security PIN verification temporarily locked");
            }
            // The lock has been served: start from a clean slate. Without this the
            // counter stayed at >= 5, so a single wrong PIN after expiry re-locked
            // the account for another full 15 minutes.
            user.setPinLockedUntil(null);
            user.setFailedPinAttempts(0);
        }

        if (user.getSecurityPinHash() == null || user.getSecurityPinHash().isBlank()) {
            log.warn("Security PIN verification rejected: no PIN set for userId={}", userId);
            throw new IllegalStateException("No security PIN has been set");
        }

        if (passwordEncoder.matches(pin, user.getSecurityPinHash())) {
            user.setFailedPinAttempts(0);
            user.setPinLockedUntil(null);
            userRepository.save(user);
            log.info("Security PIN verified successfully for userId={}", userId);
            return true;
        }

        int attempts = user.getFailedPinAttempts() + 1;
        user.setFailedPinAttempts(attempts);
        if (attempts >= 5) {
            user.setPinLockedUntil(LocalDateTime.now().plusMinutes(15));
            log.warn("Security PIN verification locked out for 15 minutes for userId={} after {} attempts",
                    userId, attempts);
        } else {
            log.warn("Security PIN verification failed for userId={}, failedAttempts={}", userId, attempts);
        }
        userRepository.save(user);
        return false;
    }

    @Override
    @Transactional
    public void updateName(Long userId, String name) {
        if (userId == null) {
            throw new IllegalArgumentException("User ID cannot be null");
        }
        if (name == null || name.trim().length() < 2 || name.trim().length() > 50) {
            throw new IllegalArgumentException("Display name must be between 2 and 50 characters.");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.setName(name.trim());
        userRepository.save(user);
        log.info("Display name updated successfully for userId={} to '{}'", userId, user.getName());
    }

    @Override
    @Transactional
    public void updateCurrency(Long userId, String currency) {
        if (userId == null) {
            throw new IllegalArgumentException("User ID cannot be null");
        }
        if (currency == null || !currency.matches("^[A-Za-z]{3}$")) {
            throw new IllegalArgumentException("Currency must be a 3-letter ISO 4217 code.");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.setCurrency(currency.toUpperCase(java.util.Locale.ROOT));
        userRepository.save(user);
        log.info("Currency updated successfully for userId={} to {}", userId, user.getCurrency());
    }

    @Override
    @Transactional
    public void deleteUser(Long userId) {
        if (userId == null) {
            throw new IllegalArgumentException("User ID cannot be null");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        log.warn("Initiating full cascading account deletion for userId={}", userId);
        userCascadeDeletionService.cascadeDeleteUserData(userId, user);
        userRepository.delete(user);
        log.info("Account deletion completed for userId={}", userId);
    }

    @Override
    public boolean userExistsByEmail(String email) {
        return email != null && userRepository.existsByEmailIgnoreCase(email.trim());
    }

    @Override
    public boolean userExistsByUsername(String username) {
        return username != null && userRepository.existsByUsernameIgnoreCase(username.trim());
    }

    @Override
    @Transactional
    public void updateProfilePicture(Long userId, String profilePictureUrl) {
        if (userId == null) {
            throw new IllegalArgumentException("User ID cannot be null");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.setProfilePictureUrl(profilePictureUrl);
        userRepository.save(user);
        log.info("Profile picture updated successfully for userId={}", userId);
    }

    @Override
    @Transactional
    public User ensureAdminRole(User user, String adminEmail) {
        if (user == null || user.getEmail() == null || adminEmail == null || adminEmail.isBlank()) {
            return user;
        }
        if (user.getEmail().equalsIgnoreCase(adminEmail.trim())) {
            if (user.getRole() != Role.ROLE_SUPER_ADMIN || !user.isEnabled() || user.isAccountLocked()) {
                user.setRole(Role.ROLE_SUPER_ADMIN);
                user.setEnabled(true);
                user.setAccountLocked(false);
                User saved = userRepository.save(user);
                log.info("Ensured ROLE_SUPER_ADMIN clearance for admin email={}", user.getEmail());
                return saved;
            }
        }
        return user;
    }

    @Override
    public List<String> suggestUsernames(String base) {
        String clean = (base != null) ? base.replaceAll("[^a-zA-Z0-9]", "").toLowerCase(Locale.ROOT) : "";
        if (clean.isEmpty()) clean = "user";

        Set<String> uniqueSuggestions = new LinkedHashSet<>();
        String[] prefixes = {"iam", "the", "real", "hey", "go"};
        for (String p : prefixes) {
            if (uniqueSuggestions.size() >= 3) break;
            String candidate = (p + "_" + clean).replaceAll("[^a-zA-Z0-9_]", "");
            if (candidate.length() > 30) candidate = candidate.substring(0, 30);
            if (!userExistsByUsername(candidate)) {
                uniqueSuggestions.add(candidate);
            }
        }

        int attempts = 0;
        while (uniqueSuggestions.size() < 3 && attempts < 100) {
            attempts++;
            int num = 100 + RANDOM.nextInt(900);
            String candidate = clean + num;
            if (candidate.length() > 30) candidate = candidate.substring(0, 30);
            if (!userExistsByUsername(candidate)) {
                uniqueSuggestions.add(candidate);
            }
        }
        return new ArrayList<>(uniqueSuggestions);
    }
}
