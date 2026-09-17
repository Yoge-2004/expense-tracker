package com.example.expensetracker.service;

import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.RecurringExpense;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.RecurringExpenseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

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
@RequiredArgsConstructor
public class RecurringExpenseScheduler {

    private final RecurringExpenseRepository recurringExpenseRepository;
    private final ExpenseRepository expenseRepository;

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
    @Transactional
    @Scheduled(cron = "0 0 0 * * *")
    public void processRecurringExpenses() {
        log.info("Processing due recurring expenses...");
        List<RecurringExpense> dueExpenses =
                recurringExpenseRepository.findByNextDueDateLessThanEqual(LocalDate.now());

        int processedCount = 0;
        int failedCount = 0;
        for (RecurringExpense rec : dueExpenses) {
            try {
                // Catch up every missed occurrence and preserve its actual due date.
                while (!rec.getNextDueDate().isAfter(LocalDate.now())) {
                    Expense expense = new Expense();
                    expense.setAmount(rec.getAmount());
                    expense.setDescription(rec.getDescription() + " (Auto)");
                    expense.setExpenseDate(rec.getNextDueDate());
                    expense.setUser(rec.getUser());
                    expense.setCategory(rec.getCategory());
                    expenseRepository.save(expense);
                    rec.setNextDueDate(nextOccurrence(rec));
                    processedCount++;
                }
                recurringExpenseRepository.save(rec);
            } catch (Exception itemEx) {
                failedCount++;
                log.error("CRITICAL: Failed to process recurring expense subscription id={} for userId={}: {}",
                        rec.getId(), rec.getUser() != null ? rec.getUser().getId() : "null", itemEx.getMessage(), itemEx);
            }
        }
        log.info("Finished processing recurring expenses. Processed {} occurrences, {} failures.", processedCount, failedCount);
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
        String freq = rec.getFrequency();
        if (freq == null || freq.isBlank()) freq = "MONTHLY";
        return switch (freq.toUpperCase()) {
            case "DAILY"   -> rec.getNextDueDate().plusDays(1);
            case "WEEKLY"  -> rec.getNextDueDate().plusWeeks(1);
            case "YEARLY"  -> rec.getNextDueDate().plusYears(1);
            case "CUSTOM"  -> {
                int days = rec.getIntervalDays() != null && rec.getIntervalDays() > 0 ? rec.getIntervalDays() : 30;
                yield rec.getNextDueDate().plusDays(days);
            }
            default        -> rec.getNextDueDate().plusMonths(1);
        };
    }
}
