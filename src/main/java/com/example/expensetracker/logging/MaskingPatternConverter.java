package com.example.expensetracker.logging;

import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.pattern.CompositeConverter;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Logback converter that masks sensitive data such as passwords, tokens, PINs,
 * and authorization headers before log messages are written to any appender.
 *
 * <p>Prevents inadvertent leakage of credentials, tokens, or PII into logs,
 * SIEMs, or log aggregators.</p>
 */
public class MaskingPatternConverter extends CompositeConverter<ILoggingEvent> {

    private static final Pattern SENSITIVE_PATTERN = Pattern.compile(
            "\"?(password|passwd|pwd|token|jwt|secret|pin|securityPin|otp|apiKey|authorization|credential)\"?\\s*[:=]\\s*\"?([^\",\\s&]+)\"?",
            Pattern.CASE_INSENSITIVE
    );

    @Override
    protected String transform(ILoggingEvent event, String in) {
        if (in == null || in.isEmpty()) {
            return in;
        }
        Matcher matcher = SENSITIVE_PATTERN.matcher(in);
        StringBuilder sb = new StringBuilder(in.length());
        while (matcher.find()) {
            String key = matcher.group(1);
            matcher.appendReplacement(sb, Matcher.quoteReplacement(key + "=***MASKED***"));
        }
        matcher.appendTail(sb);
        return sb.toString();
    }
}
