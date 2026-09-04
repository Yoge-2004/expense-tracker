package com.example.expensetracker.service;

import com.example.expensetracker.model.SavingsGoal;
import com.example.expensetracker.repository.SavingsGoalRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Scheduled service that automatically processes recurring savings deposits,
 * chit fund contributions, and recurring deposits (RD/SIP) when due.
 *
 * @author Yogeshwaran
 * @version 1.0
 */
@Service
public class RecurringSavingsScheduler {

    private static final Logger log = LoggerFactory.getLogger(RecurringSavingsScheduler.class);

    private final SavingsGoalRepository savingsGoalRepository;

    public RecurringSavingsScheduler(SavingsGoalRepository savingsGoalRepository) {
        this.savingsGoalRepository = savingsGoalRepository;
    }

    /**
     * Processes all recurring savings goals whose installment is due on or before today.
     */
    @Scheduled(cron = "0 0 0 * * *")
    public void processRecurringSavings() {
        log.info("Processing due recurring savings goals (chits, recurring deposits, SIPs)...");
        List<SavingsGoal> dueGoals =
                savingsGoalRepository.findByIsRecurringTrueAndNextDueDateLessThanEqual(LocalDate.now());

        int processedCount = 0;
        for (SavingsGoal goal : dueGoals) {
            while (goal.getNextDueDate() != null && !goal.getNextDueDate().isAfter(LocalDate.now())) {
                BigDecimal installment = goal.getRecurringAmount() != null
                        ? goal.getRecurringAmount()
                        : BigDecimal.ZERO;

                if (installment.compareTo(BigDecimal.ZERO) > 0) {
                    BigDecimal current = goal.getCurrentAmount() != null ? goal.getCurrentAmount() : BigDecimal.ZERO;
                    BigDecimal updated = current.add(installment);
                    goal.setCurrentAmount(updated);

                    if (goal.getTargetAmount() != null && updated.compareTo(goal.getTargetAmount()) >= 0) {
                        goal.setStatus("COMPLETED");
                    }
                }

                LocalDate next = nextOccurrence(goal);
                if (goal.getEndDate() != null && next.isAfter(goal.getEndDate())) {
                    goal.setIsRecurring(false);
                    goal.setNextDueDate(null);
                    break;
                } else {
                    goal.setNextDueDate(next);
                }
                processedCount++;
            }
            savingsGoalRepository.save(goal);
        }
        log.info("Finished processing recurring savings goals. Processed {} installments.", processedCount);
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        try {
            log.info("Application ready. Checking for any missed recurring savings installments...");
            processRecurringSavings();
        } catch (Exception e) {
            log.error("Error checking missed recurring savings on startup: {}, continuing boot.", e.getMessage(), e);
        }
    }

    /**
     * Calculates the next due date based on frequency.
     *
     * @param goal savings goal
     * @return next occurrence date
     */
    public static LocalDate nextOccurrence(SavingsGoal goal) {
        LocalDate base = goal.getNextDueDate() != null ? goal.getNextDueDate() : LocalDate.now();
        String freq = goal.getFrequency() != null ? goal.getFrequency().toUpperCase() : "MONTHLY";
        Integer interval = goal.getIntervalDays() != null && goal.getIntervalDays() > 0 ? goal.getIntervalDays() : 1;

        return switch (freq) {
            case "DAILY" -> base.plusDays(1);
            case "WEEKLY" -> base.plusWeeks(1);
            case "BI_WEEKLY", "BIWEEKLY" -> base.plusWeeks(2);
            case "YEARLY" -> base.plusYears(1);
            case "CUSTOM" -> base.plusDays(interval);
            default -> base.plusMonths(1);
        };
    }
}
