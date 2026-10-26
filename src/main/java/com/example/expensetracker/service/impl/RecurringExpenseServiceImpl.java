package com.example.expensetracker.service.impl;

import com.example.expensetracker.dto.ExpenseDto;
import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.RecurringExpense;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.CategoryRepository;
import com.example.expensetracker.repository.RecurringExpenseRepository;
import com.example.expensetracker.security.UserSecurity;
import com.example.expensetracker.service.ExpenseService;
import com.example.expensetracker.service.RecurringExpenseService;
import com.example.expensetracker.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

/**
 * Concrete implementation of {@link RecurringExpenseService}.
 *
 * @author Yogeshwaran
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RecurringExpenseServiceImpl implements RecurringExpenseService {

    private final RecurringExpenseRepository recurringRepository;
    private final CategoryRepository categoryRepository;
    private final ExpenseService expenseService;
    private final UserService userService;
    private final UserSecurity userSecurity;

    @Override
    @Transactional
    public void createRecurringExpense(Long userId, ExpenseDto dto) {
        userSecurity.validateUserAccess(userId);
        log.info("Received request to setup recurring expense for userId={}: amount={}, frequency={}, intervalDays={}, categoryId={}",
                userId, dto.amount(), dto.frequency(), dto.intervalDays(), dto.categoryId());

        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Category category = categoryRepository.findById(dto.categoryId())
                .orElseThrow(() -> new IllegalArgumentException("Category not found"));

        RecurringExpense rec = new RecurringExpense();
        rec.setAmount(dto.amount());
        rec.setDescription(dto.description());
        String frequency = normalizeFrequency(dto.frequency());
        Integer intervalDays = "CUSTOM".equals(frequency) ? dto.intervalDays() : null;
        if ("CUSTOM".equals(frequency) && (intervalDays == null || intervalDays < 1)) {
            log.warn("Invalid intervalDays={} for custom recurring expense userId={}", intervalDays, userId);
            throw new IllegalArgumentException("Custom frequency requires a positive interval in days");
        }

        rec.setFrequency(frequency);
        rec.setIntervalDays(intervalDays);
        rec.setNextDueDate(nextOccurrence(dto.expenseDate(), frequency, intervalDays));
        rec.setCategory(category);
        rec.setUser(user);
        recurringRepository.save(rec);

        Expense firstExp = new Expense();
        firstExp.setAmount(dto.amount());
        firstExp.setDescription(dto.description());
        firstExp.setExpenseDate(dto.expenseDate());
        firstExp.setCategory(category);
        firstExp.setRecurring(true);
        expenseService.createExpense(firstExp, user);

        log.info("Recurring expense setup successfully with id={} for userId={}", rec.getId(), userId);
    }

    @Override
    public List<Map<String, Object>> getUserSubscriptions(Long userId) {
        userSecurity.validateUserAccess(userId);
        log.debug("Fetching recurring subscriptions for userId={}", userId);
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        List<RecurringExpense> subs = recurringRepository.findByUser(user);
        List<Map<String, Object>> response = subs.stream().map(sub -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id",          sub.getId());
            map.put("description", sub.getDescription());
            map.put("amount",      sub.getAmount());
            map.put("nextDueDate", sub.getNextDueDate());
            map.put("frequency",   sub.getFrequency());
            map.put("intervalDays", sub.getIntervalDays());
            map.put("categoryId", sub.getCategory() != null ? sub.getCategory().getId() : null);
            map.put("categoryName", sub.getCategory() != null ? sub.getCategory().getName() : "Uncategorized");
            return map;
        }).toList();

        log.info("Retrieved {} recurring subscriptions for userId={}", response.size(), userId);
        return response;
    }

    @Override
    @Transactional
    public void updateSubscription(Long recId, Map<String, Object> updates) {
        log.info("Received request to update subscription id={}: fields={}", recId, updates.keySet());
        RecurringExpense rec = recurringRepository.findById(recId)
                .orElseThrow(() -> new IllegalArgumentException("Subscription not found"));
        userSecurity.validateUserAccess(rec.getUser().getId());

        try {
            if (updates.containsKey("amount") && updates.get("amount") != null) {
                rec.setAmount(new BigDecimal(String.valueOf(updates.get("amount"))));
            }
            if (updates.containsKey("description") && updates.get("description") != null) {
                rec.setDescription(String.valueOf(updates.get("description")));
            }
            if (updates.containsKey("nextDueDate") && updates.get("nextDueDate") != null) {
                rec.setNextDueDate(LocalDate.parse(String.valueOf(updates.get("nextDueDate"))));
            }
            if (updates.containsKey("categoryId") || updates.containsKey("category")) {
                Object catVal = updates.containsKey("categoryId") ? updates.get("categoryId") : updates.get("category");
                if (catVal == null || "".equals(catVal)) {
                    rec.setCategory(null);
                } else {
                    Long catId = Long.valueOf(String.valueOf(catVal));
                    Category category = categoryRepository.findById(catId)
                            .orElseThrow(() -> new IllegalArgumentException("Category not found"));
                    if (category.getUser() != null && !category.getUser().getId().equals(rec.getUser().getId())) {
                        throw new IllegalArgumentException("Category does not belong to this user");
                    }
                    rec.setCategory(category);
                }
            }
            if (updates.containsKey("frequency")) {
                String frequency = normalizeFrequency((String) updates.get("frequency"));
                Integer intervalDays = "CUSTOM".equals(frequency)
                        ? numberValue(updates.get("intervalDays")) : null;
                if ("CUSTOM".equals(frequency) && (intervalDays == null || intervalDays < 1)) {
                    log.warn("Invalid intervalDays for custom frequency on subscription id={}", recId);
                    throw new IllegalArgumentException("Custom frequency requires a positive interval in days");
                }
                rec.setFrequency(frequency);
                rec.setIntervalDays(intervalDays);
            } else if (updates.containsKey("intervalDays") && "CUSTOM".equals(rec.getFrequency())) {
                Integer intervalDays = numberValue(updates.get("intervalDays"));
                if (intervalDays == null || intervalDays < 1) {
                    log.warn("Invalid intervalDays for custom frequency on subscription id={}", recId);
                    throw new IllegalArgumentException("Custom frequency requires a positive interval in days");
                }
                rec.setIntervalDays(intervalDays);
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (RuntimeException e) {
            log.warn("Invalid field value while updating subscription id={}: {}", recId, e.getMessage());
            throw new IllegalArgumentException("Invalid field value: " + e.getMessage(), e);
        }

        recurringRepository.save(rec);
        log.info("Subscription id={} updated successfully", recId);
    }

    @Override
    @Transactional
    public void deleteSubscription(Long recId) {
        log.info("Received request to cancel recurring subscription id={}", recId);
        RecurringExpense rec = recurringRepository.findById(recId)
                .orElseThrow(() -> new IllegalArgumentException("Subscription not found"));
        userSecurity.validateUserAccess(rec.getUser().getId());
        recurringRepository.delete(rec);
        log.info("Subscription id={} cancelled successfully", recId);
    }

    private String normalizeFrequency(String frequency) {
        String value = frequency == null || frequency.isBlank() ? "MONTHLY" : frequency.trim().toUpperCase(Locale.ROOT);
        if (!List.of("DAILY", "WEEKLY", "MONTHLY", "YEARLY", "CUSTOM").contains(value)) {
            throw new IllegalArgumentException("Frequency must be DAILY, WEEKLY, MONTHLY, YEARLY, or CUSTOM");
        }
        return value;
    }

    private Integer numberValue(Object value) {
        return value == null ? null : Integer.valueOf(value.toString());
    }

    private LocalDate nextOccurrence(LocalDate date, String frequency, Integer intervalDays) {
        return switch (frequency) {
            case "DAILY" -> date.plusDays(1);
            case "WEEKLY" -> date.plusWeeks(1);
            case "YEARLY" -> date.plusYears(1);
            case "CUSTOM" -> date.plusDays(intervalDays);
            default -> date.plusMonths(1);
        };
    }
}
