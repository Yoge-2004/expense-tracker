package com.example.expensetracker.infrastructure.security;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Configuration properties for trusted reverse proxies and load balancers.
 * Modern immutable record with validation per Spring Boot 4 baseline.
 *
 * @param enabled whether forward headers are honoured from trusted proxies
 * @param cidrs comma-separated CIDR blocks representing trusted upstream proxies
 * @param hops exact number of proxy hops in front of the application
 * @author Yogeshwaran
 */
@ConfigurationProperties(prefix = "app.trusted-proxy")
public record TrustedProxyProperties(
        @DefaultValue("false") boolean enabled,
        @DefaultValue("127.0.0.1/32,::1/128") String cidrs,
        @DefaultValue("0") int hops
) {
    public TrustedProxyProperties {
        if (cidrs == null || cidrs.isBlank()) {
            cidrs = "127.0.0.1/32,::1/128";
        }
    }
}
