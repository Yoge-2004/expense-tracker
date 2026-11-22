package com.example.expensetracker.domain.report.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.NavigableMap;
import java.util.Set;
import java.util.TreeMap;

import org.springframework.stereotype.Component;

import com.example.expensetracker.domain.budget.model.Budget;
import com.example.expensetracker.domain.expense.model.Expense;
import com.example.expensetracker.domain.goal.model.SavingsGoal;
import com.example.expensetracker.domain.income.model.Income;
import com.example.expensetracker.domain.user.model.User;

/** Builds reusable, presentation-independent metrics for financial statement exports. */
@Component
public class FinancialStatementAnalysisService {

    private static final double DAYS_PER_MONTH = 30.4;
    private static final Set<String> NEEDS_KEYWORDS = Set.of(
            "food", "groceries", "grocery", "rent", "housing", "mortgage", "utilities", "utility",
            "electric", "electricity", "water", "gas", "internet", "transport", "transportation",
            "fuel", "petrol", "diesel", "health", "medical", "medicine", "doctor", "insurance",
            "education", "loan", "emi", "tax", "bills", "bill"
    );

    private final Clock clock;

    public FinancialStatementAnalysisService(Clock clock) {
        this.clock = clock;
    }

    public FinancialStatementAnalysis analyze(User user, String preferredCurrency,
                                              List<Expense> expenses, List<Income> incomes,
                                              List<SavingsGoal> savingsGoals, List<Budget> budgets) {
        CurrencyFormats.Metadata currency = CurrencyFormats.resolve(preferredCurrency, user);
        FinancialStatementTotals totals = FinancialStatementTotals.calculate(expenses, incomes);
        double incomeTotal = totals.earnedIncome().doubleValue();
        double expenseTotal = totals.expenses().doubleValue();
        double netSurplus = incomeTotal - expenseTotal;
        double savingsRate = incomeTotal > 0 ? Math.max(0.0, netSurplus / incomeTotal) : 0.0;

        Map<String, Double> budgetByCategory = budgetLimits(budgets);
        Map<String, Double> categoryTotals = new LinkedHashMap<>();
        NavigableMap<LocalDate, Double> dailyAmounts = new TreeMap<>();
        double needsSpend = 0.0;
        double wantsSpend = 0.0;
        double recurringSpend = 0.0;

        for (Expense expense : expenses) {
            if (expense == null) {
                continue;
            }

            double amount = expense.getAmount() == null ? 0.0 : expense.getAmount().doubleValue();
            String categoryName = expense.getCategory() == null ? null : expense.getCategory().getName();
            String categoryKey = categoryName == null || categoryName.isBlank()
                    ? "Uncategorized" : categoryName;
            categoryTotals.merge(categoryKey, amount, Double::sum);

            LocalDate expenseDate = expense.getExpenseDate();
            if (expenseDate != null) {
                dailyAmounts.merge(expenseDate, amount, Double::sum);
            }

            if (expense.isRecurring()) {
                recurringSpend += amount;
            }

            String normalizedCategory = categoryName == null ? "" : categoryName.toLowerCase(Locale.ROOT);
            if (NEEDS_KEYWORDS.stream().anyMatch(normalizedCategory::contains)) {
                needsSpend += amount;
            } else {
                wantsSpend += amount;
            }
        }

        if (categoryTotals.isEmpty()) {
            categoryTotals.put("General Expenses", 0.0);
        }

        LocalDate today = LocalDate.now(clock);
        if (dailyAmounts.isEmpty()) {
            dailyAmounts.put(today.minusDays(2), 0.0);
            dailyAmounts.put(today.minusDays(1), 0.0);
            dailyAmounts.put(today, 0.0);
        }
        int activeDays = Math.max(1,
                Math.toIntExact(ChronoUnit.DAYS.between(dailyAmounts.firstKey(), dailyAmounts.lastKey()) + 1));
        double dailyBurn = expenseTotal / activeDays;
        double runwayDays = dailyBurn > 0
                ? (netSurplus > 0 ? netSurplus / dailyBurn : 0.0)
                : Double.POSITIVE_INFINITY;
        double runwayMonths = Double.isInfinite(runwayDays) ? Double.POSITIVE_INFINITY : runwayDays / DAYS_PER_MONTH;

        double allocated = expenseTotal + Math.max(0.0, netSurplus);
        if (allocated <= 0.0) {
            allocated = 1.0;
        }
        FinancialStatementAnalysis.Allocation allocation = new FinancialStatementAnalysis.Allocation(
                needsSpend,
                wantsSpend,
                needsSpend / allocated,
                wantsSpend / allocated,
                Math.max(0.0, netSurplus) / allocated
        );

        int healthScore = calculateHealthScore(savingsRate, expenseTotal, budgetByCategory,
                recurringSpend, runwayDays);
        FinancialStatementAnalysis.Health health = healthFor(healthScore);
        FinancialStatementAnalysis.CategoryAnalysis categoryAnalysis = analyzeCategories(categoryTotals, expenseTotal, currency);
        FinancialStatementAnalysis.GoalProgress goals = analyzeGoals(savingsGoals);
        FinancialStatementAnalysis.Recommendations recommendations = recommendations(
                currency, categoryAnalysis, allocation, netSurplus, dailyBurn, runwayDays, runwayMonths, goals);

        NavigableMap<String, Double> dailyTotals = new TreeMap<>();
        dailyAmounts.forEach((date, amount) -> dailyTotals.put(date.toString(), amount));
        return new FinancialStatementAnalysis(
                currency,
                totals,
                new FinancialStatementAnalysis.BudgetAnalysis(budgetByCategory,
                        budgetByCategory.values().stream().mapToDouble(Double::doubleValue).sum()),
                categoryAnalysis,
                new FinancialStatementAnalysis.CashFlow(
                        dailyTotals, activeDays, incomeTotal, expenseTotal, netSurplus, savingsRate,
                        dailyBurn, dailyBurn * DAYS_PER_MONTH, runwayDays, runwayMonths),
                allocation,
                health,
                goals,
                recommendations
        );
    }

