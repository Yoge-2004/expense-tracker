package com.example.expensetracker.service;

import com.example.expensetracker.dto.BudgetDto;
import com.example.expensetracker.dto.BudgetStatusDto;
import com.example.expensetracker.model.*;
import com.example.expensetracker.repository.BudgetRepository;
import com.example.expensetracker.repository.CategoryRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.IncomeRepository;
import com.example.expensetracker.security.UserSecurity;
import com.example.expensetracker.service.impl.BudgetServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BudgetServiceTest {

    @Mock private BudgetRepository budgetRepository;
    @Mock private CategoryRepository categoryRepository;
    @Mock private ExpenseRepository expenseRepository;
    @Mock private IncomeRepository incomeRepository;
    @Mock private UserService userService;
    @Mock private UserSecurity userSecurity;

    @InjectMocks
    private BudgetServiceImpl budgetService;

    private User user;
    private Category category;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setId(1L);
        user.setName("Alice");

        category = new Category();
        category.setId(10L);
        category.setName("Groceries");
        category.setUser(user);
    }

    @Test
    void setBudgetRejectsNonPositiveLimit() {
        BudgetDto dto = new BudgetDto(null, 10L, BigDecimal.ZERO, "MONTHLY", null, null, null);
        assertThatThrownBy(() -> budgetService.setBudget(1L, dto))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Budget limit must be a positive number");

        verify(userSecurity).validateUserAccess(1L);
        verifyNoInteractions(budgetRepository);
    }

    @Test
    void setBudgetRejectsForeignCategory() {
        User other = new User();
        other.setId(2L);
        Category foreignCat = new Category();
        foreignCat.setId(20L);
        foreignCat.setUser(other);

        when(userService.findById(1L)).thenReturn(Optional.of(user));
        when(categoryRepository.findById(20L)).thenReturn(Optional.of(foreignCat));

        BudgetDto dto = new BudgetDto(null, 20L, new BigDecimal("500"), "MONTHLY", null, null, null);
        assertThatThrownBy(() -> budgetService.setBudget(1L, dto))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("Category does not belong to this user");

        verify(budgetRepository, never()).save(any());
    }

    @Test
    void setBudgetCreatesNewBudgetForUserAndCategory() {
        when(userService.findById(1L)).thenReturn(Optional.of(user));
        when(categoryRepository.findById(10L)).thenReturn(Optional.of(category));
        when(budgetRepository.findByUserAndCategoryId(user, 10L)).thenReturn(Optional.empty());

        BudgetDto dto = new BudgetDto(null, 10L, new BigDecimal("1200"), "MONTHLY", null, null, null);
        budgetService.setBudget(1L, dto);

        verify(budgetRepository).save(argThat(b ->
                b.getUser().equals(user)
                        && b.getCategory().equals(category)
                        && b.getLimitAmount().compareTo(new BigDecimal("1200")) == 0
                        && "MONTHLY".equals(b.getPeriod())));
    }

    @Test
    void deleteBudgetByIdThrowsNoSuchElementExceptionWhenNotFound() {
        when(budgetRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> budgetService.deleteBudgetById(99L))
                .isInstanceOf(NoSuchElementException.class)
                .hasMessageContaining("Budget not found with id=99");
    }

    @Test
    void deleteBudgetByIdValidatesAccessAndDeleteEntity() {
        Budget b = new Budget();
        b.setId(5L);
        b.setUser(user);
        when(budgetRepository.findById(5L)).thenReturn(Optional.of(b));

        budgetService.deleteBudgetById(5L);

        verify(userSecurity).validateUserAccess(1L);
        verify(budgetRepository).delete(b);
    }

    @Test
    void deleteBudgetByCategoryDeletesByUserAndCategoryId() {
        when(userService.findById(1L)).thenReturn(Optional.of(user));

        budgetService.deleteBudgetByCategory(1L, 10L);

        verify(userSecurity).validateUserAccess(1L);
        verify(budgetRepository).deleteByUserAndCategoryId(user, 10L);
    }

    @Test
    void getBudgetStatusCalculatesGrossSpentAndReimbursements() {
        Budget budget = new Budget();
        budget.setId(3L);
        budget.setUser(user);
        budget.setCategory(category);
        budget.setLimitAmount(new BigDecimal("1000"));
        budget.setPeriod("MONTHLY");

        Expense exp1 = new Expense();
        exp1.setAmount(new BigDecimal("400"));
        exp1.setCategory(category);
        exp1.setExpenseDate(LocalDate.now());

        Expense exp2 = new Expense();
        exp2.setAmount(new BigDecimal("100"));
        exp2.setCategory(category);
        exp2.setExpenseDate(LocalDate.now());

        Income reimb = new Income();
        reimb.setAmount(new BigDecimal("150"));
        reimb.setKind("REIMBURSEMENT");
        reimb.setReimbursedCategoryId(10L);
        reimb.setIncomeDate(LocalDate.now());

        when(userService.findById(1L)).thenReturn(Optional.of(user));
        when(budgetRepository.findByUser(user)).thenReturn(List.of(budget));
        when(expenseRepository.findByUserAndExpenseDateBetween(eq(user), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(List.of(exp1, exp2));
        when(incomeRepository.findByUserAndIncomeDateBetween(eq(user), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(List.of(reimb));

        List<BudgetStatusDto> result = budgetService.getBudgetStatus(1L);

        assertThat(result).hasSize(1);
        BudgetStatusDto status = result.get(0);
        assertThat(status.budgetId()).isEqualTo(3L);
        assertThat(status.limit()).isEqualByComparingTo(new BigDecimal("1000"));
        // 400 + 100 - 150 = 350 spent
        assertThat(status.spent()).isEqualByComparingTo(new BigDecimal("350"));
        assertThat(status.percentage()).isEqualTo(35.0);
    }

    @Test
    void getBudgetStatusHandlesCustomPeriod() {
        Budget budget = new Budget();
        budget.setId(4L);
        budget.setUser(user);
        budget.setCategory(category);
        budget.setLimitAmount(new BigDecimal("500"));
        budget.setPeriod("CUSTOM");
        budget.setStartDate(LocalDate.of(2026, 1, 1));
        budget.setEndDate(LocalDate.of(2026, 1, 15));

        when(userService.findById(1L)).thenReturn(Optional.of(user));
        when(budgetRepository.findByUser(user)).thenReturn(List.of(budget));
        when(expenseRepository.findByUserAndExpenseDateBetween(eq(user),
                eq(LocalDate.of(2026, 1, 1)), eq(LocalDate.of(2026, 1, 15))))
                .thenReturn(List.of());

        List<BudgetStatusDto> result = budgetService.getBudgetStatus(1L);
        assertThat(result).hasSize(1);
        assertThat(result.get(0).startDate()).isEqualTo(LocalDate.of(2026, 1, 1));
        assertThat(result.get(0).endDate()).isEqualTo(LocalDate.of(2026, 1, 15));
    }
}
