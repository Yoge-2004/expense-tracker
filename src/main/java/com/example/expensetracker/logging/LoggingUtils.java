package com.example.expensetracker.logging;

/**
 * Utility methods for safe and production-ready log sanitization.
 */
public final class LoggingUtils {

    private LoggingUtils() {}

    /**
     * Masks an email address for privacy-safe logging.
     * Example: "john.doe@example.com" -> "j***e@example.com"
     *
     * @param email the email address to mask
     * @return the masked email string
     */
    public static String maskEmail(String email) {
        if (email == null || email.isBlank()) {
            return "[empty]";
        }
        String clean = email.trim();
        int atIndex = clean.indexOf('@');
        if (atIndex <= 1) {
            return "***" + (atIndex >= 0 ? clean.substring(atIndex) : "");
        }
        String local = clean.substring(0, atIndex);
        String domain = clean.substring(atIndex);
        if (local.length() == 2) {
            return local.charAt(0) + "***" + domain;
        }
        return local.charAt(0) + "***" + local.charAt(local.length() - 1) + domain;
    }

    /**
     * Sanitizes a log message string by replacing carriage returns and line feeds (including CRLF)
     * with a single underscore to prevent log injection / log forging.
     *
     * @param value raw input string
     * @return sanitized string
     */
    public static String sanitize(String value) {
        if (value == null) {
            return "";
        }
        return value.replaceAll("\r\n|[\r\n]", "_");
    }
}