    private Map<String, Double> budgetLimits(List<Budget> budgets) {
        Map<String, Double> limits = new HashMap<>();
        for (Budget budget : budgets) {
            if (budget != null && budget.getCategory() != null && budget.getCategory().getName() != null
                    && budget.getLimitAmount() != null) {
                limits.put(budget.getCategory().getName(), budget.getLimitAmount().doubleValue());
            }
        }
        return limits;
    }

    private int calculateHealthScore(double savingsRate, double expenseTotal,
                                     Map<String, Double> budgetByCategory,
                                     double recurringSpend, double runwayDays) {
        int score = 50;
        if (savingsRate >= 0.30) score += 30;
        else if (savingsRate >= 0.20) score += 25;
        else if (savingsRate >= 0.10) score += 15;
        else if (savingsRate > 0.0) score += 5;
        else score -= 15;

        double totalBudget = budgetByCategory.values().stream().mapToDouble(Double::doubleValue).sum();
        if (totalBudget > 0) {
            double utilization = expenseTotal / totalBudget;
            if (utilization <= 0.80) score += 25;
            else if (utilization <= 1.0) score += 15;
            else score -= 20;
        } else {
            score += 15;
        }

        double recurringRatio = expenseTotal > 0 ? recurringSpend / expenseTotal : 0.0;
        if (recurringRatio <= 0.40) score += 25;
        else if (recurringRatio <= 0.60) score += 15;
        else score -= 10;

        if (runwayDays >= 90) score += 20;
        else if (runwayDays >= 30) score += 12;
        else if (runwayDays > 0) score += 5;
        else score -= 10;
        return Math.clamp(score, 15, 99);
    }

    private FinancialStatementAnalysis.Health healthFor(int score) {
        if (score >= 85) return new FinancialStatementAnalysis.Health(score, "GRADE A+", "EXCEPTIONAL CAPITAL EFFICIENCY");
        if (score >= 70) return new FinancialStatementAnalysis.Health(score, "GRADE A", "ROBUST FINANCIAL STABILITY");
        if (score >= 55) return new FinancialStatementAnalysis.Health(score, "GRADE B", "MODERATE - CONTROLLED EXPOSURE");
        if (score >= 40) return new FinancialStatementAnalysis.Health(score, "GRADE C", "VULNERABLE - BUDGET ELEVATED");
        return new FinancialStatementAnalysis.Health(score, "GRADE D", "CRITICAL DEFICIT - ACTION REQUIRED");
    }

    private FinancialStatementAnalysis.CategoryAnalysis analyzeCategories(
            Map<String, Double> categoryTotals, double expenseTotal, CurrencyFormats.Metadata currency) {
        List<Map.Entry<String, Double>> sortedCategories = categoryTotals.entrySet().stream()
                .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .map(entry -> Map.entry(entry.getKey(), entry.getValue()))
                .toList();

        double runningTotal = 0.0;
        Map<String, String> paretoTiers = new HashMap<>();
        for (Map.Entry<String, Double> entry : sortedCategories) {
            runningTotal += entry.getValue();
            double cumulativeShare = expenseTotal > 0 ? runningTotal / expenseTotal : 0.0;
            paretoTiers.put(entry.getKey(), cumulativeShare <= 0.80
                    ? "TIER A (VITAL FEW — PARETO 80%)" : "TIER B (USEFUL MANY)");
        }

        String leadingCategory = sortedCategories.isEmpty() ? "General" : sortedCategories.getFirst().getKey();
        double leadingSpend = sortedCategories.isEmpty() ? 0.0 : sortedCategories.getFirst().getValue();
        double share = expenseTotal > 0 ? leadingSpend / expenseTotal * 100.0 : 0.0;
        return new FinancialStatementAnalysis.CategoryAnalysis(
                sortedCategories, paretoTiers, leadingCategory, leadingSpend, share, leadingSpend * 0.10);
    }

