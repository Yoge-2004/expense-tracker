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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LoanAdjustmentServiceImplTest {

    @Mock
    private LoanAdjustmentRepository loanAdjustmentRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ExpenseRepository expenseRepository;

    @InjectMocks
    private LoanAdjustmentServiceImpl loanAdjustmentService;

    private User user;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setId(1L);
        user.setName("John Doe");
        user.setEmail("john@example.com");
    }

    @Test
    @DisplayName("createLoan creates and persists a loan adjustment correctly")
    void createLoan_success() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        LoanAdjustmentRequest request = new LoanAdjustmentRequest(
                "Rahul Sharma", LoanType.LENT, new BigDecimal("1500.00"),
                LocalDate.of(2026, 10, 20), LocalDate.of(2026, 11, 1), "Dinner split", false
        );

        LoanAdjustment savedEntity = LoanAdjustment.builder()
                .id(101L)
                .counterparty("Rahul Sharma")
                .type(LoanType.LENT)
                .amount(new BigDecimal("1500.00"))
                .adjustmentDate(LocalDate.of(2026, 10, 20))
                .dueDate(LocalDate.of(2026, 11, 1))
                .notes("Dinner split")
                .isSettled(false)
                .user(user)
                .build();

        when(loanAdjustmentRepository.save(any(LoanAdjustment.class))).thenReturn(savedEntity);

        LoanAdjustmentDto result = loanAdjustmentService.createLoan(request, 1L);

        assertNotNull(result);
        assertEquals(101L, result.id());
        assertEquals("Rahul Sharma", result.counterparty());
        assertEquals(LoanType.LENT, result.type());
        assertEquals(new BigDecimal("1500.00"), result.amount());
        assertFalse(result.isSettled());
        verify(loanAdjustmentRepository).save(any(LoanAdjustment.class));
    }

    @Test
    @DisplayName("createLoan connects existing expense and configures customized reminder")
    void createLoan_withExpenseAndReminder() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        Expense expense = Expense.builder()
                .id(42L)
                .description("Team Dinner at Olive")
                .amount(new BigDecimal("4500.00"))
                .expenseDate(LocalDate.of(2026, 10, 19))
                .user(user)
                .build();

        when(expenseRepository.findByIdAndUser(42L, user)).thenReturn(Optional.of(expense));

        LoanAdjustmentRequest request = new LoanAdjustmentRequest(
                "Alex", LoanType.LENT, new BigDecimal("1500.00"),
                LocalDate.of(2026, 10, 20), LocalDate.of(2026, 10, 25), "Split from team dinner",
                false, 42L, true, LocalDate.of(2026, 10, 25), "10:00", "DAILY"
        );

        LoanAdjustment savedEntity = LoanAdjustment.builder()
                .id(105L)
                .counterparty("Alex")
                .type(LoanType.LENT)
                .amount(new BigDecimal("1500.00"))
                .adjustmentDate(LocalDate.of(2026, 10, 20))
                .dueDate(LocalDate.of(2026, 10, 25))
                .notes("Split from team dinner")
                .isSettled(false)
                .expense(expense)
                .reminderEnabled(true)
                .reminderDate(LocalDate.of(2026, 10, 25))
                .reminderTime("10:00")
                .reminderFrequency("DAILY")
                .user(user)
                .build();

        when(loanAdjustmentRepository.save(any(LoanAdjustment.class))).thenReturn(savedEntity);

        LoanAdjustmentDto result = loanAdjustmentService.createLoan(request, 1L);

        assertNotNull(result);
        assertEquals(42L, result.expenseId());
        assertEquals("Team Dinner at Olive", result.expenseDescription());
        assertEquals(new BigDecimal("4500.00"), result.expenseAmount());
        assertTrue(result.reminderEnabled());
        assertEquals("10:00", result.reminderTime());
        assertEquals("DAILY", result.reminderFrequency());
    }

    @Test
    @DisplayName("toggleSettleLoan switches unsettled to settled with today's date")
    void toggleSettleLoan_marksSettled() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        LoanAdjustment existing = LoanAdjustment.builder()
                .id(102L)
                .counterparty("Priya")
                .type(LoanType.BORROWED)
                .amount(new BigDecimal("2000.00"))
                .adjustmentDate(LocalDate.of(2026, 10, 10))
                .isSettled(false)
                .user(user)
                .build();

        when(loanAdjustmentRepository.findByIdAndUser(102L, user)).thenReturn(Optional.of(existing));
        when(loanAdjustmentRepository.save(any(LoanAdjustment.class))).thenAnswer(inv -> inv.getArgument(0));

        LoanAdjustmentDto toggled = loanAdjustmentService.toggleSettleLoan(102L, 1L);

        assertTrue(toggled.isSettled());
        assertEquals(LocalDate.now(), toggled.settledDate());
    }

    @Test
    @DisplayName("getLoanMetrics calculates lent, borrowed, pending, and net balance separately")
    void getLoanMetrics_calculatesAccurately() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        LoanAdjustment lentPending = LoanAdjustment.builder()
                .id(1L).type(LoanType.LENT).amount(new BigDecimal("3000.00")).isSettled(false).user(user).build();
        LoanAdjustment lentSettled = LoanAdjustment.builder()
                .id(2L).type(LoanType.LENT).amount(new BigDecimal("2000.00")).isSettled(true).user(user).build();
        LoanAdjustment borrowedPending = LoanAdjustment.builder()
                .id(3L).type(LoanType.BORROWED).amount(new BigDecimal("1200.00")).isSettled(false).user(user).build();
        LoanAdjustment borrowedSettled = LoanAdjustment.builder()
                .id(4L).type(LoanType.BORROWED).amount(new BigDecimal("800.00")).isSettled(true).user(user).build();

        when(loanAdjustmentRepository.findByUserOrderByAdjustmentDateDescIdDesc(user))
                .thenReturn(List.of(lentPending, lentSettled, borrowedPending, borrowedSettled));

        LoanMetricsDto metrics = loanAdjustmentService.getLoanMetrics(1L);

        assertNotNull(metrics);
        assertEquals(new BigDecimal("5000.00"), metrics.totalLent());
        assertEquals(new BigDecimal("2000.00"), metrics.totalBorrowed());
        assertEquals(new BigDecimal("3000.00"), metrics.lentPending());
        assertEquals(new BigDecimal("1200.00"), metrics.borrowedPending());
        // Net Balance = lentPending (3000) - borrowedPending (1200) = +1800
        assertEquals(new BigDecimal("1800.00"), metrics.netBalance());
        assertEquals(4, metrics.totalCount());
        assertEquals(2, metrics.pendingCount());
        assertEquals(2, metrics.settledCount());
    }

    @Test
    @DisplayName("deleteLoan throws ResourceNotFoundException if record not found")
    void deleteLoan_notFound() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(loanAdjustmentRepository.findByIdAndUser(999L, user)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> loanAdjustmentService.deleteLoan(999L, 1L));
    }
}
