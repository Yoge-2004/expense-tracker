package com.example.expensetracker.service;

import com.example.expensetracker.model.Income;
import com.example.expensetracker.repository.IncomeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

/**
 * Scheduled service that automatically generates concrete income records for due
 * recurring income streams (daily wages, weekly paychecks, monthly salaries, etc.).
 *
 * @author Yogeshwaran
 * @version 1.0
 */
@Service
public class RecurringIncomeScheduler {

    private static final Logger log = LoggerFactory.getLogger(RecurringIncomeScheduler.class);

    private final IncomeRepository incomeRepository;

    public RecurringIncomeScheduler(IncomeRepository incomeRepository) {
        this.incomeRepository = incomeRepository;
    }

    /**
     * Processes all recurring income streams that are due on or before today.
     */
    @Scheduled(cron = "0 0 0 * * *")
    public void processRecurringIncomes() {
        log.info("Processing due recurring incomes...");
        List<Income> dueIncomes =
                incomeRepository.findByIsRecurringTrueAndNextDueDateLessThanEqual(LocalDate.now());

        int processedCount = 0;
        for (Income rec : dueIncomes) {
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
                incomeRepository.save(concrete);

                rec.setNextDueDate(nextOccurrence(rec));
                processedCount++;
            }
            incomeRepository.save(rec);
        }
        log.info("Finished processing recurring incomes. Processed {} occurrences.", processedCount);
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        try {
            log.info("Application is ready. Checking for any missed recurring incomes...");
            processRecurringIncomes();
        } catch (Exception e) {
            log.error("Error checking missed recurring incomes on startup: {}, continuing application boot.", e.getMessage(), e);
        }
    }

    public static LocalDate nextOccurrence(Income income) {
        LocalDate base = income.getNextDueDate() != null ? income.getNextDueDate() : income.getIncomeDate();
        if (base == null) base = LocalDate.now();
        String freq = income.getFrequency() != null ? income.getFrequency().toUpperCase() : "MONTHLY";
        Integer interval = income.getIntervalDays() != null && income.getIntervalDays() > 0 ? income.getIntervalDays() : 1;
        return switch (freq) {
            case "DAILY" -> base.plusDays(1);
            case "WEEKLY" -> base.plusWeeks(1);
            case "YEARLY" -> base.plusYears(1);
            case "CUSTOM" -> base.plusDays(interval);
            default -> base.plusMonths(1);
        };
    }
}
