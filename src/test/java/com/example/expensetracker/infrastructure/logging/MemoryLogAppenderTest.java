package com.example.expensetracker.infrastructure.logging;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.LoggingEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class MemoryLogAppenderTest {

    private MemoryLogAppender appender;
    private Logger logger;

    @BeforeEach
    void setUp() {
        appender = new MemoryLogAppender();
        logger = (Logger) LoggerFactory.getLogger("com.example.expensetracker.test");
        appender.setContext(logger.getLoggerContext());
        appender.start();
    }

    @Test
    void appendMasksSensitiveTokensAndSecrets() {
        LoggingEvent event = new LoggingEvent(
                Logger.FQCN,
                logger,
                Level.INFO,
                "Auth password=superSecret123 Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig",
                null,
                null);

        appender.append(event);
        List<LogEntryDto> recent = appender.getRecentLogs(50, "ALL", null);

        assertThat(recent).hasSize(1);
        assertThat(recent.getFirst().message())
                .contains("password=***MASKED***")
                .contains("***MASKED_TOKEN***")
                .doesNotContain("superSecret123")
                .doesNotContain("eyJhbGciOiJIUzI1NiJ9.payload.sig");
    }

    @Test
    void appendEnforcesBoundedRingBufferAndSupportsSeverityAndQueryFilters() {
        for (int i = 0; i < MemoryLogAppender.MAX_CAPACITY + 25; i++) {
            Level level = (i % 100 == 0) ? Level.ERROR : Level.INFO;
            LoggingEvent event = new LoggingEvent(
                    Logger.FQCN,
                    logger,
                    level,
                    "event-seq-" + i,
                    null,
                    null);
            appender.append(event);
        }

        List<LogEntryDto> all = appender.getRecentLogs(MemoryLogAppender.MAX_CAPACITY, "ALL", null);
        assertThat(all).hasSize(MemoryLogAppender.MAX_CAPACITY);
        assertThat(all.getFirst().message()).isEqualTo("event-seq-25");
        assertThat(all.getLast().message()).isEqualTo("event-seq-1024");

        List<LogEntryDto> errorsOnly = appender.getRecentLogs(50, "ERROR", "1000");
        assertThat(errorsOnly)
                .hasSize(1)
                .allMatch(e -> "ERROR".equals(e.level()) && e.message().contains("event-seq-1000"));
    }
}
