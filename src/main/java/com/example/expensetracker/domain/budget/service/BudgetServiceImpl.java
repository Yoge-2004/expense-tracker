package com.example.expensetracker.domain.budget.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

import com.example.expensetracker.domain.budget.dto.BudgetDto;
import com.example.expensetracker.domain.budget.dto.BudgetStatusDto;
import com.example.expensetracker.domain.budget.model.Budget;
import com.example.expensetracker.domain.budget.model.BudgetPeriod;
import com.example.expensetracker.domain.budget.repository.BudgetRepository;
import com.example.expensetracker.domain.expense.dto.CategorySpendSummary;
import com.example.expensetracker.domain.expense.model.Category;
import com.example.expensetracker.domain.expense.repository.CategoryRepository;
import com.example.expensetracker.domain.expense.repository.ExpenseRepository;
import com.example.expensetracker.domain.income.mapper.IncomeRules;
import com.example.expensetracker.domain.income.model.Income;
import com.example.expensetracker.domain.income.repository.IncomeRepository;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.domain.user.service.UserProfileService;
import com.example.expensetracker.domain.user.security.UserSecurity;



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
    private final UserProfileService userService;
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
        Map<DateRange, Map<Long, BigDecimal>> spendByRange = new HashMap<>();
        Map<DateRange, List<Income>> reimbursementCache = new HashMap<>();

        List<BudgetStatusDto> statusList = budgets.stream().map(b -> {
            LocalDate[] window = BudgetPeriod.fromString(b.getPeriod()).calculateWindow(b, now);
            final LocalDate periodStart = window[0];
            final LocalDate periodEnd = window[1];

            Map<Long, BigDecimal> categoryTotals = spendByRange.computeIfAbsent(
                    new DateRange(periodStart, periodEnd),
                    r -> expenseRepository.sumAmountByCategoryForUserBetween(user, r.start(), r.end()).stream()
                            .collect(Collectors.toMap(
                                    CategorySpendSummary::categoryId,
                                    s -> s.totalAmount() != null ? s.totalAmount() : BigDecimal.ZERO,
                                    BigDecimal::add))
            );

            BigDecimal grossSpent = categoryTotals.getOrDefault(b.getCategory().getId(), BigDecimal.ZERO);

            DateRange reimbursementRange = new DateRange(
                    periodStart.minusMonths(IncomeRules.MAX_MONTH_SHIFT),
                    periodEnd.plusMonths(IncomeRules.MAX_MONTH_SHIFT)
            );
            List<Income> reimbursements = reimbursementCache.computeIfAbsent(
                    reimbursementRange,
                    r -> incomeRepository.findReimbursementsByUserAndIncomeDateBetween(user, r.start(), r.end())
            );

            BigDecimal reimbursed = reimbursements.stream()
                    .filter(i -> b.getCategory().getId().equals(i.getReimbursedCategoryId()))
                    .filter(i -> {
                        LocalDate counted = IncomeRules.effectiveDate(i);
                        return counted != null && !counted.isBefore(periodStart) && !counted.isAfter(periodEnd);
                    })
                    .map(Income::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal spent = grossSpent.subtract(reimbursed).max(BigDecimal.ZERO);
            double pct = b.getLimitAmount().compareTo(BigDecimal.ZERO) > 0
                    ? spent.multiply(BigDecimal.valueOf(100))
                            .divide(b.getLimitAmount(), 4, RoundingMode.HALF_UP)
                            .doubleValue()
                    : 0.0;

            return new BudgetStatusDto(
                    b.getId(),
                    b.getCategory().getId(),
                    b.getCategory().getName(),
                    b.getLimitAmount(),
                    spent,
                    pct,
                    b.getPeriod() != null ? b.getPeriod() : "MONTHLY",
                    b.getIntervalDays(),
                    periodStart,
                    periodEnd
            );
        }).toList();

        log.info("Generated budget status for {} budgets for userId={}", statusList.size(), userId);
        return statusList;
    }
}
