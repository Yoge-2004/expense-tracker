package com.example.expensetracker.infrastructure.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.example.expensetracker.domain.user.model.Role;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.domain.user.repository.UserRepository;

import java.time.LocalDateTime;

/**
 * Boots the initial system administrator / super admin account at application startup
 * if configured, to ensure zero-lockout deployments.
 *
 * @author Yogeshwaran
 */
@Slf4j
@Component
@Order(10)
public class AdminBootstrapRunner implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AdminBootstrapProperties properties;

    @Autowired
    public AdminBootstrapRunner(UserRepository userRepository,
                                PasswordEncoder passwordEncoder,
                                @Autowired(required = false) AdminBootstrapProperties properties) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.properties = (properties != null)
                ? properties
                : new AdminBootstrapProperties(true, "", "", "", "");
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (!properties.enabled() || properties.email() == null || properties.email().isBlank()) {
            log.info("Admin bootstrapping is disabled or email is not specified");
            return;
        }

        String targetEmail = properties.email().trim().toLowerCase(java.util.Locale.ROOT);

        userRepository.findByEmailIgnoreCase(targetEmail).ifPresentOrElse(existing -> {
            log.info("Ensuring user '{}' is assigned ROLE_SUPER_ADMIN clearance", existing.getEmail());
            boolean modified = false;
            if (existing.getRole() != Role.ROLE_SUPER_ADMIN) {
                existing.setRole(Role.ROLE_SUPER_ADMIN);
                modified = true;
            }
            if (existing.isAccountLocked()) {
                existing.setAccountLocked(false);
                modified = true;
            }
            if (!existing.isEnabled()) {
                existing.setEnabled(true);
                modified = true;
            }
            if (modified) {
                userRepository.save(existing);
                log.info("Successfully elevated '{}' to ROLE_SUPER_ADMIN", targetEmail);
            }
        }, () -> {
            String fallbackUser = (properties.username() != null && !properties.username().isBlank())
                    ? properties.username().trim()
                    : "admin";

            String rawPass = (properties.password() != null && !properties.password().isBlank())
                    ? properties.password()
                    : "Admin@123456";

            log.info("Bootstrapping default Super Administrator: email={}, username={}", targetEmail, fallbackUser);

            User bootstrapAdmin = User.builder()
                    .name("Super Administrator")
                    .email(targetEmail)
                    .username(fallbackUser)
                    .password(passwordEncoder.encode(rawPass))
                    .role(Role.ROLE_SUPER_ADMIN)
                    .enabled(true)
                    .accountLocked(false)
                    .failedPinAttempts(0)
                    .createdAt(LocalDateTime.now())
                    .build();

            if (properties.pin() != null && !properties.pin().isBlank()) {
                bootstrapAdmin.setSecurityPinHash(passwordEncoder.encode(properties.pin().trim()));
            }

            userRepository.save(bootstrapAdmin);
            log.info("Default Super Administrator account provisioned successfully: email={}", targetEmail);
        });
    }
}
