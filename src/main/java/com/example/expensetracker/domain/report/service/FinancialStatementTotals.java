package com.example.expensetracker.domain.report.service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;

import com.example.expensetracker.domain.expense.model.Expense;
import com.example.expensetracker.domain.income.mapper.IncomeRules;
import com.example.expensetracker.domain.income.model.Income;
import com.example.expensetracker.domain.income.model.IncomeKind;

/** Shared financial totals used by the spreadsheet and PDF statement renderers. */
public record FinancialStatementTotals(
        BigDecimal earnedIncome,
        BigDecimal reimbursements,
        BigDecimal expenses
) {

    public static FinancialStatementTotals calculate(List<Expense> expenses, List<Income> incomes) {
        BigDecimal earnedIncome = BigDecimal.ZERO;
        BigDecimal reimbursements = BigDecimal.ZERO;
        for (Income income : incomes) {
            if (income == null || income.getAmount() == null) {
                continue;
            }
            if (IncomeRules.effectiveKind(income) == IncomeKind.REIMBURSEMENT) {
                reimbursements = reimbursements.add(income.getAmount());
            } else {
                earnedIncome = earnedIncome.add(income.getAmount());
            }
        }

        BigDecimal expenseTotal = expenses.stream()
                .map(Expense::getAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .subtract(reimbursements)
                .max(BigDecimal.ZERO);
        return new FinancialStatementTotals(earnedIncome, reimbursements, expenseTotal);
    }

    public BigDecimal netSavings() {
        return earnedIncome.subtract(expenses);
    }
}
