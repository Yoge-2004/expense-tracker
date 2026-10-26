package com.example.expensetracker.service.impl;

import com.example.expensetracker.dto.BudgetDto;
import com.example.expensetracker.dto.BudgetStatusDto;
import com.example.expensetracker.mapper.IncomeRules;
import com.example.expensetracker.model.*;
import com.example.expensetracker.repository.BudgetRepository;
import com.example.expensetracker.repository.CategoryRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.IncomeRepository;
import com.example.expensetracker.security.UserSecurity;
import com.example.expensetracker.service.BudgetService;
import com.example.expensetracker.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

/**
 * Implementation of {@link BudgetService} containing budget calculation and lifecycle logic.
 *
 * @author Yogeshwaran
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BudgetServiceImpl implements BudgetService {

    private final BudgetRepository budgetRepository;
    private final CategoryRepository categoryRepository;
    private final ExpenseRepository expenseRepository;
    private final IncomeRepository incomeRepository;
    private final UserService userService;
    private final UserSecurity userSecurity;

    @Override
    @Transactional
    public void setBudget(Long userId, BudgetDto dto) {
        userSecurity.validateUserAccess(userId);
        log.info("Setting budget for userId={}, categoryId={}: limitAmount={}, period={}",
                userId, dto.categoryId(), dto.limitAmount(), dto.period());

        if (dto.limitAmount() == null || dto.limitAmount().compareTo(BigDecimal.ZERO) <= 0) {
            log.warn("Rejected budget for userId={}: limitAmount must be greater than zero", userId);
            throw new IllegalArgumentException("Budget limit must be a positive number");
        }

        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Category category = categoryRepository.findById(dto.categoryId())
                .orElseThrow(() -> new IllegalArgumentException("Category not found"));

        if (category.getUser() != null && !category.getUser().getId().equals(user.getId())) {
            log.warn("IDOR attempt: user {} tried to set budget against foreign category {}", userId, dto.categoryId());
            throw new AccessDeniedException("Category does not belong to this user");
        }

        Budget budget = budgetRepository.findByUserAndCategoryId(user, dto.categoryId())
                .orElse(new Budget());
        budget.setUser(user);
        budget.setCategory(category);
        budget.setLimitAmount(dto.limitAmount());
        budget.setPeriod(dto.period() != null ? dto.period() : "MONTHLY");
        budget.setIntervalDays("CUSTOM".equalsIgnoreCase(budget.getPeriod()) ? dto.intervalDays() : null);
        budget.setStartDate(dto.startDate());
        budget.setEndDate(dto.endDate());

        budgetRepository.save(budget);
        log.info("Budget saved successfully for userId={}, categoryId={}", userId, dto.categoryId());
    }

    @Override
    @Transactional
    public void deleteBudgetById(Long budgetId) {
        log.info("Deleting budget by budgetId={}", budgetId);
        Budget budget = budgetRepository.findById(budgetId)
                .orElseThrow(() -> new NoSuchElementException("Budget not found with id=" + budgetId));
        userSecurity.validateUserAccess(budget.getUser().getId());
        budgetRepository.delete(budget);
        log.info("Budget id={} deleted successfully", budgetId);
    }

    @Override
    @Transactional
    public void deleteBudgetByCategory(Long userId, Long categoryId) {
        userSecurity.validateUserAccess(userId);
        log.info("Deleting budget for userId={}, categoryId={}", userId, categoryId);
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        budgetRepository.deleteByUserAndCategoryId(user, categoryId);
        log.info("Budget for userId={}, categoryId={} deleted successfully", userId, categoryId);
    }

    @Override
    public List<BudgetStatusDto> getBudgetStatus(Long userId) {
        userSecurity.validateUserAccess(userId);
        log.debug("Calculating budget status for userId={}", userId);
        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        List<Budget> budgets = budgetRepository.findByUser(user);
        LocalDate now = LocalDate.now();

        record DateRange(LocalDate start, LocalDate end) {}
        Map<DateRange, List<Expense>> expenseCache = new HashMap<>();
        Map<DateRange, List<Income>> incomeCache = new HashMap<>();

        List<BudgetStatusDto> statusList = budgets.stream().map(b -> {
            LocalDate start;
            LocalDate end;
            String period = b.getPeriod() != null ? b.getPeriod() : "MONTHLY";

            switch (period.toUpperCase(Locale.ROOT)) {
                case "WEEKLY" -> {
                    start = now.with(java.time.DayOfWeek.MONDAY);
                    end = now.with(java.time.DayOfWeek.SUNDAY);
                }
                case "YEARLY" -> {
                    start = now.withDayOfYear(1);
                    end = now.withDayOfYear(now.lengthOfYear());
                }
                case "CUSTOM" -> {
                    if (b.getStartDate() != null && b.getEndDate() != null) {
                        start = b.getStartDate();
                        end = b.getEndDate();
                    } else if (b.getStartDate() != null && b.getIntervalDays() != null && b.getIntervalDays() > 0) {
                        start = b.getStartDate();
                        end = b.getStartDate().plusDays(b.getIntervalDays());
                    } else if (b.getIntervalDays() != null && b.getIntervalDays() > 0) {
                        start = now;
                        end = now.plusDays(b.getIntervalDays());
                    } else {
                        start = b.getStartDate() != null ? b.getStartDate() : now.withDayOfMonth(1);
                        end = b.getEndDate() != null ? b.getEndDate() : now;
                    }
                }
                default -> { // MONTHLY
                    start = now.withDayOfMonth(1);
                    end = now.plusMonths(1).withDayOfMonth(1).minusDays(1);
                }
            }

            final LocalDate periodStart = start;
            final LocalDate periodEnd = end;

            List<Expense> periodExpenses = expenseCache.computeIfAbsent(
                    new DateRange(start, end),
                    r -> expenseRepository.findByUserAndExpenseDateBetween(user, r.start(), r.end())
            );

            BigDecimal grossSpent = periodExpenses.stream()
                    .filter(e -> e.getCategory() != null && e.getCategory().getId().equals(b.getCategory().getId()))
                    .map(Expense::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            DateRange reimbursementRange = new DateRange(
                    start.minusMonths(IncomeRules.MAX_MONTH_SHIFT),
                    end.plusMonths(IncomeRules.MAX_MONTH_SHIFT)
            );
            List<Income> periodIncomes = incomeCache.computeIfAbsent(
                    reimbursementRange,
                    r -> incomeRepository.findByUserAndIncomeDateBetween(user, r.start(), r.end())
            );

            BigDecimal reimbursed = periodIncomes.stream()
                    .filter(i -> IncomeRules.effectiveKind(i) == IncomeKind.REIMBURSEMENT)
                    .filter(i -> b.getCategory().getId().equals(i.getReimbursedCategoryId()))
                    .filter(i -> {
                        LocalDate counted = IncomeRules.effectiveDate(i);
                        return counted != null && !counted.isBefore(periodStart) && !counted.isAfter(periodEnd);
                    })
                    .map(Income::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal spent = grossSpent.subtract(reimbursed).max(BigDecimal.ZERO);
            double pct = b.getLimitAmount().doubleValue() > 0
                    ? spent.doubleValue() / b.getLimitAmount().doubleValue() * 100 : 0;

            return new BudgetStatusDto(
                    b.getId(),
                    b.getCategory().getId(),
                    b.getCategory().getName(),
                    b.getLimitAmount(),
                    spent,
                    pct,
                    period,
                    b.getIntervalDays(),
                    start,
                    end
            );
        }).toList();

        log.info("Generated budget status for {} budgets for userId={}", statusList.size(), userId);
        return statusList;
    }
}
