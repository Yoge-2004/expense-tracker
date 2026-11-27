package com.example.expensetracker.infrastructure.logging;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Shared masking utility for redacting credentials, tokens, PINs, OTPs, and authorization
 * headers before messages are written to console, file, or in-memory admin logs.
 */
public final class SensitiveDataMasker {

    private static final Pattern SENSITIVE_PATTERN = Pattern.compile(
            "\"?(password|passwd|pwd|token|jwt|secret|pin|securityPin|otp|apiKey|authorization|credential)\"?"
                    + "\\s*[:=]\\s*(?:\"([^\"]*)\"|'([^']*)'|((?:Bearer\\s+)?[^\\s,;&}]+))",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern BEARER_JWT_PATTERN = Pattern.compile(
            "(?i)\\bBearer\\s+[A-Za-z0-9._\\-+/=]+|\\beyJ[A-Za-z0-9_\\-]+\\.[A-Za-z0-9_\\-]+\\.[A-Za-z0-9_\\-]+\\b"
    );

    private SensitiveDataMasker() {}

    /**
     * Replaces matched secret values with {@code <key>=***MASKED***} and redacts standalone Bearer/JWT tokens.
     *
     * @param input raw log message text
     * @return masked log text, or the input unchanged if {@code null} or empty
     */
    public static String mask(String input) {
        if (input == null || input.isEmpty()) {
            return input;
        }
        Matcher matcher = SENSITIVE_PATTERN.matcher(input);
        StringBuilder sb = new StringBuilder(input.length());
        while (matcher.find()) {
            String key = matcher.group(1);
            matcher.appendReplacement(sb, Matcher.quoteReplacement(key + "=***MASKED***"));
        }
        matcher.appendTail(sb);

        Matcher bearerMatcher = BEARER_JWT_PATTERN.matcher(sb.toString());
        if (!bearerMatcher.find()) {
            return sb.toString();
        }
        StringBuilder maskedTokens = new StringBuilder(sb.length());
        bearerMatcher.reset();
        while (bearerMatcher.find()) {
            bearerMatcher.appendReplacement(maskedTokens, "***MASKED_TOKEN***");
        }
        bearerMatcher.appendTail(maskedTokens);
        return maskedTokens.toString();
    }
}
