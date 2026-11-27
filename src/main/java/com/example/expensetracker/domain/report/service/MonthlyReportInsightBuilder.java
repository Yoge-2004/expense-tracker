package com.example.expensetracker.domain.report.service;

import org.springframework.stereotype.Component;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.Month;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import com.example.expensetracker.domain.budget.model.Budget;
import com.example.expensetracker.domain.expense.dto.ExpenseDto;
import com.example.expensetracker.domain.expense.mapper.ExpenseMapper;
import com.example.expensetracker.domain.expense.model.Expense;
import com.example.expensetracker.domain.goal.dto.SavingsGoalDto;
import com.example.expensetracker.domain.goal.mapper.SavingsGoalMapper;
import com.example.expensetracker.domain.goal.model.SavingsGoal;
import com.example.expensetracker.domain.income.dto.IncomeDto;
import com.example.expensetracker.domain.income.mapper.IncomeMapper;
import com.example.expensetracker.domain.income.mapper.IncomeRules;
import com.example.expensetracker.domain.income.model.Income;
import com.example.expensetracker.domain.income.model.IncomeKind;
import com.example.expensetracker.domain.report.dto.MonthlyReportDto;
import com.example.expensetracker.domain.user.model.User;

/**
 * Pure domain calculator responsible for aggregating monthly transactions,
 * budget utilization, savings milestones, and narrative financial insights
 * into a {@link MonthlyReportDto}.
 *
 * <p>Separated from {@link MonthlyReportServiceImpl} to satisfy the Single
 * Responsibility Principle (SRP) and keep calculation logic independent of persistence,
 * email delivery, and scheduling infrastructure.</p>
 */
@Component
public class MonthlyReportInsightBuilder {

