package com.example.expensetracker.service.impl;

import com.example.expensetracker.dto.CashFlowSummaryDto;
import com.example.expensetracker.dto.IncomeDto;
import com.example.expensetracker.dto.IncomeRequest;
import com.example.expensetracker.mapper.IncomeMapper;
import com.example.expensetracker.mapper.IncomeRules;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.Income;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.IncomeRepository;
import com.example.expensetracker.service.IncomeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Implementation of {@link IncomeService} managing income persistence, ownership validation,
 * in-memory caching, and cash flow analysis.
 *
 * @author Yogeshwaran
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class IncomeServiceImpl implements IncomeService {

    private static final String FREQUENCY_MONTHLY = "MONTHLY";

    private final IncomeRepository incomeRepository;
    private final ExpenseRepository expenseRepository;

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    @CacheEvict(value = "userIncomes", key = "#user.id")
    public IncomeDto createIncome(IncomeRequest request, User user) {
        if (user == null || user.getId() == null) {
            log.warn("Rejected income creation with null user context");
            throw new IllegalArgumentException("User must be specified");
        }
        if (request == null) {
            log.warn("Rejected null income request for userId={}", user.getId());
            throw new IllegalArgumentException("Income request cannot be null");
        }
        if (request.amount() == null || request.amount().compareTo(BigDecimal.ZERO) <= 0) {
            log.warn("Rejected income creation with non-positive amount={} for userId={}",
                    request.amount(), user.getId());
            throw new IllegalArgumentException("Income amount must be greater than zero");
        }
        if (request.source() == null || request.source().isBlank()) {
            log.warn("Rejected income creation with blank source for userId={}", user.getId());
            throw new IllegalArgumentException("Income source must not be blank");
        }
        log.info("Creating income record for userId={}: amount={}, source={}",
                user.getId(), request.amount(), request.source());
        Income income = IncomeMapper.toEntity(request, user);
        if (Boolean.TRUE.equals(income.getIsRecurring())) {
            if (income.getFrequency() == null || income.getFrequency().isBlank()) {
                income.setFrequency(FREQUENCY_MONTHLY);
            }
            if (income.getIntervalDays() == null || income.getIntervalDays() < 1) {
                income.setIntervalDays(1);
            }
            if (income.getNextDueDate() == null && income.getIncomeDate() != null) {
                income.setNextDueDate(calculateNextOccurrence(
                        income.getIncomeDate(), income.getFrequency(), income.getIntervalDays()));
            }
        } else {
            income.setFrequency(null);
            income.setIntervalDays(null);
            income.setNextDueDate(null);
        }
        Income saved = incomeRepository.save(income);
        log.info("Income record created with id={} for userId={}", saved.getId(), user.getId());
        return IncomeMapper.toDto(saved);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    @CacheEvict(value = "userIncomes", key = "#user.id")
    public List<IncomeDto> createIncomes(List<IncomeRequest> requests, User user) {
        if (user == null || user.getId() == null) {
            log.warn("Rejected batch income creation with null user context");
            throw new IllegalArgumentException("User must be specified");
        }
        if (requests == null || requests.isEmpty()) {
            return Collections.emptyList();
        }

        List<Income> entities = new ArrayList<>(requests.size());
        for (IncomeRequest request : requests) {
            if (request == null) {
                throw new IllegalArgumentException("Income request cannot be null");
            }
            if (request.amount() == null || request.amount().compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException("Income amount must be greater than zero");
            }
            if (request.source() == null || request.source().isBlank()) {
                throw new IllegalArgumentException("Income source must not be blank");
            }
            Income income = IncomeMapper.toEntity(request, user);
            if (Boolean.TRUE.equals(income.getIsRecurring())) {
                if (income.getFrequency() == null || income.getFrequency().isBlank()) {
                    income.setFrequency(FREQUENCY_MONTHLY);
                }
                if (income.getIntervalDays() == null || income.getIntervalDays() < 1) {
                    income.setIntervalDays(1);
                }
                if (income.getNextDueDate() == null && income.getIncomeDate() != null) {
                    income.setNextDueDate(calculateNextOccurrence(
                            income.getIncomeDate(), income.getFrequency(), income.getIntervalDays()));
                }
            } else {
                income.setFrequency(null);
                income.setIntervalDays(null);
                income.setNextDueDate(null);
            }
            entities.add(income);
        }

        List<Income> saved = incomeRepository.saveAll(entities);
        log.info("Batch created {} income records for userId={}", saved.size(), user.getId());
        return saved.stream().map(IncomeMapper::toDto).toList();
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Cacheable(value = "userIncomes", key = "#user.id")
    public List<IncomeDto> getUserIncomes(User user) {
        if (user == null || user.getId() == null) {
            throw new IllegalArgumentException("User must be specified");
        }
        log.debug("Retrieving user incomes for userId={}", user.getId());
        List<IncomeDto> list = incomeRepository.findByUser(user)
                .stream()
                .map(IncomeMapper::toDto)
                .toList();
        log.debug("Loaded {} income records for userId={}", list.size(), user.getId());
        return list;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    @CacheEvict(value = "userIncomes", key = "#user.id")
    public IncomeDto updateIncome(Long incomeId, IncomeRequest request, User user) {
        if (incomeId == null) {
            throw new IllegalArgumentException("Income ID cannot be null");
        }
        if (user == null || user.getId() == null) {
            throw new IllegalArgumentException("User must be specified");
        }
        if (request == null) {
            throw new IllegalArgumentException("Income request cannot be null");
        }
        if (request.amount() != null && request.amount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Income amount must be greater than zero");
        }
        log.info("Updating income id={} for userId={}", incomeId, user.getId());
        Income existing = incomeRepository.findById(incomeId)
                .orElseThrow(() -> new IllegalArgumentException("Income not found"));

        if (!existing.getUser().getId().equals(user.getId())) {
            log.warn("Ownership mismatch: income id={} belongs to userId={}, but update requested by userId={}",
                    incomeId, existing.getUser().getId(), user.getId());
            throw new IllegalArgumentException("Income does not belong to this user");
        }

        IncomeRules.apply(existing, request);

        Income saved = incomeRepository.save(existing);
        log.info("Income id={} updated successfully for userId={}", saved.getId(), user.getId());
        return IncomeMapper.toDto(saved);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    @CacheEvict(value = "userIncomes", key = "#user.id")
    public void deleteIncome(Long incomeId, User user) {
        if (incomeId == null) {
            throw new IllegalArgumentException("Income ID cannot be null");
        }
        if (user == null || user.getId() == null) {
            throw new IllegalArgumentException("User must be specified");
        }
        log.info("Deleting income id={} for userId={}", incomeId, user.getId());
        Income existing = incomeRepository.findById(incomeId)
                .orElseThrow(() -> new IllegalArgumentException("Income not found"));

        if (!existing.getUser().getId().equals(user.getId())) {
            log.warn("Ownership mismatch: income id={} belongs to userId={}, but requested by userId={}",
                    incomeId, existing.getUser().getId(), user.getId());
            throw new IllegalArgumentException("Income does not belong to this user");
        }

        incomeRepository.delete(existing);
        log.info("Income id={} deleted successfully for userId={}", incomeId, user.getId());
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public CashFlowSummaryDto getCashFlowSummary(User user, int year, int month) {
        if (user == null || user.getId() == null) {
            throw new IllegalArgumentException("User must be specified");
        }
        if (month < 1 || month > 12) {
            throw new IllegalArgumentException("Month must be between 1 and 12 (got " + month + ")");
        }
        if (year < 1900 || year > 2100) {
            throw new IllegalArgumentException("Year must be between 1900 and 2100 (got " + year + ")");
        }
        log.info("Computing cash flow summary for userId={}, period={}-{}", user.getId(), year, month);
        LocalDate startDate = LocalDate.of(year, month, 1);
        LocalDate endDate = startDate.withDayOfMonth(startDate.lengthOfMonth());
        java.time.YearMonth targetMonth = java.time.YearMonth.of(year, month);

        LocalDate queryStart = startDate.minusMonths(com.example.expensetracker.mapper.IncomeRules.MAX_MONTH_SHIFT);
        LocalDate queryEnd = endDate.plusMonths(com.example.expensetracker.mapper.IncomeRules.MAX_MONTH_SHIFT);
        List<Income> rawIncomes = incomeRepository.findByUserAndIncomeDateBetween(user, queryStart, queryEnd);
        if (rawIncomes == null || rawIncomes.isEmpty()) {
            rawIncomes = incomeRepository.findByUserAndIncomeDateBetween(user, startDate, endDate);
        }
        if (rawIncomes == null) rawIncomes = List.of();

        List<Income> incomes = rawIncomes.stream()
                .filter(i -> targetMonth.equals(com.example.expensetracker.mapper.IncomeRules.effectiveMonth(i)))
                .toList();

        List<Expense> expenses = expenseRepository.findByUserAndExpenseDateBetween(user, startDate, endDate);

        BigDecimal totalReimbursed = incomes.stream()
                .filter(i -> com.example.expensetracker.mapper.IncomeRules.effectiveKind(i)
                        == com.example.expensetracker.model.IncomeKind.REIMBURSEMENT)
                .map(Income::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalIncome = incomes.stream()
                .filter(i -> com.example.expensetracker.mapper.IncomeRules.effectiveKind(i)
                        != com.example.expensetracker.model.IncomeKind.REIMBURSEMENT)
                .map(Income::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal grossExpense = expenses.stream()
                .map(Expense::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalExpense = grossExpense.subtract(totalReimbursed).max(BigDecimal.ZERO);
        BigDecimal netSavings = totalIncome.subtract(totalExpense);

        double savingsRate = 0.0;
        if (totalIncome.compareTo(BigDecimal.ZERO) > 0) {
            savingsRate = netSavings.divide(totalIncome, 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100))
                    .doubleValue();
            savingsRate = Math.round(savingsRate * 10.0) / 10.0;
        }

        log.debug("Computed cash flow for userId={}: totalIncome={}, totalExpense={}, netSavings={}, savingsRate={}%",
                user.getId(), totalIncome, totalExpense, netSavings, savingsRate);

        return new CashFlowSummaryDto(
                year,
                month,
                totalIncome,
                totalExpense,
                netSavings,
                savingsRate,
                incomes.size(),
                expenses.size()
        );
    }

    private LocalDate calculateNextOccurrence(LocalDate date, String freq, Integer intervalDays) {
        if (freq == null) freq = FREQUENCY_MONTHLY;
        return switch (freq.toUpperCase(java.util.Locale.ROOT)) {
            case "DAILY" -> date.plusDays(1);
            case "WEEKLY" -> date.plusWeeks(1);
            case "YEARLY" -> date.plusYears(1);
            case "CUSTOM" -> date.plusDays(intervalDays != null && intervalDays > 0 ? intervalDays : 1);
            default -> date.plusMonths(1);
        };
    }
}
