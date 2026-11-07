package com.example.expensetracker.service.report;

import com.example.expensetracker.mapper.IncomeRules;
import com.example.expensetracker.model.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Domain projection aggregating complete ledger history for reporting and export.
 * Exposes both immutable public fields and accessor methods for generator compatibility.
 */
public class ExecutiveReportData {

    public final List<Expense> expenses;
    public final List<Income> incomes;
    public final List<SavingsGoal> savingsGoals;
    public final List<RecurringExpense> subscriptions;
    public final List<Budget> budgets;

    public ExecutiveReportData(
            List<Expense> expenses,
            List<Income> incomes,
            List<SavingsGoal> savingsGoals,
            List<RecurringExpense> subscriptions,
            List<Budget> budgets) {
        this.expenses = expenses != null ? expenses : Collections.emptyList();
        this.incomes = incomes != null ? incomes : Collections.emptyList();
        this.savingsGoals = savingsGoals != null ? savingsGoals : Collections.emptyList();
        this.subscriptions = subscriptions != null ? subscriptions : Collections.emptyList();
        this.budgets = budgets != null ? budgets : Collections.emptyList();
    }

    public List<Expense> expenses() { return expenses; }
    public List<Income> incomes() { return incomes; }
    public List<SavingsGoal> savingsGoals() { return savingsGoals; }
    public List<RecurringExpense> subscriptions() { return subscriptions; }
    public List<Budget> budgets() { return budgets; }

    public static BigDecimal nz(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    public static BigDecimal total(List<Expense> values) {
        return values.stream().map(x -> nz(x.getAmount())).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public static String fmt(BigDecimal value) {
        if (value == null) return "0.00";
        return String.format(Locale.US, "%,.2f", value);
    }

    public static String categoryName(Category cat) {
        if (cat == null) {
            return "Uncategorized";
        }
        try {
            String name = cat.getName();
            return (name != null && !name.isBlank()) ? name : "Uncategorized";
        } catch (Exception ex) {
            return "Uncategorized";
        }
    }

    /**
     * Money handed back (reimbursements and refunds): not income, it reduces what was spent.
     */
    public BigDecimal reimbursed() {
        return incomes.stream()
                .filter(x -> IncomeRules.effectiveKind(x) == IncomeKind.REIMBURSEMENT)
                .map(x -> nz(x.getAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /**
     * Spending net of money that came back; never below zero.
     */
    public BigDecimal spend() {
        return total(expenses).subtract(reimbursed()).max(BigDecimal.ZERO);
    }

    /**
     * Real income only: reimbursements are excluded.
     */
    public BigDecimal income() {
        return incomes.stream()
                .filter(x -> IncomeRules.effectiveKind(x) != IncomeKind.REIMBURSEMENT)
                .map(x -> nz(x.getAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public List<String> insights(BigDecimal spend, BigDecimal income, String symbol) {
        String top = expenses.stream()
                .collect(Collectors.groupingBy(
                        x -> categoryName(x.getCategory()),
                        Collectors.mapping(x -> nz(x.getAmount()),
                                Collectors.reducing(BigDecimal.ZERO, BigDecimal::add))))
                .entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse("No expense data");
        BigDecimal avg = expenses.isEmpty()
                ? BigDecimal.ZERO
                : spend.divide(BigDecimal.valueOf(expenses.size()), 2, RoundingMode.HALF_UP);

        BigDecimal salaryInflow = incomes.stream()
                .filter(i -> IncomeRules.effectiveKind(i) == IncomeKind.SALARY)
                .map(i -> nz(i.getAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        String salaryInsight = salaryInflow.compareTo(BigDecimal.ZERO) > 0
                ? "Salary coverage: " + (spend.compareTo(BigDecimal.ZERO) > 0
                    ? Math.round(salaryInflow.divide(spend, 4, RoundingMode.HALF_UP).doubleValue() * 100) + "% of total spend."
                    : "100% (Surplus)")
                : "No primary salary income recorded.";

        BigDecimal totalSavings = savingsGoals.stream()
                .map(g -> nz(g.getCurrentAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        String runwayInsight = (spend.compareTo(BigDecimal.ZERO) > 0 && totalSavings.compareTo(BigDecimal.ZERO) > 0)
                ? "Emergency runway: " + String.format(Locale.US, "%.1f", totalSavings.divide(spend, 2, RoundingMode.HALF_UP).doubleValue()) + " months at current outflow rate."
                : "Emergency reserve: " + symbol + " " + fmt(totalSavings) + " saved.";

        List<String> list = new ArrayList<>();
        list.add("Largest expense category: " + top + ".");
        list.add("Average expense per transaction: " + symbol + " " + fmt(avg) + ".");
        list.add(income.compareTo(spend) >= 0
                ? "Cash flow is positive for the selected period (+ " + symbol + " " + fmt(income.subtract(spend)) + ")."
                : "Spending exceeded recorded income by " + symbol + " " + fmt(spend.subtract(income)) + ".");
        list.add(salaryInsight);
        list.add(runwayInsight);
        if (!savingsGoals.isEmpty()) {
            list.add(savingsGoals.size() + " savings milestone target(s) actively configured.");
        }
        if (!subscriptions.isEmpty()) {
            list.add(subscriptions.size() + " active recurring subscription commitment(s) monitored.");
        }
        return list;
    }
}
