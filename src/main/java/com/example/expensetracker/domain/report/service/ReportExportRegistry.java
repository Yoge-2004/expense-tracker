package com.example.expensetracker.domain.report.service;

import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Registry holding all active {@link ReportExportStrategy} beans.
 * Automatically populated by Spring DI, enabling new formats to be plugged in
 * without modifying existing code.
 */
@Component
public class ReportExportRegistry {

    private final Map<String, ReportExportStrategy> strategies;

    public ReportExportRegistry(List<ReportExportStrategy> strategyList) {
        Map<String, ReportExportStrategy> map = new HashMap<>();
        for (ReportExportStrategy strategy : strategyList) {
            map.put(strategy.format().toLowerCase(Locale.ROOT), strategy);
            // Alias excel to xlsx as well
            if ("excel".equalsIgnoreCase(strategy.format())) {
                map.putIfAbsent("xlsx", strategy);
            } else if ("xlsx".equalsIgnoreCase(strategy.format())) {
                map.putIfAbsent("excel", strategy);
            }
        }
        this.strategies = Map.copyOf(map);
    }

    /**
     * Finds an export strategy by format name.
     *
     * @param format name of the format (case-insensitive)
     * @return Optional containing the strategy if found
     */
    public Optional<ReportExportStrategy> findStrategy(String format) {
        if (format == null || format.isBlank()) {
            return Optional.empty();
        }
        return Optional.ofNullable(strategies.get(format.trim().toLowerCase(Locale.ROOT)));
    }

    /**
     * Returns all registered format keys.
     */
    public Iterable<String> getSupportedFormats() {
        return strategies.keySet();
    }
}
