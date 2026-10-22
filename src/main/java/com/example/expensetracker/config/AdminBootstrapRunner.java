package com.example.expensetracker.config;

import com.example.expensetracker.model.Role;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Ensures the platform administrator account is provisioned and granted
 * {@link Role#ROLE_SUPER_ADMIN} clearance on application startup.
 *
 * <p>Configurable via the {@code ADMIN_EMAIL} environment variable (defaulting
 *
 * @author Yogeshwaran
 */
@Slf4j
@Component
@Order(10)
@RequiredArgsConstructor
public class AdminBootstrapRunner implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.admin.bootstrap.enabled:true}")
    private boolean bootstrapEnabled;

    @Value("${app.admin.bootstrap.email:${ADMIN_EMAIL:}}")
    private String bootstrapEmail;

    @Value("${app.admin.bootstrap.username:${ADMIN_USERNAME:}}")
    private String bootstrapUsername;

    @Value("${app.admin.bootstrap.password:${ADMIN_PASSWORD:}}")
    private String bootstrapPassword;

    @Value("${app.admin.bootstrap.pin:${ADMIN_PIN:}}")
    private String bootstrapPin;

    @Override
    @Transactional
    public void run(String... args) {
        if (!bootstrapEnabled || bootstrapEmail == null || bootstrapEmail.isBlank()) {
            log.info("Admin bootstrapping is disabled or email is not specified");
            return;
        }

        String targetEmail = bootstrapEmail.trim().toLowerCase(java.util.Locale.ROOT);

        userRepository.findByEmailIgnoreCase(targetEmail).ifPresentOrElse(existing -> {
            log.info("Ensuring user '{}' is assigned ROLE_SUPER_ADMIN clearance", existing.getEmail());
            existing.setRole(Role.ROLE_SUPER_ADMIN);
            existing.setAccountLocked(false);
            existing.setEnabled(true);
            if (existing.getPassword() == null && bootstrapPassword != null && !bootstrapPassword.isBlank()) {
                existing.setPassword(passwordEncoder.encode(bootstrapPassword));
            }
            if (!existing.hasSecurityPin() && bootstrapPin != null && !bootstrapPin.isBlank()) {
                existing.setSecurityPinHash(passwordEncoder.encode(bootstrapPin));
            }
            userRepository.save(existing);
            log.info("Super Admin clearance verified and granted for '{}'", existing.getEmail());
        }, () -> {
            if (bootstrapPassword == null || bootstrapPassword.isBlank()) {
                log.warn("Cannot provision admin user '{}': ADMIN_PASSWORD is not set in environment.", targetEmail);
                return;
            }
            String uname = (bootstrapUsername != null && !bootstrapUsername.isBlank())
                    ? bootstrapUsername.trim()
                    : targetEmail.split("@")[0];
            log.info("Provisioning platform Super Admin account for: {}", targetEmail);
            User.UserBuilder builder = User.builder()
                    .name("Administrator")
                    .username(uname)
                    .email(targetEmail)
                    .password(passwordEncoder.encode(bootstrapPassword))
                    .role(Role.ROLE_SUPER_ADMIN)
                    .enabled(true)
                    .accountLocked(false)
                    .currency("INR")
                    .createdAt(LocalDateTime.now());
            if (bootstrapPin != null && !bootstrapPin.isBlank()) {
                builder.securityPinHash(passwordEncoder.encode(bootstrapPin));
            }
            userRepository.save(builder.build());
            log.info("Super Admin successfully provisioned with username='{}' and email='{}'",
                    uname, targetEmail);
        });
    }
}
