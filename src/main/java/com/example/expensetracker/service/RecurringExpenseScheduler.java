package com.example.expensetracker.service;

import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.RecurringExpense;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.RecurringExpenseRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

/**
 * Scheduled service that automatically generates expense records for due
 * recurring (subscription-style) expenses.
 *
 * <p>This service runs daily at midnight using a cron expression and scans all
 * {@link RecurringExpense} records whose {@code nextDueDate} is on or before today.
 * For each due record it:</p>
 * <ol>
 *   <li>Creates a new {@link Expense} record with a description suffixed by {@code " (Auto)"}.</li>
 *   <li>Persists the new expense to the database.</li>
 *   <li>Advances the {@code nextDueDate} on the {@link RecurringExpense} by one month.</li>
 * </ol>
 *
 * <p>Scheduling is enabled at the application level by the
 * {@code @EnableScheduling} annotation on
 * {@link com.example.expensetracker.ExpenseTrackerSystemApplication}.</p>
 *
 * @author Yogeshwaran
 * @version 1.0
 * @see RecurringExpense
 * @see RecurringExpenseRepository
 * @see ExpenseRepository
 */
@Service
public class RecurringExpenseScheduler {

    private static final Logger log = LoggerFactory.getLogger(RecurringExpenseScheduler.class);

    /** Repository for querying recurring expense records that are due. */
    private final RecurringExpenseRepository recurringExpenseRepository;

    /** Repository for persisting auto-generated expense records. */
    private final ExpenseRepository expenseRepository;

    /**
     * Constructs a {@code RecurringExpenseScheduler} with the required repositories.
     *
     * @param recurringExpenseRepository repository for reading and updating recurring expenses
     * @param expenseRepository          repository for saving auto-generated expense entries
     */
    public RecurringExpenseScheduler(RecurringExpenseRepository recurringExpenseRepository,
                                     ExpenseRepository expenseRepository) {
        this.recurringExpenseRepository = recurringExpenseRepository;
        this.expenseRepository = expenseRepository;
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
    @Scheduled(cron = "0 0 0 * * *")
    public void processRecurringExpenses() {
        log.info("Processing due recurring expenses...");
        List<RecurringExpense> dueExpenses =
                recurringExpenseRepository.findByNextDueDateLessThanEqual(LocalDate.now());

        int processedCount = 0;
        for (RecurringExpense rec : dueExpenses) {
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
        }
        log.info("Finished processing recurring expenses. Processed {} occurrences.", processedCount);
    }

    /**
     * Catches up on any missed recurring expenses when the application starts up.
     *
     * <p>This ensures that if the server was sleeping or offline at midnight when the
     * cron job was scheduled to run, any due expenses will be processed as soon as
     * the application boots up.</p>
     */
    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        try {
            log.info("Application is ready. Checking for any missed recurring expenses...");
            processRecurringExpenses();
        } catch (Exception e) {
            log.error("Error checking missed recurring expenses on startup: {}, continuing application boot.", e.getMessage(), e);
        }
    }

    private LocalDate nextOccurrence(RecurringExpense recurringExpense) {
        return switch (recurringExpense.getFrequency()) {
            case "DAILY" -> recurringExpense.getNextDueDate().plusDays(1);
            case "WEEKLY" -> recurringExpense.getNextDueDate().plusWeeks(1);
            case "YEARLY" -> recurringExpense.getNextDueDate().plusYears(1);
            case "CUSTOM" -> recurringExpense.getNextDueDate().plusDays(recurringExpense.getIntervalDays());
            default -> recurringExpense.getNextDueDate().plusMonths(1);
        };
    }
}
