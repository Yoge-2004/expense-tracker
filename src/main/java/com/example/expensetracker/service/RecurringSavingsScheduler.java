package com.example.expensetracker.service;

import com.example.expensetracker.model.SavingsGoal;
import com.example.expensetracker.repository.SavingsGoalRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Scheduled background service that processes recurring savings goals
 * (e.g. monthly chit funds, SIPs, RD auto-deposits).
 *
 * <p>Operates similarly to {@link RecurringExpenseScheduler}: runs daily at midnight,
 * queries all recurring {@link SavingsGoal} records with {@code nextDueDate <= today},
 * applies recurring installments to current savings, and steps {@code nextDueDate} forward.</p>
 *
 * @author Yogeshwaran
 * @version 1.0
 * @see SavingsGoal
 */
@Slf4j
@Component
@RequiredArgsConstructor
@Transactional
@SuppressWarnings("java:S6809")
public class RecurringSavingsScheduler {

    private final SavingsGoalRepository savingsGoalRepository;

    /**
     * Processes all recurring savings goals whose installment is due on or before today.
     */
    @Transactional
    @Scheduled(cron = "0 0 0 * * *")
    public void processRecurringSavings() {
        log.info("Processing due recurring savings goals (chits, recurring deposits, SIPs)...");
        List<SavingsGoal> dueGoals =
                savingsGoalRepository.findByIsRecurringTrueAndNextDueDateLessThanEqual(LocalDate.now());

        int processedCount = 0;
        int failedCount = 0;
        for (SavingsGoal goal : dueGoals) {
            try {
                if (goal == null || goal.getNextDueDate() == null) {
                    continue;
                }
                while (goal.getNextDueDate() != null && !goal.getNextDueDate().isAfter(LocalDate.now())) {
                    BigDecimal installment = goal.getRecurringAmount() != null
                            ? goal.getRecurringAmount()
                            : BigDecimal.ZERO;

                    if (installment.compareTo(BigDecimal.ZERO) > 0) {
                        BigDecimal current = goal.getCurrentAmount() != null
                            ? goal.getCurrentAmount() : BigDecimal.ZERO;
                        BigDecimal updated = current.add(installment);
                        goal.setCurrentAmount(updated);

                        if (goal.getTargetAmount() != null
                                && updated.compareTo(goal.getTargetAmount()) >= 0
                                && !"COMPLETED".equals(goal.getStatus())) {
                            goal.setStatus("COMPLETED");
                            log.info("Recurring savings goal id={} reached target ({}) and auto-marked COMPLETED",
                                    goal.getId(), goal.getTargetAmount());
                        }
                    }

                    LocalDate nextDate = nextOccurrence(goal);
                    if (!nextDate.isAfter(goal.getNextDueDate())) {
                        log.warn("Recurring savings goal {} next date {} is not after current due date {}",
                                goal.getId(), nextDate, goal.getNextDueDate());
                        goal.setNextDueDate(goal.getNextDueDate().plusMonths(1));
                    } else {
                        goal.setNextDueDate(nextDate);
                    }
                    processedCount++;
                }
                savingsGoalRepository.save(goal);
            } catch (Exception itemEx) {
                failedCount++;
                log.error("CRITICAL: Failed to process recurring savings installment for goal id={} userId={}: {}",
                        goal.getId(), goal.getUser() != null ? goal.getUser().getId() : "null",
                                itemEx.getMessage(), itemEx);
            }
        }
        log.info("Finished processing recurring savings goals. Processed {} installments, {} failures.",
                processedCount, failedCount);
    }

    /**
     * Catches up on any missed recurring savings installments when the application starts up.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        log.info("Application ready: running startup check for missed recurring savings installments...");
        processRecurringSavings();
    }

    private LocalDate nextOccurrence(SavingsGoal goal) {
        String freq = goal.getFrequency();
        if (freq == null || freq.isBlank()) freq = "MONTHLY";
        return switch (freq.toUpperCase()) {
            case "DAILY"   -> goal.getNextDueDate().plusDays(1);
            case "WEEKLY"  -> goal.getNextDueDate().plusWeeks(1);
            case "YEARLY"  -> goal.getNextDueDate().plusYears(1);
            case "CUSTOM"  -> {
                int days = goal.getIntervalDays() != null && goal.getIntervalDays() > 0 ? goal.getIntervalDays() : 30;
                yield goal.getNextDueDate().plusDays(days);
            }
            default        -> goal.getNextDueDate().plusMonths(1);
        };
    }
}
