package com.example.expensetracker.infrastructure.logging;

import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.pattern.CompositeConverter;

/**
 * Logback converter that masks sensitive data such as passwords, tokens, PINs,
 * and authorization headers before log messages are written to any appender.
 *
 * <p>Prevents inadvertent leakage of credentials, tokens, or PII into logs,
 * SIEMs, or log aggregators.</p>
 */
public class MaskingPatternConverter extends CompositeConverter<ILoggingEvent> {

    @Override
    protected String transform(ILoggingEvent event, String in) {
        return SensitiveDataMasker.mask(in);
    }
}
