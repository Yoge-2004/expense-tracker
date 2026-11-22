package com.example.expensetracker.infrastructure.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Type-safe configuration properties record for initial admin account bootstrapping.
 *
 * @author Yogeshwaran
 */
@ConfigurationProperties(prefix = "app.admin.bootstrap")
public record AdminBootstrapProperties(
        boolean enabled,
        String email,
        String username,
        String password,
        String pin
) {
    public AdminBootstrapProperties {
        if (email == null) email = "";
        if (username == null) username = "";
        if (password == null) password = "";
        if (pin == null) pin = "";
    }
}
