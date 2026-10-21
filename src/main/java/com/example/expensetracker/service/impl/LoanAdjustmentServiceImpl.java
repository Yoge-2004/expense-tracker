package com.example.expensetracker.service.impl;

import com.example.expensetracker.dto.LoanAdjustmentDto;
import com.example.expensetracker.dto.LoanAdjustmentRequest;
import com.example.expensetracker.dto.LoanMetricsDto;
import com.example.expensetracker.exception.ResourceNotFoundException;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.LoanAdjustment;
import com.example.expensetracker.model.LoanType;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.LoanAdjustmentRepository;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.service.LoanAdjustmentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Service implementation for managing peer loans, friend adjustments, connected expenses,
 * reminder schedules, and debt metrics.
 *
 * @author Yogeshwaran
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LoanAdjustmentServiceImpl implements LoanAdjustmentService {

    private final LoanAdjustmentRepository loanAdjustmentRepository;
    private final UserRepository userRepository;
    private final ExpenseRepository expenseRepository;

    @Override
    @Transactional(readOnly = true)
    public List<LoanAdjustmentDto> getLoansForUser(Long userId) {
        User user = findUserOrThrow(userId);
        return loanAdjustmentRepository.findByUserOrderByAdjustmentDateDescIdDesc(user)
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public LoanAdjustmentDto getLoanById(Long id, Long userId) {
        User user = findUserOrThrow(userId);
        LoanAdjustment loan = loanAdjustmentRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> new ResourceNotFoundException("Loan adjustment record not found with id: " + id));
        return toDto(loan);
    }

    @Override
    @Transactional
    public LoanAdjustmentDto createLoan(LoanAdjustmentRequest request, Long userId) {
        User user = findUserOrThrow(userId);

        Expense linkedExpense = null;
        if (request.expenseId() != null) {
            linkedExpense = expenseRepository.findByIdAndUser(request.expenseId(), user).orElse(null);
        }

        boolean settled = Boolean.TRUE.equals(request.isSettled());
        boolean reminderEnabled = Boolean.TRUE.equals(request.reminderEnabled());

        LoanAdjustment entity = LoanAdjustment.builder()
                .counterparty(request.counterparty().trim())
                .type(request.type())
                .amount(request.amount())
                .adjustmentDate(request.adjustmentDate())
                .dueDate(request.dueDate())
                .notes(request.notes() != null ? request.notes().trim() : null)
                .isSettled(settled)
                .settledDate(settled ? LocalDate.now() : null)
                .expense(linkedExpense)
                .reminderEnabled(reminderEnabled)
                .reminderDate(request.reminderDate() != null ? request.reminderDate() : request.dueDate())
                .reminderTime(request.reminderTime())
                .reminderFrequency(request.reminderFrequency() != null ? request.reminderFrequency() : "ONCE")
                .user(user)
                .build();

        LoanAdjustment saved = loanAdjustmentRepository.save(entity);
        log.info("Created loan adjustment id={} for userId={}, type={}, counterparty='{}', amount={}, linkedExpenseId={}",
                saved.getId(), userId, saved.getType(), saved.getCounterparty(), saved.getAmount(),
                linkedExpense != null ? linkedExpense.getId() : null);
        return toDto(saved);
    }

    @Override
    @Transactional
    public LoanAdjustmentDto updateLoan(Long id, LoanAdjustmentRequest request, Long userId) {
        User user = findUserOrThrow(userId);
        LoanAdjustment loan = loanAdjustmentRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> new ResourceNotFoundException("Loan adjustment record not found with id: " + id));

        loan.setCounterparty(request.counterparty().trim());
        loan.setType(request.type());
        loan.setAmount(request.amount());
        loan.setAdjustmentDate(request.adjustmentDate());
        loan.setDueDate(request.dueDate());
        loan.setNotes(request.notes() != null ? request.notes().trim() : null);

        if (request.expenseId() != null) {
            Expense linked = expenseRepository.findByIdAndUser(request.expenseId(), user).orElse(null);
            loan.setExpense(linked);
        }

        if (request.reminderEnabled() != null) {
            loan.setReminderEnabled(request.reminderEnabled());
        }
        if (request.reminderDate() != null) {
            loan.setReminderDate(request.reminderDate());
        }
        if (request.reminderTime() != null) {
            loan.setReminderTime(request.reminderTime());
        }
        if (request.reminderFrequency() != null) {
            loan.setReminderFrequency(request.reminderFrequency());
        }

        if (request.isSettled() != null) {
            boolean wasSettled = loan.isSettled();
            boolean nowSettled = request.isSettled();
            loan.setIsSettled(nowSettled);
            if (!wasSettled && nowSettled) {
                loan.setSettledDate(LocalDate.now());
            } else if (wasSettled && !nowSettled) {
                loan.setSettledDate(null);
            }
        }

        LoanAdjustment updated = loanAdjustmentRepository.save(loan);
        log.info("Updated loan adjustment id={} for userId={}", id, userId);
        return toDto(updated);
    }

    @Override
    @Transactional
    public LoanAdjustmentDto toggleSettleLoan(Long id, Long userId) {
        User user = findUserOrThrow(userId);
        LoanAdjustment loan = loanAdjustmentRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> new ResourceNotFoundException("Loan adjustment record not found with id: " + id));

        boolean nextSettled = !loan.isSettled();
        loan.setIsSettled(nextSettled);
        loan.setSettledDate(nextSettled ? LocalDate.now() : null);

        LoanAdjustment saved = loanAdjustmentRepository.save(loan);
        log.info("Toggled settlement for loan adjustment id={} to isSettled={} for userId={}",
                id, nextSettled, userId);
        return toDto(saved);
    }

    @Override
    @Transactional
    public void deleteLoan(Long id, Long userId) {
        User user = findUserOrThrow(userId);
        LoanAdjustment loan = loanAdjustmentRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> new ResourceNotFoundException("Loan adjustment record not found with id: " + id));

        loanAdjustmentRepository.delete(loan);
        log.info("Deleted loan adjustment id={} for userId={}", id, userId);
    }

    @Override
    @Transactional(readOnly = true)
    public LoanMetricsDto getLoanMetrics(Long userId) {
        User user = findUserOrThrow(userId);
        List<LoanAdjustment> list = loanAdjustmentRepository.findByUserOrderByAdjustmentDateDescIdDesc(user);

        BigDecimal totalLent = BigDecimal.ZERO;
        BigDecimal totalBorrowed = BigDecimal.ZERO;
        BigDecimal lentPending = BigDecimal.ZERO;
        BigDecimal borrowedPending = BigDecimal.ZERO;
        long pendingCount = 0;
        long settledCount = 0;

        for (LoanAdjustment l : list) {
            BigDecimal amt = l.getAmount() != null ? l.getAmount() : BigDecimal.ZERO;
            boolean isLent = l.getType() == LoanType.LENT;
            boolean settled = l.isSettled();

            if (isLent) {
                totalLent = totalLent.add(amt);
                if (!settled) {
                    lentPending = lentPending.add(amt);
                }
            } else {
                totalBorrowed = totalBorrowed.add(amt);
                if (!settled) {
                    borrowedPending = borrowedPending.add(amt);
                }
            }

            if (settled) {
                settledCount++;
            } else {
                pendingCount++;
            }
        }

        BigDecimal netBalance = lentPending.subtract(borrowedPending);

        return new LoanMetricsDto(
                totalLent,
                totalBorrowed,
                lentPending,
                borrowedPending,
                netBalance,
                list.size(),
                pendingCount,
                settledCount
        );
    }

    private User findUserOrThrow(Long userId) {
        if (userId == null) {
            throw new IllegalArgumentException("User ID cannot be null");
        }
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));
    }

    private LoanAdjustmentDto toDto(LoanAdjustment entity) {
        Long expenseId = entity.getExpense() != null ? entity.getExpense().getId() : null;
        String expenseDesc = entity.getExpense() != null ? entity.getExpense().getDescription() : null;
        BigDecimal expenseAmt = entity.getExpense() != null ? entity.getExpense().getAmount() : null;

        return new LoanAdjustmentDto(
                entity.getId(),
                entity.getCounterparty(),
                entity.getType(),
                entity.getAmount(),
                entity.getAdjustmentDate(),
                entity.getDueDate(),
                entity.getNotes(),
                entity.isSettled(),
                entity.getSettledDate(),
                expenseId,
                expenseDesc,
                expenseAmt,
                entity.getReminderEnabled(),
                entity.getReminderDate(),
                entity.getReminderTime(),
                entity.getReminderFrequency(),
                entity.getCreatedAt()
        );
    }
}
