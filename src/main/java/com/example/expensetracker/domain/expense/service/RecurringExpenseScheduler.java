package com.example.expensetracker.domain.expense.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

import com.example.expensetracker.domain.expense.model.Expense;
import com.example.expensetracker.domain.expense.model.RecurringExpense;
import com.example.expensetracker.domain.expense.repository.ExpenseRepository;
import com.example.expensetracker.domain.expense.repository.RecurringExpenseRepository;

/**
 * Scheduled background service that processes recurring expense subscriptions
 * (e.g. Netflix, Spotify, gym memberships).
 *
 * <p><b>How it works:</b></p>
 * <ol>
 *   <li>The cron job runs every night at midnight (00:00).</li>
 *   <li>It queries the database for all {@link RecurringExpense} records where
 *       {@code nextDueDate <= today}.</li>
 *   <li>For each matching record, it creates a real {@link Expense} entry
 *       with the subscription's amount, category, and user, tagging the description
 *       with {@code " (Auto)"} to indicate it was generated automatically.</li>
 *   <li>It then advances the {@code nextDueDate} by one calendar month
 *       (or configured interval) and saves the updated recurring rule.</li>
 * </ol>
 *
 * <p><b>Catch-up on startup:</b> If the application was shut down when midnight
 * arrived, the {@link #onApplicationReady()} method executes the same check
 * immediately on boot so no recurring expenses are dropped.</p>
 *
 * @author Yogeshwaran
 * @version 1.0
 * @see RecurringExpense
 * @see Expense
 */
@Slf4j
@Component
@SuppressWarnings("java:S6809")
public class RecurringExpenseScheduler {

    private final RecurringExpenseRepository recurringExpenseRepository;
    private final ExpenseRepository expenseRepository;

    /** Each record is committed on its own, so one bad row cannot roll back everyone else's occurrences. */
    private final TransactionTemplate transactionTemplate;
    private final Clock clock;

    /** Calendar zone that decides what "today" is; blank means the server's zone. */
    @Value("${app.notifications.zone:}")
    private String zone = "";

    @Autowired
    public RecurringExpenseScheduler(
            RecurringExpenseRepository recurringExpenseRepository,
            ExpenseRepository expenseRepository,
            @Autowired(required = false) TransactionTemplate transactionTemplate,
            @Autowired(required = false) Clock clock) {
        this.recurringExpenseRepository = recurringExpenseRepository;
        this.expenseRepository = expenseRepository;
        this.transactionTemplate = transactionTemplate;
        this.clock = clock != null ? clock : Clock.systemDefaultZone();
    }

    private LocalDate today() {
        return zone == null || zone.isBlank()
                ? LocalDate.now(clock)
                : LocalDate.now(clock.withZone(ZoneId.of(zone)));
    }

    /**
     * Processes all recurring expenses that are due on or before today.
     *
     * <p>This method is triggered automatically every day at midnight (00:00)
     * by the Spring scheduling framework. For each due {@link RecurringExpense},
     * it creates a corresponding {@link Expense} record and updates the
     * {@code nextDueDate} forward by one month so the subscription self-renews.</p>
     *
     * <p>The auto-generated expense description is formatted as:
     * {@code "<original description> (Auto)"}.</p>
     *
     * <p>Cron expression: {@code "0 0 0 * * *"} — runs at 00:00:00 every day.</p>
     */
    @Scheduled(cron = "0 0 0 * * *", zone = "${app.notifications.zone:Asia/Kolkata}")
    public void processRecurringExpenses() {
        log.info("Processing due recurring expenses...");
        List<RecurringExpense> dueExpenses =
                recurringExpenseRepository.findByNextDueDateLessThanEqual(today());

        int processedCount = 0;
        int failedCount = 0;
        for (RecurringExpense rec : dueExpenses) {
            if (rec == null || rec.getNextDueDate() == null) {
                continue;
            }
            try {
                processedCount += processInOwnTransaction(rec);
            } catch (Exception itemEx) {
                failedCount++;
                log.error("CRITICAL: Failed to process recurring expense subscription id={} for userId={}: {}",
                        rec.getId(), rec.getUser() != null ? rec.getUser().getId() : "null",
                        itemEx.getMessage(), itemEx);
            }
        }
        log.info("Finished processing recurring expenses. Processed {} occurrences, {} failures.",
                processedCount, failedCount);
    }

    private int processInOwnTransaction(RecurringExpense listed) {
        if (transactionTemplate == null) {
            return processOccurrences(listed);
        }
        Integer created = transactionTemplate.execute(status ->
                recurringExpenseRepository.findById(listed.getId()).map(this::processOccurrences).orElse(0));
        return created == null ? 0 : created;
    }

    /** Creates every missed occurrence of one subscription, keeping each occurrence's real due date. */
    private int processOccurrences(RecurringExpense rec) {
        int created = 0;
        while (rec.getNextDueDate() != null && !rec.getNextDueDate().isAfter(today())) {
            Expense expense = new Expense();
            expense.setAmount(rec.getAmount());
            expense.setDescription(rec.getDescription() + " (Auto)");
            expense.setExpenseDate(rec.getNextDueDate());
            expense.setUser(rec.getUser());
            expense.setCategory(rec.getCategory());
            // Reports total recurring spend from this flag; auto-billed occurrences were being left out.
            expense.setRecurring(true);
            expenseRepository.save(expense);
            LocalDate nextDate = nextOccurrence(rec);
            if (!nextDate.isAfter(rec.getNextDueDate())) {
                log.warn("Recurring expense {} next date {} is not after current due date {}",
                        rec.getId(), nextDate, rec.getNextDueDate());
                rec.setNextDueDate(rec.getNextDueDate().plusMonths(1));
            } else {
                rec.setNextDueDate(nextDate);
            }
            created++;
        }
        recurringExpenseRepository.save(rec);
        return created;
    }

    /**
     * Catches up on any missed recurring expenses when the application starts up.
     *
     * <p>This ensures that if the server was sleeping or offline at midnight when the
     * scheduled job was due, pending subscriptions are still processed as soon
     * as the application boots.</p>
     */
    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        log.info("Application ready: running startup check for missed recurring expenses...");
        processRecurringExpenses();
    }

    /**
     * Advances the due date of a recurring expense to its next occurrence based on frequency.
     */
    private LocalDate nextOccurrence(RecurringExpense rec) {
        return com.example.expensetracker.common.RecurrenceFrequency
                .fromString(rec.getFrequency())
                .nextOccurrence(rec.getNextDueDate(), rec.getIntervalDays());
    }
}
