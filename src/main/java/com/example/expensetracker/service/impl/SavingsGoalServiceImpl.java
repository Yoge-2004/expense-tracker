package com.example.expensetracker.service.impl;

import com.example.expensetracker.dto.SavingsGoalDto;
import com.example.expensetracker.dto.SavingsGoalRequest;
import com.example.expensetracker.mapper.SavingsGoalMapper;
import com.example.expensetracker.model.SavingsGoal;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.SavingsGoalRepository;
import com.example.expensetracker.service.SavingsGoalService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

    private static final Logger log = LoggerFactory.getLogger(SavingsGoalServiceImpl.class);

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
        log.info("Creating savings goal for userId={}: name={}, targetAmount={}",
                user.getId(), request.getName(), request.getTargetAmount());
        SavingsGoal goal = SavingsGoalMapper.toEntity(request, user);
        SavingsGoal saved = savingsGoalRepository.save(goal);
        log.info("Savings goal created with id={} for userId={}", saved.getId(), user.getId());
        return SavingsGoalMapper.toDto(saved);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional(readOnly = true)
    public List<SavingsGoalDto> getUserGoals(User user) {
        log.debug("Loading savings goals for userId={}", user.getId());
        List<SavingsGoalDto> goals = savingsGoalRepository.findByUser(user)
                .stream()
                .map(SavingsGoalMapper::toDto)
                .collect(Collectors.toList());
        log.debug("Loaded {} savings goals for userId={}", goals.size(), user.getId());
        return goals;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public SavingsGoalDto updateGoal(Long goalId, SavingsGoalRequest request, User user) {
        log.info("Updating savings goal id={} for userId={}", goalId, user.getId());
        SavingsGoal existing = savingsGoalRepository.findById(goalId)
                .orElseThrow(() -> new IllegalArgumentException("Savings goal not found"));

        if (!existing.getUser().getId().equals(user.getId())) {
            log.warn("Ownership mismatch: savings goal id={} does not belong to userId={}", goalId, user.getId());
            throw new IllegalArgumentException("Savings goal does not belong to this user");
        }

        if (request.getName() != null) {
            existing.setName(request.getName());
        }
        if (request.getTargetAmount() != null) {
            existing.setTargetAmount(request.getTargetAmount());
        }
        // FIXED: previously request.getCurrentAmount() could be set directly via updateGoal,
        // bypassing depositToGoal's validation and atomic increment. This allowed a user to
        // arbitrarily set currentAmount (including above target) without going through the
        // deposit flow, and also skipped the COMPLETED status auto-transition. We now ignore
        // currentAmount on update — use POST /savings/goals/{id}/deposit to add funds.
        // If you genuinely need to adjust currentAmount (e.g. correction), add an admin endpoint.
        if (request.getTargetDate() != null) {
            existing.setTargetDate(request.getTargetDate());
        }
        if (request.getStatus() != null) {
            existing.setStatus(request.getStatus());
        }
        if (request.getIsRecurring() != null) {
            existing.setIsRecurring(request.getIsRecurring());
        }
        if (request.getRecurringAmount() != null) {
            existing.setRecurringAmount(request.getRecurringAmount());
        }
        if (request.getFrequency() != null) {
            existing.setFrequency(request.getFrequency());
        }
        if (request.getIntervalDays() != null) {
            existing.setIntervalDays(request.getIntervalDays());
        }
        if (request.getNextDueDate() != null) {
            existing.setNextDueDate(request.getNextDueDate());
        }
        if (request.getEndDate() != null) {
            existing.setEndDate(request.getEndDate());
        }

        // Auto-transition status to COMPLETED if the (unchanged) currentAmount now meets
        // or exceeds the (possibly updated) targetAmount. This handles the case where the
        // user lowers the target below what they've already saved.
        if (existing.getTargetAmount() != null
                && existing.getCurrentAmount() != null
                && existing.getCurrentAmount().compareTo(existing.getTargetAmount()) >= 0
                && !"COMPLETED".equals(existing.getStatus())) {
            existing.setStatus("COMPLETED");
            log.info("Savings goal id={} auto-marked COMPLETED (target lowered below current saved)", goalId);
        }

        SavingsGoal saved = savingsGoalRepository.save(existing);
        log.info("Savings goal id={} updated successfully for userId={}", saved.getId(), user.getId());
        return SavingsGoalMapper.toDto(saved);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public SavingsGoalDto depositToGoal(Long goalId, BigDecimal amount, User user) {
        log.info("Processing deposit of {} to savings goal id={} for userId={}", amount, goalId, user.getId());
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            log.warn("Rejected non-positive deposit amount={} for goalId={}", amount, goalId);
            throw new IllegalArgumentException("Deposit amount must be greater than zero");
        }

        SavingsGoal goal = savingsGoalRepository.findById(goalId)
                .orElseThrow(() -> new IllegalArgumentException("Savings goal not found"));

        if (!goal.getUser().getId().equals(user.getId())) {
            log.warn("Ownership mismatch: savings goal id={} does not belong to userId={}", goalId, user.getId());
            throw new IllegalArgumentException("Savings goal does not belong to this user");
        }

        // CONCURRENCY FIX: previously, two concurrent deposits both read goal.getCurrentAmount(),
        // both computed the same updatedAmount, and last-writer-wins silently lost one deposit.
        // We now use an atomic SQL UPDATE that increments current_amount by `amount` in a single
        // statement. The SELECT above is retained only for ownership validation; the UPDATE
        // is the source of truth for the new total. We then re-read the row to get the actual
        // new currentAmount and to apply the COMPLETED status transition.
        int affected = savingsGoalRepository.addToCurrentAmount(goalId, user, amount);
        if (affected != 1) {
            log.error("Atomic deposit update affected {} rows for goalId={} userId={}", affected, goalId, user.getId());
            throw new IllegalStateException("Failed to apply deposit — please try again");
        }

        // Re-read to get the authoritative new value and to check the completion threshold.
        SavingsGoal updated = savingsGoalRepository.findById(goalId)
                .orElseThrow(() -> new IllegalStateException("Savings goal vanished mid-deposit"));

        if (updated.getTargetAmount() != null
                && updated.getCurrentAmount() != null
                && updated.getCurrentAmount().compareTo(updated.getTargetAmount()) >= 0
                && !"COMPLETED".equals(updated.getStatus())) {
            updated.setStatus("COMPLETED");
            log.info("Savings goal id={} reached target amount ({}) and marked COMPLETED", goalId, updated.getTargetAmount());
            updated = savingsGoalRepository.save(updated);
        }

        log.info("Deposit applied to savings goal id={}: newCurrentAmount={}, status={}",
                goalId, updated.getCurrentAmount(), updated.getStatus());
        return SavingsGoalMapper.toDto(updated);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public void deleteGoal(Long goalId, User user) {
        log.info("Deleting savings goal id={} for userId={}", goalId, user.getId());
        SavingsGoal goal = savingsGoalRepository.findById(goalId)
                .orElseThrow(() -> new IllegalArgumentException("Savings goal not found"));

        if (!goal.getUser().getId().equals(user.getId())) {
            log.warn("Ownership mismatch: savings goal id={} does not belong to userId={}", goalId, user.getId());
            throw new IllegalArgumentException("Savings goal does not belong to this user");
        }

        savingsGoalRepository.delete(goal);
        log.info("Savings goal id={} deleted successfully for userId={}", goalId, user.getId());
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional(readOnly = true)
    public List<SavingsGoalDto> getRecurringGoals(User user) {
        log.debug("Loading recurring savings goals for userId={}", user.getId());
        List<SavingsGoalDto> list = savingsGoalRepository.findByUserAndIsRecurringTrue(user)
                .stream()
                .map(SavingsGoalMapper::toDto)
                .collect(Collectors.toList());
        log.debug("Loaded {} recurring savings goals for userId={}", list.size(), user.getId());
        return list;
    }
}
