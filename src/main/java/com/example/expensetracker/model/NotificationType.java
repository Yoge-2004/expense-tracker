package com.example.expensetracker.model;

/**
 * Kinds of notification the app can send. Users can switch each kind off, except {@link #SYSTEM}
 * (important account notices).
 */
public enum NotificationType {
    BUDGET_WARNING("Budget warnings", "When a budget reaches 80% of its limit", true),
    BUDGET_EXCEEDED("Budget limit reached", "When spending reaches or passes a budget's limit", true),
    SUBSCRIPTION_DUE("Upcoming bills", "Subscriptions and recurring bills due in the next 3 days", true),
    GOAL_MILESTONE("Savings milestones", "When a savings goal reaches 25%, 50%, 75% or 100%", true),
    LARGE_EXPENSE("Unusually large expenses", "When an expense is far above what you usually spend", true),
    WEEKLY_DIGEST("Weekly summary", "A short summary of your week, every Sunday evening", true),
    SYSTEM("Account and system", "Important notices about your account", false);

    private final String label;
    private final String description;
    private final boolean userControllable;

    NotificationType(String label, String description, boolean userControllable) {
        this.label = label;
        this.description = description;
        this.userControllable = userControllable;
    }

    public String getLabel() { return label; }

    public String getDescription() { return description; }

    /** False for notices a user cannot switch off. */
    public boolean isUserControllable() { return userControllable; }
}
