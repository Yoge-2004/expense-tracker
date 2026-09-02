package com.example.expensetracker.service.impl;

import com.example.expensetracker.dto.SavingsGoalDto;
import com.example.expensetracker.dto.SavingsGoalRequest;
import com.example.expensetracker.mapper.SavingsGoalMapper;
import com.example.expensetracker.model.SavingsGoal;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.SavingsGoalRepository;
import com.example.expensetracker.service.SavingsGoalService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Implementation of {@link SavingsGoalService} managing lifecycle, milestone deposits,
 * target completion detection, and ownership enforcement for user savings goals.
 *
 * @author Yogeshwaran
 */
@Service
public class SavingsGoalServiceImpl implements SavingsGoalService {

    private final SavingsGoalRepository savingsGoalRepository;

    /**
     * Constructs {@link SavingsGoalServiceImpl} with required repository.
     *
     * @param savingsGoalRepository the savings goal repository
     */
    public SavingsGoalServiceImpl(SavingsGoalRepository savingsGoalRepository) {
        this.savingsGoalRepository = savingsGoalRepository;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public SavingsGoalDto createGoal(SavingsGoalRequest request, User user) {
        SavingsGoal goal = SavingsGoalMapper.toEntity(request, user);
        SavingsGoal saved = savingsGoalRepository.save(goal);
        return SavingsGoalMapper.toDto(saved);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional(readOnly = true)
    public List<SavingsGoalDto> getUserGoals(User user) {
        return savingsGoalRepository.findByUser(user)
                .stream()
                .map(SavingsGoalMapper::toDto)
                .collect(Collectors.toList());
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public SavingsGoalDto updateGoal(Long goalId, SavingsGoalRequest request, User user) {
        SavingsGoal existing = savingsGoalRepository.findById(goalId)
                .orElseThrow(() -> new IllegalArgumentException("Savings goal not found"));

        if (!existing.getUser().getId().equals(user.getId())) {
            throw new IllegalArgumentException("Savings goal does not belong to this user");
        }

        if (request.getName() != null) {
            existing.setName(request.getName());
        }
        if (request.getTargetAmount() != null) {
            existing.setTargetAmount(request.getTargetAmount());
        }
        if (request.getCurrentAmount() != null) {
            existing.setCurrentAmount(request.getCurrentAmount());
        }
        if (request.getTargetDate() != null) {
            existing.setTargetDate(request.getTargetDate());
        }
        if (request.getStatus() != null) {
            existing.setStatus(request.getStatus());
        }

        SavingsGoal saved = savingsGoalRepository.save(existing);
        return SavingsGoalMapper.toDto(saved);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public SavingsGoalDto depositToGoal(Long goalId, BigDecimal amount, User user) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Deposit amount must be greater than zero");
        }

        SavingsGoal goal = savingsGoalRepository.findById(goalId)
                .orElseThrow(() -> new IllegalArgumentException("Savings goal not found"));

        if (!goal.getUser().getId().equals(user.getId())) {
            throw new IllegalArgumentException("Savings goal does not belong to this user");
        }

        BigDecimal updatedAmount = goal.getCurrentAmount() != null
                ? goal.getCurrentAmount().add(amount)
                : amount;

        goal.setCurrentAmount(updatedAmount);

        if (goal.getTargetAmount() != null && updatedAmount.compareTo(goal.getTargetAmount()) >= 0) {
            goal.setStatus("COMPLETED");
        }

        SavingsGoal saved = savingsGoalRepository.save(goal);
        return SavingsGoalMapper.toDto(saved);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public void deleteGoal(Long goalId, User user) {
        SavingsGoal goal = savingsGoalRepository.findById(goalId)
                .orElseThrow(() -> new IllegalArgumentException("Savings goal not found"));

        if (!goal.getUser().getId().equals(user.getId())) {
            throw new IllegalArgumentException("Savings goal does not belong to this user");
        }

        savingsGoalRepository.delete(goal);
    }
}
