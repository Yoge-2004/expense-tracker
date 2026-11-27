package com.example.expensetracker.domain.user.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.expensetracker.domain.user.model.Role;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.domain.user.repository.UserRepository;

/**
 * Focused implementation of {@link UserAccountManagementService} responsible for cascading
 * account deletion and administrative role bootstrapping.
 */
@Slf4j
@Primary
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserAccountManagementServiceImpl implements UserAccountManagementService {

    private final UserRepository userRepository;
    private final UserCascadeDeletionService userCascadeDeletionService;

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
}
