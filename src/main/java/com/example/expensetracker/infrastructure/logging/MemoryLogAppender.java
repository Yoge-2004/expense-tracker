package com.example.expensetracker.infrastructure.logging;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.AppenderBase;
import jakarta.annotation.PostConstruct;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Thread-safe, lock-free ring buffer Logback appender capturing recent log events in memory
 * for live administrative inspection and UI observability.
 *
 * @author Yogeshwaran
 */
@Component
public class MemoryLogAppender extends AppenderBase<ILoggingEvent> {

    static final int MAX_CAPACITY = 1000;
    private final ConcurrentLinkedDeque<LogEntryDto> buffer = new ConcurrentLinkedDeque<>();
    private final AtomicInteger bufferSize = new AtomicInteger(0);
    private static final DateTimeFormatter ISO_FMT = DateTimeFormatter.ISO_INSTANT.withZone(ZoneOffset.UTC);

    @PostConstruct
    public void register() {
        Logger root = (Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME);
        setName("MEMORY_BUFFER_APPENDER");
        setContext(root.getLoggerContext());
        start();
        root.addAppender(this);
    }

    @Override
    protected void append(ILoggingEvent event) {
        if (event == null) {
            return;
        }
        String formattedTime = ISO_FMT.format(Instant.ofEpochMilli(event.getTimeStamp()));
        String lvl = event.getLevel() != null ? event.getLevel().toString().toUpperCase(Locale.ROOT) : "INFO";
        if ("WARNING".equals(lvl)) lvl = "WARN";
        if ("CRITICAL".equals(lvl) || "FATAL".equals(lvl)) lvl = "ERROR";

        String maskedMessage = SensitiveDataMasker.mask(event.getFormattedMessage());
        buffer.addLast(new LogEntryDto(
                formattedTime,
                lvl,
                event.getThreadName(),
                event.getLoggerName(),
                maskedMessage != null ? maskedMessage : ""
        ));
        bufferSize.incrementAndGet();
        while (bufferSize.get() > MAX_CAPACITY && buffer.pollFirst() != null) {
            bufferSize.decrementAndGet();
        }
    }

    public List<LogEntryDto> getRecentLogs(int limit, String levelFilter, String queryFilter) {
        List<LogEntryDto> result = new ArrayList<>();
        String lvl = (levelFilter != null) ? levelFilter.trim().toUpperCase(Locale.ROOT) : "ALL";
        String q = (queryFilter != null) ? queryFilter.trim().toLowerCase(Locale.ROOT) : "";
        int minSeverity = levelSeverity(lvl);

        for (LogEntryDto entry : buffer) {
            if (minSeverity > 0 && levelSeverity(entry.level()) < minSeverity) {
                continue;
            }
            if (!q.isEmpty()) {
                String msg = entry.message() != null ? entry.message().toLowerCase(Locale.ROOT) : "";
                String logger = entry.logger() != null ? entry.logger().toLowerCase(Locale.ROOT) : "";
                if (!msg.contains(q) && !logger.contains(q)) {
                    continue;
                }
            }
            result.add(entry);
        }

        int size = result.size();
        int max = Math.clamp(limit, 10, MAX_CAPACITY);
        if (size > max) {
            return new ArrayList<>(result.subList(size - max, size));
        }
        return result;
    }

    private static int levelSeverity(String level) {
        if (level == null || level.isBlank() || "ALL".equalsIgnoreCase(level)) {
            return 0;
        }
        return switch (level.trim().toUpperCase()) {
            case "CRITICAL", "FATAL", "ERROR" -> 40;
            case "WARN", "WARNING" -> 30;
            case "INFO" -> 20;
            case "DEBUG" -> 10;
            case "TRACE" -> 5;
            default -> 0;
        };
    }
}
