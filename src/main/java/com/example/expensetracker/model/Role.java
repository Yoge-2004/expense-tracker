package com.example.expensetracker.model;

/**
 * Role-based access control (RBAC) levels for Expense Tracker users and operators.
 *
 * <ul>
 *   <li>{@code ROLE_USER} — Standard registered end-user with access to their own data.</li>
 *   <li>{@code ROLE_SUPPORT} — Read-only administrative access for customer support and troubleshooting.</li>
 *   <li>{@code ROLE_ADMIN} — Operational administrator (user moderation, analytics, system health).</li>
 *   <li>{@code ROLE_SUPER_ADMIN} — Elevated administrator (role assignment, database failover, system config).</li>
 * </ul>
 *
 * @author Yogeshwaran
 */
public enum Role {
    ROLE_USER,
    ROLE_SUPPORT,
    ROLE_ADMIN,
    ROLE_SUPER_ADMIN
}
