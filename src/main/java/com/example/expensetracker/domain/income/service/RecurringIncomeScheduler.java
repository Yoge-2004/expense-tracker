package com.example.expensetracker.domain.income.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.List;

import com.example.expensetracker.domain.expense.service.RecurringExpenseScheduler;
import com.example.expensetracker.domain.income.model.Income;
import com.example.expensetracker.domain.income.repository.IncomeRepository;



/**
 * Scheduled background service that processes recurring income streams
 * (salary, dividends, rental income, freelance retainers).
 *
 * <p>Operates identically to {@link RecurringExpenseScheduler}: runs daily at midnight,
 * queries all recurring {@link Income} records with {@code nextDueDate <= today},
 * generates concrete {@link Income} entries, and steps {@code nextDueDate} forward.</p>
 *
 * @author Yogeshwaran
 * @version 1.0
 * @see Income
 */
@Slf4j
@Component
@RequiredArgsConstructor
@Transactional
@SuppressWarnings("java:S6809")
public class RecurringIncomeScheduler {

    private final IncomeRepository incomeRepository;

    /**
     * Processes all recurring income streams that are due on or before today.
     */
    @Transactional
    @Scheduled(cron = "0 0 0 * * *")
    public void processRecurringIncomes() {
        log.info("Processing due recurring incomes...");
        List<Income> dueIncomes =
                incomeRepository.findByIsRecurringTrueAndNextDueDateLessThanEqual(LocalDate.now());

        int processedCount = 0;
        int failedCount = 0;
        for (Income rec : dueIncomes) {
            try {
                if (rec == null || rec.getNextDueDate() == null) {
                    continue;
                }
                while (rec.getNextDueDate() != null && !rec.getNextDueDate().isAfter(LocalDate.now())) {
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
                    processedCount++;
                }
                incomeRepository.save(rec);
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
