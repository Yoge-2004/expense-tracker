package com.example.expensetracker.service;

import com.example.expensetracker.dto.CashFlowSummaryDto;
import com.example.expensetracker.dto.IncomeDto;
import com.example.expensetracker.dto.IncomeRequest;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.Income;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.IncomeRepository;
import com.example.expensetracker.service.impl.IncomeServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("IncomeServiceImpl Unit Tests")
class IncomeServiceImplTest {

    @Mock
    private IncomeRepository incomeRepository;

    @Mock
    private ExpenseRepository expenseRepository;

    private IncomeServiceImpl incomeService;
    private User testUser;
    private User otherUser;

    @BeforeEach
    void setUp() {
        incomeService = new IncomeServiceImpl(incomeRepository, expenseRepository);

        testUser = new User();
        testUser.setId(1L);
        testUser.setName("Yogeshwaran");
        testUser.setEmail("yoge@example.com");

        otherUser = new User();
        otherUser.setId(2L);
        otherUser.setName("Other User");
        otherUser.setEmail("other@example.com");
    }

    @Test
    @DisplayName("createIncome → successfully saves and maps income")
    void createIncome_success() {
        IncomeRequest request = new IncomeRequest();
        request.setAmount(new BigDecimal("50000.00"));
        request.setSource("Salary");
        request.setDescription("Monthly salary credit");
        request.setIncomeDate(LocalDate.of(2026, 8, 1));
        request.setIsRecurring(true);

        when(incomeRepository.save(any(Income.class))).thenAnswer(invocation -> {
            Income saved = invocation.getArgument(0);
            saved.setId(100L);
            return saved;
        });

        IncomeDto result = incomeService.createIncome(request, testUser);

        assertThat(result).isNotNull();
        assertThat(result.getId()).isEqualTo(100L);
        assertThat(result.getAmount()).isEqualByComparingTo("50000.00");
        assertThat(result.getSource()).isEqualTo("Salary");
        assertThat(result.getIsRecurring()).isTrue();
        verify(incomeRepository).save(any(Income.class));
    }

    @Test
    @DisplayName("getUserIncomes → returns list of mapped incomes for user")
    void getUserIncomes_returnsList() {
        Income inc1 = new Income();
        inc1.setId(101L);
        inc1.setAmount(new BigDecimal("1000.00"));
        inc1.setSource("Freelance");
        inc1.setUser(testUser);

        when(incomeRepository.findByUser(testUser)).thenReturn(List.of(inc1));

        List<IncomeDto> list = incomeService.getUserIncomes(testUser);

        assertThat(list).hasSize(1);
        assertThat(list.get(0).getId()).isEqualTo(101L);
        assertThat(list.get(0).getSource()).isEqualTo("Freelance");
    }

    @Test
    @DisplayName("updateIncome → updates non-null fields when user owns record")
    void updateIncome_success() {
        Income existing = new Income();
        existing.setId(102L);
        existing.setAmount(new BigDecimal("2000.00"));
        existing.setSource("Bonus");
        existing.setUser(testUser);

        when(incomeRepository.findById(102L)).thenReturn(Optional.of(existing));
        when(incomeRepository.save(any(Income.class))).thenAnswer(invocation -> invocation.getArgument(0));

        IncomeRequest updateReq = new IncomeRequest();
        updateReq.setAmount(new BigDecimal("3000.00"));
        updateReq.setDescription("Performance Bonus");

        IncomeDto result = incomeService.updateIncome(102L, updateReq, testUser);

        assertThat(result.getAmount()).isEqualByComparingTo("3000.00");
        assertThat(result.getDescription()).isEqualTo("Performance Bonus");
        assertThat(result.getSource()).isEqualTo("Bonus");
        verify(incomeRepository).save(existing);
    }

    @Test
    @DisplayName("updateIncome → throws exception if user does not own record")
    void updateIncome_unauthorized_throwsException() {
        Income existing = new Income();
        existing.setId(102L);
        existing.setUser(otherUser);

        when(incomeRepository.findById(102L)).thenReturn(Optional.of(existing));

        IncomeRequest updateReq = new IncomeRequest();
        updateReq.setAmount(new BigDecimal("3000.00"));

        assertThatThrownBy(() -> incomeService.updateIncome(102L, updateReq, testUser))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Income does not belong to this user");
    }

    @Test
    @DisplayName("deleteIncome → deletes when user owns record")
    void deleteIncome_success() {
        Income existing = new Income();
        existing.setId(103L);
        existing.setUser(testUser);

        when(incomeRepository.findById(103L)).thenReturn(Optional.of(existing));

        incomeService.deleteIncome(103L, testUser);

        verify(incomeRepository).delete(existing);
    }

    @Test
    @DisplayName("deleteIncome → throws exception when income does not belong to user")
    void deleteIncome_wrongUser_throwsException() {
        Income existing = new Income();
        existing.setId(103L);
        existing.setUser(otherUser);

        when(incomeRepository.findById(103L)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> incomeService.deleteIncome(103L, testUser))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Income does not belong to this user");
    }

    @Test
    @DisplayName("getCashFlowSummary → calculates total income, expenses, net savings and savings rate")
    void getCashFlowSummary_calculatesCorrectly() {
        LocalDate start = LocalDate.of(2026, 8, 1);
        LocalDate end = LocalDate.of(2026, 8, 31);

        Income inc1 = new Income();
        inc1.setAmount(new BigDecimal("10000.00"));
        Income inc2 = new Income();
        inc2.setAmount(new BigDecimal("5000.00"));

        Expense exp1 = new Expense();
        exp1.setAmount(new BigDecimal("4500.00"));
        Expense exp2 = new Expense();
        exp2.setAmount(new BigDecimal("1500.00"));

        when(incomeRepository.findByUserAndIncomeDateBetween(eq(testUser), eq(start), eq(end)))
                .thenReturn(List.of(inc1, inc2));
        when(expenseRepository.findByUserAndExpenseDateBetween(eq(testUser), eq(start), eq(end)))
                .thenReturn(List.of(exp1, exp2));

        CashFlowSummaryDto summary = incomeService.getCashFlowSummary(testUser, 2026, 8);

        assertThat(summary.getYear()).isEqualTo(2026);
        assertThat(summary.getMonth()).isEqualTo(8);
        assertThat(summary.getTotalIncome()).isEqualByComparingTo("15000.00");
        assertThat(summary.getTotalExpense()).isEqualByComparingTo("6000.00");
        assertThat(summary.getNetSavings()).isEqualByComparingTo("9000.00");
        assertThat(summary.getSavingsRate()).isEqualTo(60.0);
        assertThat(summary.getIncomeCount()).isEqualTo(2);
        assertThat(summary.getExpenseCount()).isEqualTo(2);
    }
}
