package com.example.expensetracker.domain.goal.service;

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

import com.example.expensetracker.domain.expense.service.RecurringExpenseScheduler;
import com.example.expensetracker.domain.goal.model.SavingsGoal;
import com.example.expensetracker.domain.goal.repository.SavingsGoalRepository;



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
@SuppressWarnings("java:S6809")
public class RecurringSavingsScheduler {

    private final SavingsGoalRepository savingsGoalRepository;

    /** Each record is committed on its own, so one bad row cannot roll back everyone else's occurrences. */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private org.springframework.transaction.support.TransactionTemplate transactionTemplate;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private org.springframework.cache.CacheManager cacheManager;

    /** Calendar zone that decides what "today" is; blank means the server's zone. */
    @org.springframework.beans.factory.annotation.Value("${app.notifications.zone:}")
    private String zone = "";

    private LocalDate today() {
        return zone == null || zone.isBlank() ? LocalDate.now() : LocalDate.now(java.time.ZoneId.of(zone));
    }

    /** These services write straight to the repositories, so the cached per-user lists must be dropped by hand. */
    private void evictCache(String cacheName, Long userId) {
        if (cacheManager == null || userId == null) {
            return;
        }
        org.springframework.cache.Cache cache = cacheManager.getCache(cacheName);
        if (cache != null) {
            cache.evict(userId);
        }
    }

    /**
     * Processes all recurring savings goals whose installment is due on or before today.
     */
    @Scheduled(cron = "0 0 0 * * *", zone = "${app.notifications.zone:Asia/Kolkata}")
    public void processRecurringSavings() {
        log.info("Processing due recurring savings goals (chits, recurring deposits, SIPs)...");
        List<SavingsGoal> dueGoals =
                savingsGoalRepository.findByIsRecurringTrueAndNextDueDateLessThanEqual(today());

        int processedCount = 0;
        int failedCount = 0;
        for (SavingsGoal goal : dueGoals) {
            if (goal == null || goal.getNextDueDate() == null) {
                continue;
            }
            try {
                processedCount += processInOwnTransaction(goal);
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

    private int processInOwnTransaction(SavingsGoal listed) {
        if (transactionTemplate == null) {
            return processInstallments(listed);
        }
        Integer deposited = transactionTemplate.execute(status ->
                savingsGoalRepository.findById(listed.getId()).map(this::processInstallments).orElse(0));
        return deposited == null ? 0 : deposited;
    }

    /**
     * Applies every missed installment of one goal. A completed goal or one past its end date stops recurring
     * instead of depositing forever, and a paused goal skips its installments rather than banking them for later.
     */
    private int processInstallments(SavingsGoal goal) {
        int deposited = 0;
        while (goal.getNextDueDate() != null && !goal.getNextDueDate().isAfter(today())) {
            if (goal.getEndDate() != null && goal.getNextDueDate().isAfter(goal.getEndDate())) {
                goal.setIsRecurring(false);
                log.info("Recurring savings goal id={} passed its end date {}; recurring plan stopped",
                        goal.getId(), goal.getEndDate());
                break;
            }
            if ("COMPLETED".equals(goal.getStatus())) {
                goal.setIsRecurring(false);
                log.info("Recurring savings goal id={} is already COMPLETED; recurring plan stopped", goal.getId());
                break;
            }

            BigDecimal installment = goal.getRecurringAmount() != null
                    ? goal.getRecurringAmount()
                    : BigDecimal.ZERO;

            if (!"PAUSED".equals(goal.getStatus()) && installment.compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal current = goal.getCurrentAmount() != null
                        ? goal.getCurrentAmount() : BigDecimal.ZERO;
                BigDecimal updated = current.add(installment);
                goal.setCurrentAmount(updated);
                deposited++;

                if (goal.getTargetAmount() != null
                        && updated.compareTo(goal.getTargetAmount()) >= 0) {
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
        }
        savingsGoalRepository.save(goal);
        return deposited;
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
        return com.example.expensetracker.common.RecurrenceFrequency
                .fromString(goal.getFrequency())
                .nextOccurrence(goal.getNextDueDate(), goal.getIntervalDays());
    }
}
