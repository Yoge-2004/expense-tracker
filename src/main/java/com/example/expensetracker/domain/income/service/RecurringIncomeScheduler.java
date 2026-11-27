package com.example.expensetracker.domain.income.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

import com.example.expensetracker.domain.income.model.Income;
import com.example.expensetracker.domain.income.repository.IncomeRepository;

/**
 * Scheduled background service that processes recurring income streams
 * (salary, dividends, rental income, freelance retainers).
 *
 * <p>Operates identically to {@link com.example.expensetracker.domain.expense.service.RecurringExpenseScheduler}: runs daily at midnight,
 * queries all recurring {@link Income} records with {@code nextDueDate <= today},
 * generates concrete {@link Income} entries, and steps {@code nextDueDate} forward.</p>
 *
 * @author Yogeshwaran
 * @version 1.0
 * @see Income
 */
@Slf4j
@Component
@SuppressWarnings("java:S6809")
public class RecurringIncomeScheduler {

    private final IncomeRepository incomeRepository;

    /** Each record is committed on its own, so one bad row cannot roll back everyone else's occurrences. */
    private final TransactionTemplate transactionTemplate;
    private final CacheManager cacheManager;
    private final Clock clock;

    /** Calendar zone that decides what "today" is; blank means the server's zone. */
    @Value("${app.notifications.zone:}")
    private String zone = "";

    @Autowired
    public RecurringIncomeScheduler(
            IncomeRepository incomeRepository,
            @Autowired(required = false) TransactionTemplate transactionTemplate,
            @Autowired(required = false) CacheManager cacheManager,
            @Autowired(required = false) Clock clock) {
        this.incomeRepository = incomeRepository;
        this.transactionTemplate = transactionTemplate;
        this.cacheManager = cacheManager;
        this.clock = clock != null ? clock : Clock.systemDefaultZone();
    }

    private LocalDate today() {
        return zone == null || zone.isBlank()
                ? LocalDate.now(clock)
                : LocalDate.now(clock.withZone(ZoneId.of(zone)));
    }

    /** These services write straight to the repositories, so the cached per-user lists must be dropped by hand. */
    private void evictCache(String cacheName, Long userId) {
        if (cacheManager == null || userId == null) {
            return;
        }
        Cache cache = cacheManager.getCache(cacheName);
        if (cache != null) {
            cache.evict(userId);
        }
    }

    /**
     * Processes all recurring income streams that are due on or before today.
     */
    @Scheduled(cron = "0 0 0 * * *", zone = "${app.notifications.zone:Asia/Kolkata}")
    public void processRecurringIncomes() {
        log.info("Processing due recurring incomes...");
        List<Income> dueIncomes =
                incomeRepository.findByIsRecurringTrueAndNextDueDateLessThanEqual(today());

        int processedCount = 0;
        int failedCount = 0;
        for (Income rec : dueIncomes) {
            if (rec == null || rec.getNextDueDate() == null) {
                continue;
            }
            try {
                int created = processInOwnTransaction(rec);
                processedCount += created;
                if (created > 0) {
                    evictCache("userIncomes", rec.getUser() != null ? rec.getUser().getId() : null);
                }
            } catch (Exception itemEx) {
                failedCount++;
                log.error("CRITICAL: Failed to process recurring income id={} for userId={}: {}",
                        rec.getId(), rec.getUser() != null ? rec.getUser().getId() : "null",
                        itemEx.getMessage(), itemEx);
            }
        }
        log.info("Finished processing recurring incomes. Processed {} occurrences, {} failures.",
                processedCount, failedCount);
    }

    private int processInOwnTransaction(Income listed) {
        if (transactionTemplate == null) {
            return processOccurrences(listed);
        }
        Integer created = transactionTemplate.execute(status ->
                incomeRepository.findById(listed.getId()).map(this::processOccurrences).orElse(0));
        return created == null ? 0 : created;
    }

    private int processOccurrences(Income rec) {
        int created = 0;
        while (rec.getNextDueDate() != null && !rec.getNextDueDate().isAfter(today())) {
            Income concrete = new Income();
            concrete.setAmount(rec.getAmount());
            concrete.setSource(rec.getSource());
            String baseDesc = rec.getDescription() != null && !rec.getDescription().isBlank()
                    ? rec.getDescription() : rec.getSource();
            concrete.setDescription(baseDesc + " (Auto)");
            concrete.setIncomeDate(rec.getNextDueDate());
            concrete.setUser(rec.getUser());
            concrete.setIsRecurring(false);
            // Same kind as the template; the month is left to follow each generated date.
            concrete.setKind(rec.getKind());
            incomeRepository.save(concrete);

            LocalDate nextDate = nextOccurrence(rec);
            if (!nextDate.isAfter(rec.getNextDueDate())) {
                log.warn("Recurring income {} next date {} is not after current due date {}",
                        rec.getId(), nextDate, rec.getNextDueDate());
                rec.setNextDueDate(rec.getNextDueDate().plusMonths(1));
            } else {
                rec.setNextDueDate(nextDate);
            }
            created++;
        }
        incomeRepository.save(rec);
        return created;
    }

    /**
     * Catches up on any missed recurring incomes when the application starts up.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        log.info("Application ready: running startup check for missed recurring incomes...");
        processRecurringIncomes();
    }

    private LocalDate nextOccurrence(Income rec) {
        return com.example.expensetracker.common.RecurrenceFrequency
                .fromString(rec.getFrequency())
                .nextOccurrence(rec.getNextDueDate(), rec.getIntervalDays());
    }
}