    /**
     * Computes a full monthly report DTO and narrative insights from already-loaded domain records.
     *
     * @param user         target user
     * @param year         target calendar year
     * @param month        target calendar month (1-12)
     * @param expenses     expenses within the month
     * @param incomes      incomes whose effective month matches {@code year}-{@code month}
     * @param savingsGoals user's savings goals
     * @param budgets      user's configured budgets
     * @return assembled {@link MonthlyReportDto}
     */
    public MonthlyReportDto buildReport(
            User user,
            int year,
            int month,
            List<Expense> expenses,
            List<Income> incomes,
            List<SavingsGoal> savingsGoals,
            List<Budget> budgets) {
        LocalDate startDate = LocalDate.of(year, month, 1);

        List<Income> reimbursements = incomes.stream()
                .filter(i -> IncomeRules.effectiveKind(i) == IncomeKind.REIMBURSEMENT)
                .toList();
        List<Income> earned = incomes.stream()
                .filter(i -> IncomeRules.effectiveKind(i) != IncomeKind.REIMBURSEMENT)
                .toList();

        BigDecimal grossOutflow = expenses.stream()
                .map(Expense::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalReimbursed = reimbursements.stream()
                .map(Income::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalOutflow = grossOutflow.subtract(totalReimbursed).max(BigDecimal.ZERO);
        BigDecimal totalIncome = earned.stream()
                .map(Income::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal netCashFlow = totalIncome.subtract(totalOutflow);
        double savingsRate = calculateSavingsRate(totalIncome, netCashFlow);

        int daysInMonth = startDate.lengthOfMonth();
        BigDecimal dailyAverage = daysInMonth > 0 && totalOutflow.compareTo(BigDecimal.ZERO) > 0
                ? totalOutflow.divide(BigDecimal.valueOf(daysInMonth), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        BigDecimal recurringTotal = expenses.stream()
                .filter(Expense::isRecurring)
                .map(Expense::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Expense highestExpense = expenses.stream()
                .max(Comparator.comparing(Expense::getAmount))
                .orElse(null);
        BigDecimal highestExpenseAmount = highestExpense != null ? highestExpense.getAmount() : BigDecimal.ZERO;
        String highestExpenseDescription = highestExpense != null ? highestExpense.getDescription() : "None";

        List<MonthlyReportDto.CategoryReportDto> categoryBreakdown =
                buildCategoryBreakdown(expenses, reimbursements);

        Map<String, BigDecimal> categorySums = new HashMap<>();
        for (MonthlyReportDto.CategoryReportDto entry : categoryBreakdown) {
            categorySums.put(entry.categoryName(), entry.totalAmount());
        }

        List<MonthlyReportDto.BudgetReportDto> budgetStatuses = buildBudgetStatuses(budgets, categorySums);
        int withinBudgetCount = (int) budgetStatuses.stream().filter(b -> !b.isExceeded()).count();
        int budgetHealthScore = budgets.isEmpty()
                ? 100
                : (int) Math.round(((double) withinBudgetCount / budgets.size()) * 100.0);

        List<ExpenseDto> topExpenses = expenses.stream()
                .sorted(Comparator.comparing(Expense::getAmount).reversed())
                .limit(5)
                .map(ExpenseMapper::toDto)
                .toList();

        List<IncomeDto> incomeDtos = incomes.stream()
                .sorted(Comparator.comparing(Income::getIncomeDate).reversed())
                .map(IncomeMapper::toDto)
                .toList();

        List<SavingsGoalDto> goalDtos = savingsGoals.stream()
                .map(SavingsGoalMapper::toDto)
                .toList();

        String userCurrency = user.getCurrency() != null ? user.getCurrency() : "INR";
        String monthName = Month.of(month).getDisplayName(TextStyle.FULL, Locale.ENGLISH);
        List<String> insights = buildInsights(
                monthName, userCurrency, totalIncome, netCashFlow, savingsRate,
                totalOutflow, grossOutflow, totalReimbursed, categoryBreakdown,
                budgetStatuses, budgets, savingsGoals, earned, expenses);

        String period = monthName + " " + year;

        return new MonthlyReportDto(
                period,
                year,
                month,
                totalOutflow,
                totalIncome,
                netCashFlow,
                savingsRate,
                userCurrency,
                expenses.size(),
                dailyAverage,
                highestExpenseAmount,
                highestExpenseDescription,
                recurringTotal,
                insights,
                budgetHealthScore,
                categoryBreakdown,
                budgetStatuses,
                topExpenses,
                incomeDtos,
                goalDtos,
                totalReimbursed
        );
    }

    private double calculateSavingsRate(BigDecimal totalIncome, BigDecimal netCashFlow) {
        if (totalIncome.compareTo(BigDecimal.ZERO) <= 0) {
            return 0.0;
        }
        double rate = netCashFlow.divide(totalIncome, 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
                .doubleValue();
        return Math.round(rate * 10.0) / 10.0;
    }

    private List<MonthlyReportDto.CategoryReportDto> buildCategoryBreakdown(
            List<Expense> expenses,
            List<Income> reimbursements) {
        Map<String, BigDecimal> categorySums = new HashMap<>();
        for (Expense expense : expenses) {
            String categoryName = expense.getCategory() != null ? expense.getCategory().getName() : "Uncategorized";
            categorySums.merge(categoryName, expense.getAmount(), BigDecimal::add);
        }

        for (Income reimbursement : reimbursements) {
            if (reimbursement.getReimbursedCategoryId() == null) {
                continue;
            }
            expenses.stream()
                    .filter(e -> e.getCategory() != null
                            && reimbursement.getReimbursedCategoryId().equals(e.getCategory().getId()))
                    .findFirst()
                    .ifPresent(e -> categorySums.computeIfPresent(e.getCategory().getName(),
                            (_, sum) -> sum.subtract(reimbursement.getAmount()).max(BigDecimal.ZERO)));
        }

        double totalDouble = categorySums.values().stream().mapToDouble(BigDecimal::doubleValue).sum();
        List<MonthlyReportDto.CategoryReportDto> categoryBreakdown = new ArrayList<>();
        for (Map.Entry<String, BigDecimal> entry : categorySums.entrySet()) {
            double pct = totalDouble > 0 ? (entry.getValue().doubleValue() / totalDouble) * 100.0 : 0.0;
            categoryBreakdown.add(new MonthlyReportDto.CategoryReportDto(
                    entry.getKey(),
                    entry.getValue(),
                    Math.round(pct * 10.0) / 10.0
            ));
        }
        categoryBreakdown.sort((a, b) -> b.totalAmount().compareTo(a.totalAmount()));
        return categoryBreakdown;
    }

    private List<MonthlyReportDto.BudgetReportDto> buildBudgetStatuses(
            List<Budget> budgets,
            Map<String, BigDecimal> categorySums) {
        List<MonthlyReportDto.BudgetReportDto> budgetStatuses = new ArrayList<>();
        for (Budget budget : budgets) {
            String categoryName = budget.getCategory() != null ? budget.getCategory().getName() : "General";
            BigDecimal spent = categorySums.getOrDefault(categoryName, BigDecimal.ZERO);
            BigDecimal limit = budget.getLimitAmount();
            double pct = limit.compareTo(BigDecimal.ZERO) > 0
                    ? (spent.doubleValue() / limit.doubleValue()) * 100.0
                    : 0.0;
            budgetStatuses.add(new MonthlyReportDto.BudgetReportDto(
                    categoryName,
                    limit,
                    spent,
                    Math.round(pct * 10.0) / 10.0
            ));
        }
        budgetStatuses.sort((a, b) -> Double.compare(b.usagePercentage(), a.usagePercentage()));
        return budgetStatuses;
    }

    private List<String> buildInsights(
            String monthName,
            String userCurrency,
            BigDecimal totalIncome,
            BigDecimal netCashFlow,
            double savingsRate,
            BigDecimal totalOutflow,
            BigDecimal grossOutflow,
            BigDecimal totalReimbursed,
            List<MonthlyReportDto.CategoryReportDto> categoryBreakdown,
            List<MonthlyReportDto.BudgetReportDto> budgetStatuses,
            List<Budget> budgets,
            List<SavingsGoal> savingsGoals,
            List<Income> earned,
            List<Expense> expenses) {
        List<String> insights = new ArrayList<>();

        if (totalIncome.compareTo(BigDecimal.ZERO) > 0 && netCashFlow.compareTo(BigDecimal.ZERO) >= 0) {
            insights.add(String.format("You generated a net positive savings rate of %.1f%% in %s.",
                    savingsRate, monthName));
        } else if (netCashFlow.compareTo(BigDecimal.ZERO) < 0) {
            insights.add(String.format("Expenses exceeded income in %s resulting in a deficit of %s.",
                    monthName, netCashFlow.abs()));
        }

        if (!categoryBreakdown.isEmpty()) {
            MonthlyReportDto.CategoryReportDto topCat = categoryBreakdown.getFirst();
            insights.add(String.format("Top spending category was '%s' absorbing %.1f%% of all outflows.",
                    topCat.categoryName(), topCat.percentage()));
        }

        long exceededBudgets = budgetStatuses.stream()
                .filter(MonthlyReportDto.BudgetReportDto::isExceeded)
                .count();
        if (exceededBudgets > 0) {
            insights.add(String.format("%d budget limit%s exceeded during %s.",
                    exceededBudgets, exceededBudgets > 1 ? "s were" : " was", monthName));
        } else if (!budgets.isEmpty()) {
            insights.add("Exceptional budget discipline! All categories remained safely within established limits.");
        }

        long completedGoals = savingsGoals.stream()
                .filter(g -> "COMPLETED".equalsIgnoreCase(g.getStatus())
                        || (g.getTargetAmount() != null && g.getCurrentAmount() != null
                        && g.getCurrentAmount().compareTo(g.getTargetAmount()) >= 0))
                .count();
        if (completedGoals > 0) {
            insights.add(String.format("Congratulations! You have %d completed savings milestone%s.",
                    completedGoals, completedGoals > 1 ? "s" : ""));
        }

        BigDecimal salaryTotal = earned.stream()
                .filter(i -> IncomeRules.effectiveKind(i) == IncomeKind.SALARY
                        || (i.getDescription() != null && i.getDescription().toLowerCase(Locale.ROOT).contains("salary")))
                .map(Income::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (salaryTotal.compareTo(BigDecimal.ZERO) > 0 && totalOutflow.compareTo(BigDecimal.ZERO) > 0) {
            double coverage = salaryTotal.divide(totalOutflow, 4, RoundingMode.HALF_UP).doubleValue() * 100.0;
            insights.add(String.format("Salary Coverage: Active monthly salary covered %.1f%% of your total expenditures.",
                    coverage));
        }

        if (totalReimbursed.compareTo(BigDecimal.ZERO) > 0) {
            insights.add(String.format("Reimbursements: %s %s came back this month, so net spending is %s %s instead of %s %s.",
                    userCurrency, totalReimbursed, userCurrency, totalOutflow, userCurrency, grossOutflow));
        }

        BigDecimal totalSaved = savingsGoals.stream()
                .map(g -> g.getCurrentAmount() != null ? g.getCurrentAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (totalOutflow.compareTo(BigDecimal.ZERO) > 0 && totalSaved.compareTo(BigDecimal.ZERO) > 0) {
            double runwayMonths = totalSaved.divide(totalOutflow, 1, RoundingMode.HALF_UP).doubleValue();
            insights.add(String.format(
                    "Emergency Runway: Accumulated savings reserve (%s %s) provides ~%.1f months of runway at your current monthly burn rate.",
                    userCurrency, totalSaved, runwayMonths));
        }

        BigDecimal essentials = expenses.stream()
                .filter(e -> {
                    String cat = e.getCategory() != null ? e.getCategory().getName().toLowerCase(Locale.ROOT) : "";
                    return cat.contains("rent") || cat.contains("grocer") || cat.contains("food")
                            || cat.contains("util") || cat.contains("bill") || cat.contains("medic")
                            || cat.contains("health") || cat.contains("emi") || cat.contains("fuel")
                            || cat.contains("transport");
                })
                .map(Expense::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (grossOutflow.compareTo(BigDecimal.ZERO) > 0 && essentials.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal discretionary = grossOutflow.subtract(essentials).max(BigDecimal.ZERO);
            double essPct = essentials.divide(grossOutflow, 3, RoundingMode.HALF_UP).doubleValue() * 100.0;
            double discPct = 100.0 - essPct;
            insights.add(String.format(
                    "Capital Allocation: Essentials accounted for %.1f%% (%s %s) while discretionary spending represented %.1f%% (%s %s).",
                    essPct, userCurrency, essentials, discPct, userCurrency, discretionary));
        }

        return insights;
    }
}
