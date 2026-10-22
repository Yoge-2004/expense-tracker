package com.example.expensetracker.service.impl;

import com.example.expensetracker.dto.CashFlowForecastDto;
import com.example.expensetracker.dto.FinancialIntelligenceDto;
import com.example.expensetracker.dto.WealthSimulationRequest;
import com.example.expensetracker.dto.WealthSimulationResponse;
import com.example.expensetracker.mapper.IncomeRules;
import com.example.expensetracker.model.*;
import com.example.expensetracker.repository.*;
import com.example.expensetracker.service.FinancialIntelligenceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FinancialIntelligenceServiceImpl implements FinancialIntelligenceService {

    private final UserRepository userRepository;
    private final ExpenseRepository expenseRepository;
    private final IncomeRepository incomeRepository;
    private final BudgetRepository budgetRepository;
    private final RecurringExpenseRepository recurringExpenseRepository;
    private final SavingsGoalRepository savingsGoalRepository;
    private final LoanAdjustmentRepository loanAdjustmentRepository;

    @Override
    public FinancialIntelligenceDto getIntelligenceSnapshot(Long userId) {
        if (userId == null) throw new IllegalArgumentException("User ID cannot be null");
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        LocalDate today = LocalDate.now();
        YearMonth currentYm = YearMonth.from(today);
        int currentDay = Math.max(1, today.getDayOfMonth());
        int daysInMonth = currentYm.lengthOfMonth();
        int daysRemaining = Math.max(1, daysInMonth - currentDay + 1);

        List<Expense> allExpenses = expenseRepository.findByUser(user);
        List<Income> allIncomes = incomeRepository.findByUser(user);
        List<Budget> budgets = budgetRepository.findByUser(user);
        List<RecurringExpense> recurringExpenses = recurringExpenseRepository.findByUser(user);
        List<SavingsGoal> goals = savingsGoalRepository.findByUser(user);
        List<LoanAdjustment> loans = loanAdjustmentRepository.findByUserOrderByAdjustmentDateDescIdDesc(user);

        List<Expense> monthExpenses = allExpenses.stream()
                .filter(e -> e.getExpenseDate() != null && YearMonth.from(e.getExpenseDate()).equals(currentYm))
                .toList();
        List<Income> monthIncomes = allIncomes.stream()
                .filter(i -> currentYm.equals(IncomeRules.effectiveMonth(i)))
                .toList();

        BigDecimal earnedInflow = monthIncomes.stream()
                .filter(i -> IncomeRules.effectiveKind(i) != IncomeKind.REIMBURSEMENT)
                .map(i -> safeAmount(i.getAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal reimbursements = monthIncomes.stream()
                .filter(i -> IncomeRules.effectiveKind(i) == IncomeKind.REIMBURSEMENT)
                .map(i -> safeAmount(i.getAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal rawMonthOutflow = monthExpenses.stream()
                .map(e -> safeAmount(e.getAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal netMonthOutflow = rawMonthOutflow.subtract(reimbursements).max(BigDecimal.ZERO);

        BigDecimal netCashFlow = earnedInflow.subtract(netMonthOutflow);
        double savingsRatePct = earnedInflow.compareTo(BigDecimal.ZERO) > 0
                ? netCashFlow.multiply(BigDecimal.valueOf(100)).divide(earnedInflow, 1, RoundingMode.HALF_UP).doubleValue()
                : 0.0;

        BigDecimal dailyBurnRate = netMonthOutflow.divide(BigDecimal.valueOf(currentDay), 2, RoundingMode.HALF_UP);
        BigDecimal projectedMonthEndSpend = dailyBurnRate.multiply(BigDecimal.valueOf(daysInMonth)).setScale(2, RoundingMode.HALF_UP);

        BigDecimal totalBudgetLimit = budgets.stream().map(b -> safeAmount(b.getLimitAmount())).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal ceiling = totalBudgetLimit.compareTo(BigDecimal.ZERO) > 0 ? totalBudgetLimit : earnedInflow;
        BigDecimal safeDailySpend = ceiling.subtract(netMonthOutflow).max(BigDecimal.ZERO)
                .divide(BigDecimal.valueOf(daysRemaining), 2, RoundingMode.HALF_UP);

        int noSpendStreak = computeNoSpendStreak(monthExpenses, today);

        BigDecimal monthlyRecurringInflow = allIncomes.stream()
                .filter(i -> Boolean.TRUE.equals(i.getIsRecurring()) && IncomeRules.effectiveKind(i) != IncomeKind.REIMBURSEMENT)
                .map(i -> normalizeMonthly(safeAmount(i.getAmount()), i.getFrequency(), i.getIntervalDays()))
                .reduce(BigDecimal.ZERO, BigDecimal::add).setScale(2, RoundingMode.HALF_UP);

        BigDecimal monthlyRecurringOutflow = recurringExpenses.stream()
                .map(r -> normalizeMonthly(safeAmount(r.getAmount()), r.getFrequency(), r.getIntervalDays()))
                .reduce(BigDecimal.ZERO, BigDecimal::add).setScale(2, RoundingMode.HALF_UP);

        double recurringCoverageRatio = monthlyRecurringOutflow.compareTo(BigDecimal.ZERO) > 0
                ? monthlyRecurringInflow.multiply(BigDecimal.valueOf(100)).divide(monthlyRecurringOutflow, 1, RoundingMode.HALF_UP).doubleValue()
                : 100.0;

        Map<String, Integer> subScores = new LinkedHashMap<>();
        int sSav = savingsRatePct >= 30 ? 96 : savingsRatePct >= 20 ? 88 : savingsRatePct >= 10 ? 75 : 58;
        int sBud = totalBudgetLimit.compareTo(BigDecimal.ZERO) <= 0 ? 80 : (netMonthOutflow.compareTo(totalBudgetLimit) <= 0 ? 90 : 52);
        int sSub = earnedInflow.compareTo(BigDecimal.ZERO) <= 0 ? 82 : 90;
        int sRun = 84;
        int sHab = Math.min(100, 65 + noSpendStreak * 7);
        subScores.put("savingsRetention", sSav);
        subScores.put("budgetAdherence", sBud);
        subScores.put("subscriptionEfficiency", sSub);
        subScores.put("runwayResilience", sRun);
        subScores.put("habitDiscipline", sHab);

        int composite = (int) Math.round(sSav * 0.30 + sBud * 0.25 + sSub * 0.20 + sRun * 0.15 + sHab * 0.10);
        String grade = composite >= 90 ? "A+" : composite >= 80 ? "A" : composite >= 70 ? "B" : "C";

        BigDecimal savedTotal = goals.stream().map(g -> safeAmount(g.getCurrentAmount())).reduce(BigDecimal.ZERO, BigDecimal::add);
        List<CashFlowForecastDto> forecast = new ArrayList<>(6);
        BigDecimal cumBase = savedTotal, cumOpt = savedTotal, cumCons = savedTotal;
        for (int i = 1; i <= 6; i++) {
            cumBase = cumBase.add(netCashFlow).setScale(2, RoundingMode.HALF_UP);
            cumOpt = cumOpt.add(netCashFlow.add(netMonthOutflow.multiply(BigDecimal.valueOf(0.15)))).setScale(2, RoundingMode.HALF_UP);
            cumCons = cumCons.add(netCashFlow.subtract(netMonthOutflow.multiply(BigDecimal.valueOf(0.10)))).setScale(2, RoundingMode.HALF_UP);
            forecast.add(new CashFlowForecastDto(currentYm.plusMonths(i).toString(),
                    earnedInflow.setScale(2, RoundingMode.HALF_UP),
                    netMonthOutflow.setScale(2, RoundingMode.HALF_UP),
                    netCashFlow.setScale(2, RoundingMode.HALF_UP),
                    cumBase, cumOpt, cumCons));
        }

        return new FinancialIntelligenceDto(
                composite, grade, subScores,
                earnedInflow.setScale(2, RoundingMode.HALF_UP),
                netMonthOutflow.setScale(2, RoundingMode.HALF_UP),
                netCashFlow.setScale(2, RoundingMode.HALF_UP),
                savingsRatePct, dailyBurnRate, projectedMonthEndSpend, safeDailySpend,
                daysRemaining, noSpendStreak, monthlyRecurringInflow, monthlyRecurringOutflow,
                recurringCoverageRatio, forecast, List.of("Financial telemetry active.")
        );
    }

    @Override
    public WealthSimulationResponse simulateWealthTrajectory(Long userId, WealthSimulationRequest request) {
        FinancialIntelligenceDto snap = getIntelligenceSnapshot(userId);
        User user = userRepository.findById(userId).orElseThrow();
        List<SavingsGoal> goals = savingsGoalRepository.findByUser(user);

        int horizon = (request != null && request.horizonMonths() != null && request.horizonMonths() > 0)
                ? Math.min(60, request.horizonMonths()) : 12;
        BigDecimal cut = request != null ? safeAmount(request.monthlyExpenseCut()).max(BigDecimal.ZERO) : BigDecimal.ZERO;
        BigDecimal inc = request != null ? safeAmount(request.additionalMonthlyIncome()).max(BigDecimal.ZERO) : BigDecimal.ZERO;
        BigDecimal sip = request != null ? safeAmount(request.additionalMonthlySavings()).max(BigDecimal.ZERO) : BigDecimal.ZERO;

        BigDecimal baseSurplus = snap.netCashFlow();
        BigDecimal simSurplus = baseSurplus.add(cut).add(inc).add(sip);
        BigDecimal baseWealth = baseSurplus.multiply(BigDecimal.valueOf(horizon)).setScale(2, RoundingMode.HALF_UP);
        BigDecimal simWealth = simSurplus.multiply(BigDecimal.valueOf(horizon)).setScale(2, RoundingMode.HALF_UP);
        BigDecimal gain = simWealth.subtract(baseWealth).setScale(2, RoundingMode.HALF_UP);

        BigDecimal newInflow = snap.currentMonthInflow().add(inc);
        double simRate = newInflow.compareTo(BigDecimal.ZERO) > 0
                ? simSurplus.multiply(BigDecimal.valueOf(100)).divide(newInflow, 1, RoundingMode.HALF_UP).doubleValue() : 0.0;

        BigDecimal remGoals = goals.stream()
                .map(g -> safeAmount(g.getTargetAmount()).subtract(safeAmount(g.getCurrentAmount())).max(BigDecimal.ZERO))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        int baseMos = (remGoals.compareTo(BigDecimal.ZERO) > 0 && baseSurplus.compareTo(BigDecimal.ZERO) > 0)
                ? remGoals.divide(baseSurplus, 0, RoundingMode.CEILING).intValue() : 0;
        int simMos = (remGoals.compareTo(BigDecimal.ZERO) > 0 && simSurplus.compareTo(BigDecimal.ZERO) > 0)
                ? remGoals.divide(simSurplus, 0, RoundingMode.CEILING).intValue() : 0;

        return new WealthSimulationResponse(
                horizon, baseSurplus.setScale(2, RoundingMode.HALF_UP), simSurplus.setScale(2, RoundingMode.HALF_UP),
                baseWealth, simWealth, gain, simRate, simMos, Math.max(0, baseMos - simMos),
                "Simulated trajectory calculated successfully."
        );
    }

    private static BigDecimal safeAmount(BigDecimal v) { return v != null ? v : BigDecimal.ZERO; }

    private static BigDecimal normalizeMonthly(BigDecimal amt, String freq, Integer days) {
        if (amt == null || amt.compareTo(BigDecimal.ZERO) <= 0) return BigDecimal.ZERO;
        String f = freq != null ? freq.trim().toUpperCase(Locale.ROOT) : "MONTHLY";
        return switch (f) {
            case "DAILY" -> amt.multiply(BigDecimal.valueOf(365)).divide(BigDecimal.valueOf(12), 2, RoundingMode.HALF_UP);
            case "WEEKLY" -> amt.multiply(BigDecimal.valueOf(52)).divide(BigDecimal.valueOf(12), 2, RoundingMode.HALF_UP);
            case "YEARLY" -> amt.divide(BigDecimal.valueOf(12), 2, RoundingMode.HALF_UP);
            default -> amt;
        };
    }

    private static int computeNoSpendStreak(List<Expense> monthExpenses, LocalDate today) {
        Set<LocalDate> spendDays = monthExpenses.stream()
                .filter(e -> !e.isRecurring() && e.getExpenseDate() != null)
                .map(Expense::getExpenseDate).collect(Collectors.toSet());
        int streak = 0;
        LocalDate cur = today, start = today.withDayOfMonth(1);
        while (!cur.isBefore(start) && !spendDays.contains(cur)) {
            streak++;
            cur = cur.minusDays(1);
        }
        return streak;
    }
}