    private FinancialStatementAnalysis.GoalProgress analyzeGoals(List<SavingsGoal> savingsGoals) {
        double target = 0.0;
        double saved = 0.0;
        for (SavingsGoal goal : savingsGoals) {
            if (goal == null) continue;
            if (goal.getTargetAmount() != null) target += goal.getTargetAmount().doubleValue();
            if (goal.getCurrentAmount() != null) saved += goal.getCurrentAmount().doubleValue();
        }
        double progress = target > 0 ? saved / target * 100.0 : 0.0;
        return new FinancialStatementAnalysis.GoalProgress(target, saved, progress);
    }

    private FinancialStatementAnalysis.Recommendations recommendations(
            CurrencyFormats.Metadata currency,
            FinancialStatementAnalysis.CategoryAnalysis categories,
            FinancialStatementAnalysis.Allocation allocation,
            double netSurplus,
            double dailyBurn,
            double runwayDays,
            double runwayMonths,
            FinancialStatementAnalysis.GoalProgress goals) {
        String costOptimization = String.format(Locale.US,
                "Cost Optimization Priority: '%s' is your largest cost driver, consuming %.1f%% of expenditures (%s %,.2f). "
                        + "Trimming 10%% will redirect %s %,.2f/month back into capital surplus.",
                categories.leadingCategory(), categories.leadingCategorySharePercent(), currency.symbol(),
                categories.leadingCategorySpend(), currency.symbol(), categories.potentialMonthlySaving());

        String liquidity = Double.isInfinite(runwayDays)
                ? String.format(Locale.US,
                        "Liquidity & Survival Runway: At your current burn velocity of %s %,.2f/day, "
                                + "your net surplus of %s %,.2f provides effectively unlimited reserves (∞ days) "
                                + "since net burn is zero or negative.",
                        currency.symbol(), dailyBurn, currency.symbol(), Math.max(0.0, netSurplus))
                : String.format(Locale.US,
                        "Liquidity & Survival Runway: At your current burn velocity of %s %,.2f/day, "
                                + "your net surplus of %s %,.2f provides %.0f days (%.1f months) of reserves buffer.",
                        currency.symbol(), dailyBurn, currency.symbol(), Math.max(0.0, netSurplus), runwayDays, runwayMonths);

        String allocationText;
        if (allocation.wantsPercent() > 0.35) {
            allocationText = String.format(Locale.US,
                    "50/30/20 Macro Allocation Alert: Discretionary lifestyle 'Wants' consume %.1f%% of capital "
                            + "(exceeding the 30%% guideline by %.1f%%). Curbing non-essential outflow accelerates compounding.",
                    allocation.wantsPercent() * 100.0, (allocation.wantsPercent() - 0.30) * 100.0);
        } else if (allocation.savingsPercent() >= 0.20) {
            allocationText = String.format(Locale.US,
                    "50/30/20 Macro Allocation Optimal: Capital savings rate is %.1f%% "
                            + "(exceeding the 20%% target by +%.1f%%). Outstanding capital accumulation discipline.",
                    allocation.savingsPercent() * 100.0, (allocation.savingsPercent() - 0.20) * 100.0);
        } else {
            allocationText = String.format(Locale.US,
                    "50/30/20 Macro Allocation Deficit: Capital savings rate is currently %.1f%% "
                            + "(below recommended 20%% target). Aim to trim discretionary spend to close %.1f%% gap.",
                    allocation.savingsPercent() * 100.0, (0.20 - allocation.savingsPercent()) * 100.0);
        }

        String goalsText = goals.targetAmount() > 0
                ? String.format(Locale.US,
                        "Savings Goals Trajectory: Accumulated %s %,.2f toward total goal targets of %s %,.2f "
                                + "(%.1f%% achieved). Current retention pace supports continuous goal funding.",
                        currency.symbol(), goals.savedAmount(), currency.symbol(), goals.targetAmount(), goals.percentComplete())
                : "Savings Strategy Recommendation: No active savings goals detected. Establish defined capital targets "
                        + "(Emergency Reserve, Asset Investment) to maximize wealth growth.";
        return new FinancialStatementAnalysis.Recommendations(costOptimization, liquidity, allocationText, goalsText);
    }
}
