package com.example.expensetracker.logging;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.AppenderBase;
import com.example.expensetracker.dto.AdminLogEntryDto;
import jakarta.annotation.PostConstruct;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;

/**
 * Thread-safe ring buffer Logback appender capturing recent log events in memory
 * for live administrative inspection and UI observability.
 *
 * @author Yogeshwaran
 */
@Component
public class MemoryLogAppender extends AppenderBase<ILoggingEvent> {

    private static final int MAX_CAPACITY = 1000;
    private final Deque<AdminLogEntryDto> buffer = new ArrayDeque<>(MAX_CAPACITY);
    private static final DateTimeFormatter ISO_FMT = DateTimeFormatter.ISO_OFFSET_DATE_TIME.withZone(ZoneId.systemDefault());

    @PostConstruct
    public void register() {
        Logger root = (Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME);
        setName("MEMORY_BUFFER_APPENDER");
        setContext(root.getLoggerContext());
        start();
        root.addAppender(this);
    }

    @Override
    protected synchronized void append(ILoggingEvent event) {
        if (buffer.size() >= MAX_CAPACITY) {
            buffer.removeFirst();
        }
        String formattedTime = ISO_FMT.format(Instant.ofEpochMilli(event.getTimeStamp()));
        buffer.addLast(new AdminLogEntryDto(
                formattedTime,
                event.getLevel().toString(),
                event.getThreadName(),
                event.getLoggerName(),
                event.getFormattedMessage()
        ));
    }

    public synchronized List<AdminLogEntryDto> getRecentLogs(int limit, String levelFilter, String queryFilter) {
        List<AdminLogEntryDto> result = new ArrayList<>();
        String lvl = (levelFilter != null) ? levelFilter.trim().toUpperCase() : "ALL";
        String q = (queryFilter != null) ? queryFilter.trim().toLowerCase() : "";

        for (AdminLogEntryDto entry : buffer) {
            if (!"ALL".equals(lvl) && !entry.level().equalsIgnoreCase(lvl)) {
                continue;
            }
            if (!q.isEmpty() && !entry.message().toLowerCase().contains(q) && !entry.logger().toLowerCase().contains(q)) {
                continue;
            }
            result.add(entry);
        }

        int size = result.size();
        int max = Math.min(Math.max(limit, 10), 500);
        if (size > max) {
            return new ArrayList<>(result.subList(size - max, size));
        }
        return result;
    }
}
