package com.example.expensetracker.service.impl;

import com.example.expensetracker.dto.CashFlowSummaryDto;
import com.example.expensetracker.dto.IncomeDto;
import com.example.expensetracker.dto.IncomeRequest;
import com.example.expensetracker.mapper.IncomeMapper;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.Income;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.IncomeRepository;
import com.example.expensetracker.service.IncomeService;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Implementation of {@link IncomeService} managing income persistence, ownership validation,
 * in-memory caching, and cash flow analysis.
 *
 * @author Yogeshwaran
 */
@Service
public class IncomeServiceImpl implements IncomeService {

    private final IncomeRepository incomeRepository;
    private final ExpenseRepository expenseRepository;

    /**
     * Constructs {@link IncomeServiceImpl} with required repositories.
     *
     * @param incomeRepository the income repository
     * @param expenseRepository the expense repository
     */
    public IncomeServiceImpl(IncomeRepository incomeRepository, ExpenseRepository expenseRepository) {
        this.incomeRepository = incomeRepository;
        this.expenseRepository = expenseRepository;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    @CacheEvict(value = "userIncomes", key = "#user.id")
    public IncomeDto createIncome(IncomeRequest request, User user) {
        Income income = IncomeMapper.toEntity(request, user);
        if (Boolean.TRUE.equals(income.getIsRecurring())) {
            if (income.getFrequency() == null || income.getFrequency().isBlank()) {
                income.setFrequency("MONTHLY");
            }
            if (income.getIntervalDays() == null || income.getIntervalDays() < 1) {
                income.setIntervalDays(1);
            }
            if (income.getNextDueDate() == null && income.getIncomeDate() != null) {
                income.setNextDueDate(calculateNextOccurrence(income.getIncomeDate(), income.getFrequency(), income.getIntervalDays()));
            }
        } else {
            income.setFrequency(null);
            income.setIntervalDays(null);
            income.setNextDueDate(null);
        }
        Income saved = incomeRepository.save(income);
        return IncomeMapper.toDto(saved);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional(readOnly = true)
    @Cacheable(value = "userIncomes", key = "#user.id")
    public List<IncomeDto> getUserIncomes(User user) {
        return incomeRepository.findByUser(user)
                .stream()
                .map(IncomeMapper::toDto)
                .collect(Collectors.toList());
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    @CacheEvict(value = "userIncomes", key = "#user.id")
    public IncomeDto updateIncome(Long incomeId, IncomeRequest request, User user) {
        Income existing = incomeRepository.findById(incomeId)
                .orElseThrow(() -> new IllegalArgumentException("Income not found"));

        if (!existing.getUser().getId().equals(user.getId())) {
            throw new IllegalArgumentException("Income does not belong to this user");
        }

        if (request.getAmount() != null) {
            existing.setAmount(request.getAmount());
        }
        if (request.getSource() != null) {
            existing.setSource(request.getSource());
        }
        if (request.getDescription() != null) {
            existing.setDescription(request.getDescription());
        }
        if (request.getIncomeDate() != null) {
            existing.setIncomeDate(request.getIncomeDate());
        }
        if (request.getIsRecurring() != null) {
            existing.setIsRecurring(request.getIsRecurring());
            if (Boolean.TRUE.equals(request.getIsRecurring())) {
                existing.setFrequency(request.getFrequency() != null ? request.getFrequency() : (existing.getFrequency() != null ? existing.getFrequency() : "MONTHLY"));
                existing.setIntervalDays(request.getIntervalDays() != null ? request.getIntervalDays() : (existing.getIntervalDays() != null ? existing.getIntervalDays() : 1));
                if (existing.getNextDueDate() == null && existing.getIncomeDate() != null) {
                    existing.setNextDueDate(calculateNextOccurrence(existing.getIncomeDate(), existing.getFrequency(), existing.getIntervalDays()));
                }
            } else {
                existing.setFrequency(null);
                existing.setIntervalDays(null);
                existing.setNextDueDate(null);
            }
        }
        if (request.getFrequency() != null && Boolean.TRUE.equals(existing.getIsRecurring())) {
            existing.setFrequency(request.getFrequency());
        }
        if (request.getIntervalDays() != null && Boolean.TRUE.equals(existing.getIsRecurring())) {
            existing.setIntervalDays(request.getIntervalDays());
        }

        Income saved = incomeRepository.save(existing);
        return IncomeMapper.toDto(saved);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    @CacheEvict(value = "userIncomes", key = "#user.id")
    public void deleteIncome(Long incomeId, User user) {
        Income existing = incomeRepository.findById(incomeId)
                .orElseThrow(() -> new IllegalArgumentException("Income not found"));

        if (!existing.getUser().getId().equals(user.getId())) {
            throw new IllegalArgumentException("Income does not belong to this user");
        }

        incomeRepository.delete(existing);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional(readOnly = true)
    public CashFlowSummaryDto getCashFlowSummary(User user, int year, int month) {
        LocalDate startDate = LocalDate.of(year, month, 1);
        LocalDate endDate = startDate.withDayOfMonth(startDate.lengthOfMonth());

        List<Income> incomes = incomeRepository.findByUserAndIncomeDateBetween(user, startDate, endDate);
        List<Expense> expenses = expenseRepository.findByUserAndExpenseDateBetween(user, startDate, endDate);

        BigDecimal totalIncome = incomes.stream()
                .map(Income::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalExpense = expenses.stream()
                .map(Expense::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal netSavings = totalIncome.subtract(totalExpense);

        double savingsRate = 0.0;
        if (totalIncome.compareTo(BigDecimal.ZERO) > 0) {
            savingsRate = netSavings.divide(totalIncome, 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100))
                    .doubleValue();
            savingsRate = Math.round(savingsRate * 10.0) / 10.0;
        }

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
        if (freq == null) freq = "MONTHLY";
        return switch (freq.toUpperCase()) {
            case "DAILY" -> date.plusDays(1);
            case "WEEKLY" -> date.plusWeeks(1);
            case "YEARLY" -> date.plusYears(1);
            case "CUSTOM" -> date.plusDays(intervalDays != null && intervalDays > 0 ? intervalDays : 1);
            default -> date.plusMonths(1);
        };
    }
}
