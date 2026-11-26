package com.example.expensetracker.domain.report.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.example.expensetracker.domain.budget.repository.BudgetRepository;
import com.example.expensetracker.domain.expense.repository.ExpenseRepository;
import com.example.expensetracker.domain.expense.repository.RecurringExpenseRepository;
import com.example.expensetracker.domain.goal.repository.SavingsGoalRepository;
import com.example.expensetracker.domain.income.model.Income;
import com.example.expensetracker.domain.income.repository.IncomeRepository;
import com.example.expensetracker.domain.user.model.User;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("Range reports place incomes by the month they count toward")
class ExecutiveReportServiceImplEffectiveMonthTest {

    private IncomeRepository incomes;
    private ExecutiveReportServiceImpl service;
    private User user;

    @BeforeEach
    void setUp() {
        incomes = mock(IncomeRepository.class);
        service = new ExecutiveReportServiceImpl(
                mock(ExpenseRepository.class), incomes, mock(SavingsGoalRepository.class),
                mock(RecurringExpenseRepository.class), mock(BudgetRepository.class));
        user = new User();
        user.setId(5L);
    }

    private static Income income(String amount, LocalDate credited, String countsTowardMonth) {
        Income i = new Income();
        i.setAmount(new BigDecimal(amount));
        i.setSource("Salary");
        i.setIncomeDate(credited);
        i.setCountsTowardMonth(countsTowardMonth);
        return i;
    }

    @Test
    @DisplayName("a salary credited early belongs to the later month's range, and one pushed out does not")
    void effectiveMonthDecidesRangeMembership() {
        Income earlyCredit = income("78000", LocalDate.of(2026, 8, 28), "2026-09");
        Income ordinary = income("1000", LocalDate.of(2026, 9, 5), null);
        Income pushedToOctober = income("2000", LocalDate.of(2026, 9, 29), "2026-10");
        when(incomes.findByUserAndIncomeDateBetween(eq(user), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(List.of(earlyCredit, ordinary, pushedToOctober));

        ExecutiveReportData data = service.loadReportData(user, ExecutiveReportDateRange.of("2026-09-01", "2026-09-30"));

        assertEquals(2, data.incomes.size());
        assertTrue(data.incomes.contains(earlyCredit), "credited in August, counts toward September");
        assertTrue(data.incomes.contains(ordinary));
        assertFalse(data.incomes.contains(pushedToOctober), "credited in September, counts toward October");
    }

    @Test
    @DisplayName("without a range every income is returned unfiltered")
    void unboundedRangeReturnsEverything() {
        List<Income> all = List.of(income("1", LocalDate.of(2026, 1, 1), null));
        when(incomes.findByUser(user)).thenReturn(all);

        ExecutiveReportData data = service.loadReportData(user, ExecutiveReportDateRange.of(null, null));

        assertEquals(all, data.incomes);
    }
}
