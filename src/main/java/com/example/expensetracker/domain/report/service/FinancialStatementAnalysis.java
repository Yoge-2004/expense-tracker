package com.example.expensetracker.domain.report.service;

import java.util.List;
import java.util.Map;
import java.util.NavigableMap;

/** Immutable analysis data consumed by financial statement workbook renderers. */
public record FinancialStatementAnalysis(
        CurrencyFormats.Metadata currency,
        FinancialStatementTotals totals,
        BudgetAnalysis budgets,
        CategoryAnalysis categories,
        CashFlow cashFlow,
        Allocation allocation,
        Health health,
        GoalProgress goals,
        Recommendations recommendations
) {
    public record BudgetAnalysis(Map<String, Double> limitsByCategory, double totalLimit) {
        public BudgetAnalysis {
            limitsByCategory = Map.copyOf(limitsByCategory);
        }
    }

    public record CategoryAnalysis(
            List<Map.Entry<String, Double>> sortedTotals,
            Map<String, String> paretoTiers,
            String leadingCategory,
            double leadingCategorySpend,
            double leadingCategorySharePercent,
            double potentialMonthlySaving
    ) {
        public CategoryAnalysis {
            sortedTotals = List.copyOf(sortedTotals);
            paretoTiers = Map.copyOf(paretoTiers);
        }
    }

    public record CashFlow(
            NavigableMap<String, Double> dailyTotals,
            int activeDays,
            double income,
            double expenses,
            double netSurplus,
            double savingsRate,
            double dailyBurn,
            double monthlyBurnRunRate,
            double runwayDays,
            double runwayMonths
    ) {
        public CashFlow {
            dailyTotals = java.util.Collections.unmodifiableNavigableMap(
                    new java.util.TreeMap<>(dailyTotals));
        }
    }

    public record Allocation(
            double needsSpend,
            double wantsSpend,
            double needsPercent,
            double wantsPercent,
            double savingsPercent
    ) {}

    public record Health(int score, String grade, String status) {}

    public record GoalProgress(double targetAmount, double savedAmount, double percentComplete) {}

    public record Recommendations(String costOptimization, String liquidity, String allocation, String goals) {}
}
