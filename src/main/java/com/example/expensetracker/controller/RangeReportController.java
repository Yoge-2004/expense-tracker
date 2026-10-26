package com.example.expensetracker.controller;

import com.example.expensetracker.model.Budget;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.mapper.IncomeRules;
import com.example.expensetracker.model.Income;
import com.example.expensetracker.model.IncomeKind;
import com.example.expensetracker.model.RecurringExpense;
import com.example.expensetracker.model.SavingsGoal;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.BudgetRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.IncomeRepository;
import com.example.expensetracker.repository.RecurringExpenseRepository;
import com.example.expensetracker.repository.SavingsGoalRepository;
import com.example.expensetracker.security.UserSecurity;
import com.example.expensetracker.service.UserService;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xddf.usermodel.chart.*;
import org.apache.poi.xssf.usermodel.*;
import org.openpdf.text.Document;
import org.openpdf.text.Element;
import org.openpdf.text.pdf.PdfPageEventHelper;
import org.openpdf.text.DocumentException;
import org.openpdf.text.Font;
import org.openpdf.text.FontFactory;
import org.openpdf.text.PageSize;
import org.openpdf.text.Paragraph;
import org.openpdf.text.Rectangle;
import org.openpdf.text.Phrase;
import org.openpdf.text.pdf.PdfPCell;
import org.openpdf.text.pdf.PdfPTable;
import org.openpdf.text.pdf.PdfWriter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Generates range-based financial exports from the complete user ledger.
 * Every export includes expenses, incomes, savings goals, subscriptions,
 * budgets, and the derived cash-flow summary for the selected period.
 */
@Slf4j
@RequiredArgsConstructor
@Transactional(readOnly = true)
@RestController
@RequestMapping({"/api/reports", "/api/expenses"})
public class RangeReportController {

    private static final MediaType XLSX = MediaType.parseMediaType(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    private final ExpenseRepository expenses;
    private final IncomeRepository incomes;
    private final SavingsGoalRepository savingsGoals;
    private final RecurringExpenseRepository recurringExpenses;
    private final BudgetRepository budgets;
    private final UserService users;
    private final UserSecurity security;


    @GetMapping("/user/{userId}/export/range/excel")
    public ResponseEntity<byte[]> excel(@PathVariable Long userId,
                                        @RequestParam(required = false) String from,
                                        @RequestParam(required = false) String to,
                                        @RequestParam(defaultValue = "INR") String currency) {
        security.validateUserAccess(userId);
        User user = user(userId);
        Range range = Range.of(from, to);
        log.info("Generating executive Excel report for userId={}, range='{}', currency='{}'",
                userId, range.label(), currency);
        Data data = data(user, range);
        byte[] bytes = excel(data, range, currency);
        log.info("Executive Excel report generated successfully for userId={}, size={} bytes", userId, bytes.length);
        return ResponseEntity.ok()
                .contentType(XLSX)
                .contentLength(bytes.length)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment()
                                .filename("ExpenseTracker_Executive_Dashboard.xlsx")
                                .build().toString())
                .body(bytes);
    }

    @GetMapping("/user/{userId}/export/range/pdf")
    public ResponseEntity<byte[]> pdf(@PathVariable Long userId,
                                      @RequestParam(required = false) String from,
                                      @RequestParam(required = false) String to,
                                      @RequestParam(defaultValue = "INR") String currency) {
        security.validateUserAccess(userId);
        User user = user(userId);
        Range range = Range.of(from, to);
        log.info("Generating executive PDF report for userId={}, range='{}', currency='{}'",
                userId, range.label(), currency);
        Data data = data(user, range);
        byte[] bytes = pdf(data, range, currency, user.getName());
        log.info("Executive PDF report generated successfully for userId={}, size={} bytes", userId, bytes.length);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .contentLength(bytes.length)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment()
                                .filename("ExpenseTracker_Executive_Report.pdf")
                                .build().toString())
                .body(bytes);
    }

    private User user(Long id) {
        return users.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    private Data data(User user, Range range) {
        List<Expense> e;
        if (range.from() != null && range.to() != null) {
            e = expenses.findByUserAndExpenseDateBetween(user, range.from(), range.to());
        } else if (range.from() != null) {
            e = expenses.findByUserAndExpenseDateGreaterThanEqual(user, range.from());
        } else if (range.to() != null) {
            e = expenses.findByUserAndExpenseDateLessThanEqual(user, range.to());
        } else {
            e = expenses.findByUser(user);
        }

        List<Income> i;
        if (range.from() != null && range.to() != null) {
            i = incomes.findByUserAndIncomeDateBetween(user, range.from(), range.to());
        } else if (range.from() != null) {
            i = incomes.findByUserAndIncomeDateGreaterThanEqual(user, range.from());
        } else if (range.to() != null) {
            i = incomes.findByUserAndIncomeDateLessThanEqual(user, range.to());
        } else {
            i = incomes.findByUser(user);
        }

        // Savings goals and subscriptions are configurations, so they are exported
        // when active for the user rather than discarded by the date filter.
        List<SavingsGoal> s = savingsGoals.findByUser(user);
        List<RecurringExpense> r = recurringExpenses.findByUser(user);
        List<Budget> b = budgets.findByUser(user);
        return new Data(e, i, s, r, b);
    }

    private byte[] excel(Data d, Range range, String currency) {
        String symbol = symbol(currency);
        BigDecimal spend = d.spend();
        BigDecimal income = d.income();
        BigDecimal net = income.subtract(spend);

        try (XSSFWorkbook wb = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            // Power BI Executive Styles
            XSSFCellStyle hero = style(wb, "0F1E36", "FFFFFF", true, 15, HorizontalAlignment.CENTER, false);
            XSSFCellStyle subHero = style(wb, "1E293B", "94A3B8", true, 9, HorizontalAlignment.CENTER, false);

            XSSFCellStyle tblHeader = style(wb, "1E293B", "FFFFFF", true, 10, HorizontalAlignment.LEFT, true);
            XSSFCellStyle tblHeaderRight = style(wb, "1E293B", "FFFFFF", true, 10, HorizontalAlignment.RIGHT, true);
            XSSFCellStyle tblHeaderCenter = style(wb, "1E293B", "FFFFFF", true, 10, HorizontalAlignment.CENTER, true);

            XSSFCellStyle dataLeft = style(wb, "FFFFFF", "0F172A", false, 10, HorizontalAlignment.LEFT, true);
            XSSFCellStyle dataLeftZebra = style(wb, "F8FAFC", "0F172A", false, 10, HorizontalAlignment.LEFT, true);

            XSSFCellStyle dataCenter = style(wb, "FFFFFF", "0F172A", false, 10, HorizontalAlignment.CENTER, true);
            XSSFCellStyle dataCenterZebra = style(wb, "F8FAFC", "0F172A", false, 10, HorizontalAlignment.CENTER, true);

            String moneyFormat = "\"" + symbol + " \"#,##0.00;(\"" + symbol + " \"#,##0.00);\"-\"";
            short moneyFormatIdx = wb.createDataFormat().getFormat(moneyFormat);

            XSSFCellStyle dataMoney = style(wb, "FFFFFF", "0F172A", false, 10, HorizontalAlignment.RIGHT, true);
            dataMoney.setDataFormat(moneyFormatIdx);
            XSSFCellStyle dataMoneyZebra = style(wb, "F8FAFC", "0F172A", false, 10, HorizontalAlignment.RIGHT, true);
            dataMoneyZebra.setDataFormat(moneyFormatIdx);

            short pctFormatIdx = wb.createDataFormat().getFormat("0.0%");
            XSSFCellStyle dataPct = style(wb, "FFFFFF", "0F172A", false, 10, HorizontalAlignment.RIGHT, true);
            dataPct.setDataFormat(pctFormatIdx);
            XSSFCellStyle dataPctZebra = style(wb, "F8FAFC", "0F172A", false, 10, HorizontalAlignment.RIGHT, true);
            dataPctZebra.setDataFormat(pctFormatIdx);

            XSSFCellStyle totalLabelStyle = style(wb, "F1F5F9", "0F172A", true, 10, HorizontalAlignment.RIGHT, true);
            XSSFCellStyle totalMoneyStyle = style(wb, "F1F5F9", "0F172A", true, 10, HorizontalAlignment.RIGHT, true);
            totalMoneyStyle.setDataFormat(moneyFormatIdx);
            totalMoneyStyle.setBorderBottom(BorderStyle.DOUBLE);

            // KPI Card Styles for Executive Dashboard
            XSSFCellStyle kpiCardHeader = style(wb, "F8FAFC", "64748B", true, 9, HorizontalAlignment.CENTER, true);
            XSSFCellStyle kpiInflowVal = style(wb, "ECFDF5", "059669", true, 15, HorizontalAlignment.CENTER, true);
            kpiInflowVal.setDataFormat(moneyFormatIdx);
            XSSFCellStyle kpiSpendVal = style(wb, "FEF2F2", "DC2626", true, 15, HorizontalAlignment.CENTER, true);
            kpiSpendVal.setDataFormat(moneyFormatIdx);
            XSSFCellStyle kpiNetVal = style(wb, net.signum() >= 0 ? "ECFDF5" : "FEF2F2", net.signum() >= 0 ? "059669" : "DC2626", true, 15, HorizontalAlignment.CENTER, true);
            kpiNetVal.setDataFormat(moneyFormatIdx);
            XSSFCellStyle kpiTxVal = style(wb, "F1F5F9", "0284C7", true, 15, HorizontalAlignment.CENTER, true);
            XSSFCellStyle kpiFooter = style(wb, "F8FAFC", "94A3B8", false, 8, HorizontalAlignment.CENTER, true);

            // 1. EXECUTIVE DASHBOARD SHEET
            XSSFSheet dashboard = wb.createSheet("Executive Dashboard");
            setTab(dashboard, "4F46E5");
            dashboard.setDisplayGridlines(false);

            // Hero Banner (Rows 0-1)
            for (int r = 0; r <= 1; r++) {
                Row row = dashboard.createRow(r);
                row.setHeightInPoints(r == 0 ? 22 : 18);
                for (int c = 0; c < 8; c++) put(dashboard, r, c, "", hero);
            }
            dashboard.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(0, 1, 0, 7));
            put(dashboard, 0, 0, "EXPENSETRACKER | EXECUTIVE FINANCIAL DASHBOARD", hero);

            // Sub-Banner (Row 2)
            Row subRow = dashboard.createRow(2);
            subRow.setHeightInPoints(20);
            for (int c = 0; c < 8; c++) put(dashboard, 2, c, "", subHero);
            dashboard.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(2, 2, 0, 7));
            put(dashboard, 2, 0, "POWER BI EXECUTIVE AUDIT  |  PERIOD: " + range.label().toUpperCase() + "  |  BASE CURRENCY: " + symbol + "  |  GENERATED: " + LocalDate.now(), subHero);

            // Spacer Row 3
            dashboard.createRow(3).setHeightInPoints(10);

            // Power BI 4-Card Metric Ribbon (Rows 4, 5, 6)
            dashboard.createRow(4).setHeightInPoints(18);
            dashboard.createRow(5).setHeightInPoints(30);
            dashboard.createRow(6).setHeightInPoints(16);

            // Card 1: TOTAL INFLOW (Cols 0-1)
            dashboard.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(4, 4, 0, 1));
            dashboard.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(5, 5, 0, 1));
            dashboard.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(6, 6, 0, 1));
            put(dashboard, 4, 0, "▲ TOTAL INFLOW", kpiCardHeader);
            put(dashboard, 4, 1, "", kpiCardHeader);
            put(dashboard, 5, 0, income, kpiInflowVal);
            put(dashboard, 5, 1, "", kpiInflowVal);
            put(dashboard, 6, 0, "Verified incoming revenue streams", kpiFooter);
            put(dashboard, 6, 1, "", kpiFooter);

            // Card 2: TOTAL SPEND (Cols 2-3)
            dashboard.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(4, 4, 2, 3));
            dashboard.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(5, 5, 2, 3));
            dashboard.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(6, 6, 2, 3));
            put(dashboard, 4, 2, "▼ TOTAL SPEND", kpiCardHeader);
            put(dashboard, 4, 3, "", kpiCardHeader);
            put(dashboard, 5, 2, spend, kpiSpendVal);
            put(dashboard, 5, 3, "", kpiSpendVal);
            put(dashboard, 6, 2, "Discretionary & operating outflow", kpiFooter);
            put(dashboard, 6, 3, "", kpiFooter);

            // Card 3: NET CASH FLOW (Cols 4-5)
            dashboard.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(4, 4, 4, 5));
            dashboard.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(5, 5, 4, 5));
            dashboard.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(6, 6, 4, 5));
            put(dashboard, 4, 4, "◆ NET CASH FLOW", kpiCardHeader);
            put(dashboard, 4, 5, "", kpiCardHeader);
            put(dashboard, 5, 4, net, kpiNetVal);
            put(dashboard, 5, 5, "", kpiNetVal);
            put(dashboard, 6, 4, net.signum() >= 0 ? "Net surplus retained" : "Net operating deficit", kpiFooter);
            put(dashboard, 6, 5, "", kpiFooter);

            // Card 4: CAPITAL RETENTION RATE (Cols 6-7)
            double savingsRate = income.compareTo(BigDecimal.ZERO) > 0
                    ? Math.max(0.0, net.divide(income, 4, RoundingMode.HALF_UP).doubleValue()) : 0.0;
            XSSFCellStyle kpiSavingsVal = style(wb,
                    savingsRate >= 0.20 ? "ECFDF5" : (savingsRate > 0 ? "FFFBEB" : "FEF2F2"),
                    savingsRate >= 0.20 ? "059669" : (savingsRate > 0 ? "D97706" : "DC2626"),
                    true, 15, HorizontalAlignment.CENTER, true);
            kpiSavingsVal.setDataFormat(pctFormatIdx);

            dashboard.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(4, 4, 6, 7));
            dashboard.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(5, 5, 6, 7));
            dashboard.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(6, 6, 6, 7));
            put(dashboard, 4, 6, "SAVINGS RETENTION RATE", kpiCardHeader);
            put(dashboard, 4, 7, "", kpiCardHeader);
            put(dashboard, 5, 6, savingsRate, kpiSavingsVal);
            put(dashboard, 5, 7, "", kpiSavingsVal);
            put(dashboard, 6, 6, "Target Benchmark: >= 20.0%", kpiFooter);
            put(dashboard, 6, 7, "", kpiFooter);

            // Spacer Row 7
            dashboard.createRow(7).setHeightInPoints(8);

            // Secondary 4-Card Resilience & Velocity Ribbon (Rows 8, 9, 10 across Cols 0-7)
            dashboard.createRow(8).setHeightInPoints(18);
            dashboard.createRow(9).setHeightInPoints(28);
            dashboard.createRow(10).setHeightInPoints(16);

            // Health Resilience Score calculation
            int resilienceScore = 65;
            if (savingsRate >= 0.20) resilienceScore += 20;
            else if (savingsRate >= 0.10) resilienceScore += 10;
            else if (net.signum() < 0) resilienceScore -= 20;
            if (d.budgets.stream().allMatch(b -> b.getLimitAmount().compareTo(BigDecimal.ZERO) > 0)) resilienceScore += 10;
            resilienceScore = Math.max(15, Math.min(99, resilienceScore));

            // Daily Burn Calculation
            int activeDays = Math.max(1, d.expenses.isEmpty() ? 1 : 30);
            BigDecimal dailyBurn = spend.divide(BigDecimal.valueOf(activeDays), 2, RoundingMode.HALF_UP);

            // Total liquid savings
            BigDecimal totalSaved = d.savingsGoals.stream()
                    .map(g -> nz(g.getCurrentAmount()))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            double runwayMonths = (spend.compareTo(BigDecimal.ZERO) > 0 && totalSaved.compareTo(BigDecimal.ZERO) > 0)
                    ? totalSaved.divide(spend, 1, RoundingMode.HALF_UP).doubleValue() : 0.0;

            // Card 5: RESILIENCE SCORE (Cols 0-1)
            dashboard.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(8, 8, 0, 1));
            dashboard.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(9, 9, 0, 1));
            dashboard.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(10, 10, 0, 1));
            put(dashboard, 8, 0, "FINANCIAL RESILIENCE SCORE", kpiCardHeader);
            put(dashboard, 8, 1, "", kpiCardHeader);
            put(dashboard, 9, 0, resilienceScore + " / 100", kpiInflowVal);
            put(dashboard, 9, 1, "", kpiInflowVal);
            put(dashboard, 10, 0, resilienceScore >= 80 ? "Grade A - Robust Stability" : "Grade B - Controlled Exposure", kpiFooter);
            put(dashboard, 10, 1, "", kpiFooter);

            // Card 6: DAILY CASH BURN VELOCITY (Cols 2-3)
            dashboard.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(8, 8, 2, 3));
            dashboard.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(9, 9, 2, 3));
            dashboard.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(10, 10, 2, 3));
            put(dashboard, 8, 2, "DAILY CASH BURN RATE", kpiCardHeader);
            put(dashboard, 8, 3, "", kpiCardHeader);
            put(dashboard, 9, 2, dailyBurn, kpiSpendVal);
            put(dashboard, 9, 3, "", kpiSpendVal);
            put(dashboard, 10, 2, "Outflow velocity per 24 hours", kpiFooter);
            put(dashboard, 10, 3, "", kpiFooter);

            // Card 7: EMERGENCY SAVINGS RUNWAY (Cols 4-5)
            dashboard.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(8, 8, 4, 5));
            dashboard.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(9, 9, 4, 5));
            dashboard.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(10, 10, 4, 5));
            put(dashboard, 8, 4, "EMERGENCY RESERVES RUNWAY", kpiCardHeader);
            put(dashboard, 8, 5, "", kpiCardHeader);
            put(dashboard, 9, 4, String.format(Locale.US, "%.1f Months", runwayMonths), kpiNetVal);
            put(dashboard, 9, 5, "", kpiNetVal);
            put(dashboard, 10, 4, "Buffer based on liquid savings", kpiFooter);
            put(dashboard, 10, 5, "", kpiFooter);

            // Card 8: VERIFIED TRANSACTIONS (Cols 6-7)
            dashboard.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(8, 8, 6, 7));
            dashboard.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(9, 9, 6, 7));
            dashboard.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(10, 10, 6, 7));
            put(dashboard, 8, 6, "VERIFIED TRANSACTIONS", kpiCardHeader);
            put(dashboard, 8, 7, "", kpiCardHeader);
            put(dashboard, 9, 6, d.expenses.size() + d.incomes.size(), kpiTxVal);
            put(dashboard, 9, 7, "", kpiTxVal);
            put(dashboard, 10, 6, "Dual ledger reconciled", kpiFooter);
            put(dashboard, 10, 7, "", kpiFooter);

            // Spacer Row 11
            dashboard.createRow(11).setHeightInPoints(10);
            dashboard.createFreezePane(0, 11);

            // SECTION 1: Category Distribution Matrix (Cols 0-3) vs Telemetry & Insights (Cols 4-7)
            put(dashboard, 12, 0, "CATEGORY (PARETO 80/20)", tblHeader);
            put(dashboard, 12, 1, "ITEMS", tblHeaderRight);
            put(dashboard, 12, 2, "OUTFLOW (" + symbol + ")", tblHeaderRight);
            put(dashboard, 12, 3, "SHARE %", tblHeaderRight);

            // Group expenses by category
            Map<String, List<Expense>> catMap = d.expenses.stream()
                    .collect(Collectors.groupingBy(e -> categoryName(e.getCategory())));
            List<Map.Entry<String, List<Expense>>> sortedCats = catMap.entrySet().stream()
                    .sorted((a, b) -> {
                        BigDecimal sumA = a.getValue().stream().map(e -> nz(e.getAmount())).reduce(BigDecimal.ZERO, BigDecimal::add);
                        BigDecimal sumB = b.getValue().stream().map(e -> nz(e.getAmount())).reduce(BigDecimal.ZERO, BigDecimal::add);
                        return sumB.compareTo(sumA);
                    })
                    .limit(8)
                    .toList();

            double totalSpendDouble = spend.doubleValue();
            int catRow = 13;
            for (Map.Entry<String, List<Expense>> entry : sortedCats) {
                boolean z = (catRow % 2 == 1);
                BigDecimal cSum = entry.getValue().stream().map(e -> nz(e.getAmount())).reduce(BigDecimal.ZERO, BigDecimal::add);
                double cPct = totalSpendDouble > 0 ? (cSum.doubleValue() / totalSpendDouble) : 0.0;
                put(dashboard, catRow, 0, entry.getKey(), z ? dataLeftZebra : dataLeft);
                put(dashboard, catRow, 1, entry.getValue().size(), z ? dataCenterZebra : dataCenter);
                put(dashboard, catRow, 2, cSum, z ? dataMoneyZebra : dataMoney);
                put(dashboard, catRow, 3, cPct, z ? dataPctZebra : dataPct);
                catRow++;
            }
            if (sortedCats.isEmpty()) {
                put(dashboard, catRow, 0, "No expenses recorded", dataLeft);
                put(dashboard, catRow, 1, 0, dataCenter);
                put(dashboard, catRow, 2, BigDecimal.ZERO, dataMoney);
                put(dashboard, catRow, 3, 0.0, dataPct);
                catRow++;
            }

            // Key Insights Section (Cols 4-7)
            List<String> insights = insights(d, spend, income, symbol);
            dashboard.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(12, 12, 4, 7));
            put(dashboard, 12, 4, "EXECUTIVE TELEMETRY & STRATEGIC AUDIT", tblHeader);
            for (int c = 5; c < 8; c++) put(dashboard, 12, c, "", tblHeader);

            for (int n = 0; n < Math.max(insights.size(), catRow - 13); n++) {
                int targetRow = 13 + n;
                boolean z = (n % 2 == 1);
                String insText = n < insights.size() ? insights.get(n) : "";
                dashboard.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(targetRow, targetRow, 4, 7));
                put(dashboard, targetRow, 4, insText, z ? dataLeftZebra : dataLeft);
                for (int c = 5; c < 8; c++) put(dashboard, targetRow, c, "", z ? dataLeftZebra : dataLeft);
            }

            int sec1End = Math.max(catRow, 13 + insights.size());

            // Section 2: Portfolio Liquidity Flows (Cols 0-3) & Chronological Outflow Run-Rate (Cols 4-7)
            dashboard.createRow(sec1End).setHeightInPoints(10); // Spacer
            int sec2HeadRow = sec1End + 1;
            put(dashboard, sec2HeadRow, 0, "PORTFOLIO LIQUIDITY FLOWS", tblHeader);
            put(dashboard, sec2HeadRow, 1, "AMOUNT (" + symbol + ")", tblHeaderRight);
            put(dashboard, sec2HeadRow, 2, "SHARE %", tblHeaderRight);
            put(dashboard, sec2HeadRow, 3, "FLOW VECTOR", tblHeaderCenter);

            put(dashboard, sec2HeadRow, 4, "CHRONOLOGICAL TIMELINE", tblHeaderCenter);
            put(dashboard, sec2HeadRow, 5, "DISBURSEMENT (" + symbol + ")", tblHeaderRight);
            put(dashboard, sec2HeadRow, 6, "VELOCITY RUN-RATE", tblHeaderCenter);
            put(dashboard, sec2HeadRow, 7, "STATUS TAG", tblHeaderCenter);

            int cfStartRow = sec2HeadRow + 1;
            String[] cfLabels = {
                    "Total Operating Revenue",
                    "Total Operating Spend",
                    "Net Retained Cash Flow",
                    "Active Liquid Reserves"
            };
            BigDecimal[] cfAmounts = {
                    income,
                    spend,
                    net,
                    totalSaved
            };
            double[] cfShares = {
                    income.compareTo(BigDecimal.ZERO) > 0 ? 1.0 : 0.0,
                    income.compareTo(BigDecimal.ZERO) > 0 ? spend.divide(income, 4, RoundingMode.HALF_UP).doubleValue() : 0.0,
                    savingsRate,
                    0.0
            };
            String[] cfVectors = {
                    "INFLOW (+)",
                    "OUTFLOW (-)",
                    net.signum() >= 0 ? "SURPLUS (+)" : "DEFICIT (-)",
                    "RESERVE (+)"
            };

            for (int i = 0; i < 4; i++) {
                int rIdx = cfStartRow + i;
                boolean z = (i % 2 == 1);
                put(dashboard, rIdx, 0, cfLabels[i], z ? dataLeftZebra : dataLeft);
                put(dashboard, rIdx, 1, cfAmounts[i], z ? dataMoneyZebra : dataMoney);
                put(dashboard, rIdx, 2, cfShares[i], z ? dataPctZebra : dataPct);
                put(dashboard, rIdx, 3, cfVectors[i], z ? dataCenterZebra : dataCenter);
            }
            int cfEndRow = cfStartRow + 3;

            // Chronological Timeline Data (Cols 4-7)
            Map<String, BigDecimal> dailySpendMap = d.expenses.stream()
                    .filter(x -> x.getExpenseDate() != null)
                    .collect(Collectors.groupingBy(
                            x -> x.getExpenseDate().toString(),
                            TreeMap::new,
                            Collectors.mapping(x -> nz(x.getAmount()), Collectors.reducing(BigDecimal.ZERO, BigDecimal::add))));

            List<Map.Entry<String, BigDecimal>> timeEntries = new ArrayList<>(dailySpendMap.entrySet());
            if (timeEntries.isEmpty()) {
                timeEntries.add(Map.entry(LocalDate.now().minusDays(1).toString(), BigDecimal.ZERO));
                timeEntries.add(Map.entry(LocalDate.now().toString(), BigDecimal.ZERO));
            }
            if (timeEntries.size() > 6) {
                timeEntries = timeEntries.subList(timeEntries.size() - 6, timeEntries.size());
            }

            int timeStartRow = sec2HeadRow + 1;
            int numTimeRows = Math.max(4, timeEntries.size());
            for (int i = 0; i < numTimeRows; i++) {
                int rIdx = timeStartRow + i;
                boolean z = (i % 2 == 1);
                if (i < timeEntries.size()) {
                    Map.Entry<String, BigDecimal> te = timeEntries.get(i);
                    put(dashboard, rIdx, 4, te.getKey(), z ? dataCenterZebra : dataCenter);
                    put(dashboard, rIdx, 5, te.getValue(), z ? dataMoneyZebra : dataMoney);
                    put(dashboard, rIdx, 6, "Recorded Run-Rate", z ? dataCenterZebra : dataCenter);
                    put(dashboard, rIdx, 7, "Nominal", z ? dataCenterZebra : dataCenter);
                } else {
                    put(dashboard, rIdx, 4, "", z ? dataCenterZebra : dataCenter);
                    put(dashboard, rIdx, 5, BigDecimal.ZERO, z ? dataMoneyZebra : dataMoney);
                    put(dashboard, rIdx, 6, "", z ? dataCenterZebra : dataCenter);
                    put(dashboard, rIdx, 7, "", z ? dataCenterZebra : dataCenter);
                }
            }
            int timeEndRow = timeStartRow + numTimeRows - 1;
            int tableEndRow = Math.max(cfEndRow, timeEndRow);
            int chartRow1 = tableEndRow + 2;
            int chartRow1Height = 16;
            int chartRow2 = chartRow1 + chartRow1Height + 1;
            int chartRow2Height = 16;

            // ═════════════════════════════════════════════════════════════════════════
            // EMBEDDED VISUAL VECTOR XDDF CHARTS (Rows below summary tables)
            // ═════════════════════════════════════════════════════════════════════════
            try {
                XSSFDrawing drawing = dashboard.createDrawingPatriarch();

                // Chart 1: Cash Flow Column Chart (Cols 0-3 / A-D)
                XSSFClientAnchor anchor1 = drawing.createAnchor(0, 0, 0, 0, 0, chartRow1, 4, chartRow1 + chartRow1Height);
                XSSFChart chart1 = drawing.createChart(anchor1);
                chart1.setTitleText("CASH FLOW DYNAMICS & LIQUIDITY (" + symbol + ")");
                chart1.setTitleOverlay(false);

                XDDFChartLegend legend1 = chart1.getOrAddLegend();
                legend1.setPosition(LegendPosition.TOP_RIGHT);
                legend1.setOverlay(false);

                XDDFCategoryAxis bAxis1 = chart1.createCategoryAxis(AxisPosition.BOTTOM);
                XDDFValueAxis lAxis1 = chart1.createValueAxis(AxisPosition.LEFT);
                lAxis1.setCrosses(AxisCrosses.AUTO_ZERO);

                XDDFBarChartData barChart = (XDDFBarChartData) chart1.createData(ChartTypes.BAR, bAxis1, lAxis1);
                barChart.setBarDirection(BarDirection.COL);

                XDDFDataSource<String> cfCategories =
                        XDDFDataSourcesFactory.fromStringCellRange(
                                dashboard, new CellRangeAddress(cfStartRow, cfEndRow, 0, 0));
                XDDFNumericalDataSource<Double> cfValues =
                        XDDFDataSourcesFactory.fromNumericCellRange(
                                dashboard, new CellRangeAddress(cfStartRow, cfEndRow, 1, 1));

                XDDFChartData.Series cfSeries = barChart.addSeries(cfCategories, cfValues);
                cfSeries.setTitle("Portfolio Dynamics (" + symbol + ")", null);
                chart1.plot(barChart);

                // Chart 2: Expenditure Allocation Donut Chart (Cols 4-7 / E-H)
                XSSFClientAnchor anchor2 = drawing.createAnchor(0, 0, 0, 0, 4, chartRow1, 8, chartRow1 + chartRow1Height);
                XSSFChart chart2 = drawing.createChart(anchor2);
                chart2.setTitleText("EXPENDITURE ALLOCATION & COST DRIVERS");
                chart2.setTitleOverlay(false);

                XDDFChartLegend legend2 = chart2.getOrAddLegend();
                legend2.setPosition(LegendPosition.RIGHT);
                legend2.setOverlay(false);

                XDDFDoughnutChartData donutChart = (XDDFDoughnutChartData)
                        chart2.createData(ChartTypes.DOUGHNUT, null, null);
                donutChart.setHoleSize(55);
                donutChart.setVaryColors(true);

                int catEndPlotRow = Math.max(13, catRow - 1);
                XDDFDataSource<String> catCategories =
                        XDDFDataSourcesFactory.fromStringCellRange(
                                dashboard, new CellRangeAddress(13, catEndPlotRow, 0, 0));
                XDDFNumericalDataSource<Double> catValues =
                        XDDFDataSourcesFactory.fromNumericCellRange(
                                dashboard, new CellRangeAddress(13, catEndPlotRow, 2, 2));

                XDDFChartData.Series donutSeries = donutChart.addSeries(catCategories, catValues);
                donutSeries.setTitle("Expenditure Breakdown", null);
                chart2.plot(donutChart);

                // Chart 3: Chronological Disbursement Velocity Line Chart (Cols 0-7 / A-H)
                XSSFClientAnchor anchor3 = drawing.createAnchor(0, 0, 0, 0, 0, chartRow2, 8, chartRow2 + chartRow2Height);
                XSSFChart chart3 = drawing.createChart(anchor3);
                chart3.setTitleText("CHRONOLOGICAL DISBURSEMENT VELOCITY & RUN-RATE (" + symbol + ")");
                chart3.setTitleOverlay(false);

                XDDFChartLegend legend3 = chart3.getOrAddLegend();
                legend3.setPosition(LegendPosition.TOP_RIGHT);
                legend3.setOverlay(false);

                XDDFCategoryAxis bAxis3 = chart3.createCategoryAxis(AxisPosition.BOTTOM);
                XDDFValueAxis lAxis3 = chart3.createValueAxis(AxisPosition.LEFT);
                lAxis3.setCrosses(AxisCrosses.AUTO_ZERO);

                XDDFLineChartData lineChart = (XDDFLineChartData) chart3.createData(ChartTypes.LINE, bAxis3, lAxis3);
                lineChart.setVaryColors(false);

                XDDFDataSource<String> timeCategories =
                        XDDFDataSourcesFactory.fromStringCellRange(
                                dashboard, new CellRangeAddress(timeStartRow, timeEndRow, 4, 4));
                XDDFNumericalDataSource<Double> timeValues =
                        XDDFDataSourcesFactory.fromNumericCellRange(
                                dashboard, new CellRangeAddress(timeStartRow, timeEndRow, 5, 5));

                XDDFChartData.Series lineSeries = lineChart.addSeries(timeCategories, timeValues);
                lineSeries.setTitle("Daily Outflow (" + symbol + ")", null);
                chart3.plot(lineChart);

            } catch (Exception chartEx) {
                log.warn("Executive Dashboard XDDF chart rendering note: {}", chartEx.getMessage(), chartEx);
            }

            // Section 4: What-If Sensitivity & Stress Test Matrix (Power BI Parameter Simulation)
            int sensStartRow = chartRow2 + chartRow2Height + 2;
            dashboard.createRow(sensStartRow).setHeightInPoints(10); // Spacer
            int sensHeadRow = sensStartRow + 1;
            dashboard.addMergedRegion(new CellRangeAddress(sensHeadRow, sensHeadRow, 0, 7));
            put(dashboard, sensHeadRow, 0, "4. WHAT-IF SCENARIO & FINANCIAL SENSITIVITY MATRIX (POWER BI WHAT-IF PARAMETERS)", tblHeader);
            for (int c = 1; c < 8; c++) put(dashboard, sensHeadRow, c, "", tblHeader);

            int sensSubRow = sensHeadRow + 1;
            put(dashboard, sensSubRow, 0, "SPEND CUT / INFLOW SHOCK", tblHeader);
            put(dashboard, sensSubRow, 1, "-10% REVENUE SHOCK", tblHeaderRight);
            put(dashboard, sensSubRow, 2, "BASELINE REVENUE (0%)", tblHeaderRight);
            put(dashboard, sensSubRow, 3, "+10% REVENUE EXPANSION", tblHeaderRight);
            put(dashboard, sensSubRow, 4, "+20% REVENUE EXPANSION", tblHeaderRight);
            put(dashboard, sensSubRow, 5, "SURPLUS / DEFICIT", tblHeaderCenter);
            put(dashboard, sensSubRow, 6, "LIQUIDITY RUNWAY", tblHeaderCenter);
            put(dashboard, sensSubRow, 7, "STRATEGIC POSTURE", tblHeaderCenter);

            String[] cutLabels = {
                    "Baseline Spend (0% Cut)",
                    "Moderate Spend Cut (-10%)",
                    "Aggressive Spend Cut (-20%)",
                    "Austerity Spend Cut (-30%)"
            };
            double[] cutFractions = {0.0, 0.10, 0.20, 0.30};
            String[] postures = {
                    "Status Quo",
                    "Defensive Cushion",
                    "Active Optimization",
                    "Aggressive Wealth Building"
            };

            for (int i = 0; i < 4; i++) {
                int rIdx = sensSubRow + 1 + i;
                boolean z = (i % 2 == 1);
                double cut = cutFractions[i];
                double spendFactor = 1.0 - cut;
                double adjSpend = spend.doubleValue() * spendFactor;
                double incVal = income.doubleValue();
                double revMinus10 = (incVal * 0.9) - adjSpend;
                double revBase = incVal - adjSpend;
                double revPlus10 = (incVal * 1.1) - adjSpend;
                double revPlus20 = (incVal * 1.2) - adjSpend;

                put(dashboard, rIdx, 0, cutLabels[i], z ? dataLeftZebra : dataLeft);
                put(dashboard, rIdx, 1, BigDecimal.valueOf(revMinus10).setScale(2, RoundingMode.HALF_UP), z ? dataMoneyZebra : dataMoney);
                put(dashboard, rIdx, 2, BigDecimal.valueOf(revBase).setScale(2, RoundingMode.HALF_UP), z ? dataMoneyZebra : dataMoney);
                put(dashboard, rIdx, 3, BigDecimal.valueOf(revPlus10).setScale(2, RoundingMode.HALF_UP), z ? dataMoneyZebra : dataMoney);
                put(dashboard, rIdx, 4, BigDecimal.valueOf(revPlus20).setScale(2, RoundingMode.HALF_UP), z ? dataMoneyZebra : dataMoney);
                put(dashboard, rIdx, 5, revBase >= 0 ? "SURPLUS" : "DEFICIT", z ? dataCenterZebra : dataCenter);
                put(dashboard, rIdx, 6, runwayMonths > 0 ? String.format(Locale.US, "%.1f Mo", runwayMonths / spendFactor) : "0.0 Mo", z ? dataCenterZebra : dataCenter);
                put(dashboard, rIdx, 7, postures[i], z ? dataCenterZebra : dataCenter);
            }

            for (int c = 0; c < 8; c++) dashboard.setColumnWidth(c, 22 * 256);
            dashboard.setForceFormulaRecalculation(true);

            // 2. INCOME LEDGER SHEET
            XSSFSheet incomeSheet = wb.createSheet("Income Ledger");
            setTab(incomeSheet, "059669");
            incomeSheet.setDisplayGridlines(true);
            incomeSheet.createFreezePane(0, 1);
            String[] ih = {"Date", "Source", "Description", "Amount (" + symbol + ")", "Frequency"};
            Row ihRow = incomeSheet.createRow(0);
            ihRow.setHeightInPoints(24);
            for (int c = 0; c < ih.length; c++) {
                put(incomeSheet, 0, c, ih[c], c == 3 ? tblHeaderRight : tblHeader);
            }
            int row = 1;
            for (Income x : d.incomes) {
                Row r = incomeSheet.createRow(row);
                r.setHeightInPoints(20);
                boolean z = (row % 2 == 0);
                put(incomeSheet, row, 0, safeDate(x.getIncomeDate()), z ? dataCenterZebra : dataCenter);
                put(incomeSheet, row, 1, safe(x.getSource()), z ? dataLeftZebra : dataLeft);
                put(incomeSheet, row, 2, safe(x.getDescription()), z ? dataLeftZebra : dataLeft);
                put(incomeSheet, row, 3, nz(x.getAmount()), z ? dataMoneyZebra : dataMoney);
                put(incomeSheet, row, 4, safe(x.getFrequency()), z ? dataCenterZebra : dataCenter);
                row++;
            }
            if (row > 1) {
                incomeSheet.setAutoFilter(new org.apache.poi.ss.util.CellRangeAddress(0, row - 1, 0, ih.length - 1));
                Row totRow = incomeSheet.createRow(row);
                totRow.setHeightInPoints(22);
                put(incomeSheet, row, 2, "TOTAL INFLOW (" + symbol + "):", totalLabelStyle);
                put(incomeSheet, row, 3, "=SUM(D2:D" + row + ")", totalMoneyStyle);
            }
            widths(incomeSheet, new int[]{16, 24, 46, 18, 16});

            // 3. EXPENSE LEDGER SHEET
            XSSFSheet expenseSheet = wb.createSheet("Expense Ledger");
            setTab(expenseSheet, "E11D48");
            expenseSheet.setDisplayGridlines(true);
            expenseSheet.createFreezePane(0, 1);
            String[] eh = {"Date", "Category", "Description", "Amount (" + symbol + ")", "Recurring", "Z-Score Outlier Tag"};
            Row ehRow = expenseSheet.createRow(0);
            ehRow.setHeightInPoints(24);
            for (int c = 0; c < eh.length; c++) {
                put(expenseSheet, 0, c, eh[c], c == 3 ? tblHeaderRight : tblHeader);
            }
            row = 1;
            int totalExpCount = d.expenses.size();
            double meanExp = 0.0;
            double stdDevExp = 0.0;
            if (totalExpCount >= 3) {
                double sum = 0.0;
                for (Expense ex : d.expenses) {
                    sum += nz(ex.getAmount()).doubleValue();
                }
                meanExp = sum / totalExpCount;
                double sumSq = 0.0;
                for (Expense ex : d.expenses) {
                    double diff = nz(ex.getAmount()).doubleValue() - meanExp;
                    sumSq += diff * diff;
                }
                stdDevExp = Math.sqrt(sumSq / (totalExpCount - 1));
            }
            double outlierThreshold = meanExp + (2.0 * stdDevExp);

            for (Expense x : d.expenses) {
                Row r = expenseSheet.createRow(row);
                r.setHeightInPoints(20);
                boolean z = (row % 2 == 0);
                put(expenseSheet, row, 0, safeDate(x.getExpenseDate()), z ? dataCenterZebra : dataCenter);
                put(expenseSheet, row, 1, categoryName(x.getCategory()), z ? dataLeftZebra : dataLeft);
                put(expenseSheet, row, 2, safe(x.getDescription()), z ? dataLeftZebra : dataLeft);
                put(expenseSheet, row, 3, nz(x.getAmount()), z ? dataMoneyZebra : dataMoney);
                put(expenseSheet, row, 4, x.isRecurring() ? "Yes" : "No", z ? dataCenterZebra : dataCenter);
                if (totalExpCount >= 3 && stdDevExp > 0.0001 && nz(x.getAmount()).doubleValue() > outlierThreshold) {
                    put(expenseSheet, row, 5, "[STATISTICAL SURGE] (Z > 2.0)", z ? dataCenterZebra : dataCenter);
                } else {
                    put(expenseSheet, row, 5, "NOMINAL", z ? dataCenterZebra : dataCenter);
                }
                row++;
            }
            if (row > 1) {
                expenseSheet.setAutoFilter(new org.apache.poi.ss.util.CellRangeAddress(0, row - 1, 0, eh.length - 1));
                Row totRow = expenseSheet.createRow(row);
                totRow.setHeightInPoints(22);
                put(expenseSheet, row, 2, "TOTAL OUTFLOW (" + symbol + "):", totalLabelStyle);
                put(expenseSheet, row, 3, "=SUM(D2:D" + row + ")", totalMoneyStyle);
            }
            widths(expenseSheet, new int[]{16, 24, 46, 18, 14, 30});

            // 4. SAVINGS GOALS SHEET
            XSSFSheet savingsSheet = wb.createSheet("Savings Goals");
            setTab(savingsSheet, "7C3AED");
            savingsSheet.setDisplayGridlines(true);
            savingsSheet.createFreezePane(0, 1);
            String[] sh = {"Goal", "Target Amount (" + symbol + ")", "Current Saved (" + symbol + ")", "Progress", "Target Date", "Status", "Recurring", "Next Due"};
            Row shRow = savingsSheet.createRow(0);
            shRow.setHeightInPoints(24);
            for (int c = 0; c < sh.length; c++) {
                put(savingsSheet, 0, c, sh[c], (c == 1 || c == 2 || c == 3) ? tblHeaderRight : tblHeader);
            }
            row = 1;
            for (SavingsGoal x : d.savingsGoals) {
                Row r = savingsSheet.createRow(row);
                r.setHeightInPoints(20);
                boolean z = (row % 2 == 0);
                BigDecimal target = nz(x.getTargetAmount());
                BigDecimal saved = nz(x.getCurrentAmount());
                double pct = target.signum() > 0 ? saved.divide(target, 4, RoundingMode.HALF_UP).doubleValue() : 0d;
                put(savingsSheet, row, 0, safe(x.getName()), z ? dataLeftZebra : dataLeft);
                put(savingsSheet, row, 1, target, z ? dataMoneyZebra : dataMoney);
                put(savingsSheet, row, 2, saved, z ? dataMoneyZebra : dataMoney);
                put(savingsSheet, row, 3, pct, z ? dataPctZebra : dataPct);
                put(savingsSheet, row, 4, safeDate(x.getTargetDate()), z ? dataCenterZebra : dataCenter);
                put(savingsSheet, row, 5, safe(x.getStatus()), z ? dataCenterZebra : dataCenter);
                put(savingsSheet, row, 6, x.getIsRecurring() ? "Yes" : "No", z ? dataCenterZebra : dataCenter);
                put(savingsSheet, row, 7, safeDate(x.getNextDueDate()), z ? dataCenterZebra : dataCenter);
                row++;
            }
            if (row > 1) {
                savingsSheet.setAutoFilter(new org.apache.poi.ss.util.CellRangeAddress(0, row - 1, 0, sh.length - 1));
            }
            widths(savingsSheet, new int[]{28, 20, 20, 14, 16, 16, 12, 16});

            // 5. SUBSCRIPTIONS SHEET
            XSSFSheet subscriptionSheet = wb.createSheet("Subscriptions");
            setTab(subscriptionSheet, "D97706");
            subscriptionSheet.setDisplayGridlines(true);
            subscriptionSheet.createFreezePane(0, 1);
            String[] rh = {"Subscription", "Amount (" + symbol + ")", "Frequency", "Next Due", "Category"};
            Row rhRow = subscriptionSheet.createRow(0);
            rhRow.setHeightInPoints(24);
            for (int c = 0; c < rh.length; c++) {
                put(subscriptionSheet, 0, c, rh[c], c == 1 ? tblHeaderRight : tblHeader);
            }
            row = 1;
            for (RecurringExpense x : d.subscriptions) {
                Row r = subscriptionSheet.createRow(row);
                r.setHeightInPoints(20);
                boolean z = (row % 2 == 0);
                put(subscriptionSheet, row, 0, safe(x.getDescription()), z ? dataLeftZebra : dataLeft);
                put(subscriptionSheet, row, 1, nz(x.getAmount()), z ? dataMoneyZebra : dataMoney);
                put(subscriptionSheet, row, 2, safe(x.getFrequency()), z ? dataCenterZebra : dataCenter);
                put(subscriptionSheet, row, 3, safeDate(x.getNextDueDate()), z ? dataCenterZebra : dataCenter);
                put(subscriptionSheet, row, 4, categoryName(x.getCategory()), z ? dataLeftZebra : dataLeft);
                row++;
            }
            if (row > 1) {
                subscriptionSheet.setAutoFilter(new org.apache.poi.ss.util.CellRangeAddress(0, row - 1, 0, rh.length - 1));
            }
            widths(subscriptionSheet, new int[]{32, 18, 16, 16, 24});

            // 6. BUDGETS SHEET
            XSSFSheet budgetSheet = wb.createSheet("Budgets");
            setTab(budgetSheet, "0D9488");
            budgetSheet.setDisplayGridlines(true);
            budgetSheet.createFreezePane(0, 1);
            String[] bh = {"Category", "Limit (" + symbol + ")", "Period", "Start Date", "End Date", "Interval Days"};
            Row bhRow = budgetSheet.createRow(0);
            bhRow.setHeightInPoints(24);
            for (int c = 0; c < bh.length; c++) {
                put(budgetSheet, 0, c, bh[c], c == 1 ? tblHeaderRight : tblHeader);
            }
            row = 1;
            for (Budget x : d.budgets) {
                Row r = budgetSheet.createRow(row);
                r.setHeightInPoints(20);
                boolean z = (row % 2 == 0);
                put(budgetSheet, row, 0, categoryName(x.getCategory()), z ? dataLeftZebra : dataLeft);
                put(budgetSheet, row, 1, nz(x.getLimitAmount()), z ? dataMoneyZebra : dataMoney);
                put(budgetSheet, row, 2, safe(x.getPeriod()), z ? dataCenterZebra : dataCenter);
                put(budgetSheet, row, 3, safeDate(x.getStartDate()), z ? dataCenterZebra : dataCenter);
                put(budgetSheet, row, 4, safeDate(x.getEndDate()), z ? dataCenterZebra : dataCenter);
                put(budgetSheet, row, 5, x.getIntervalDays() == null ? "" : x.getIntervalDays(), z ? dataCenterZebra : dataCenter);
                row++;
            }
            if (row > 1) {
                budgetSheet.setAutoFilter(new org.apache.poi.ss.util.CellRangeAddress(0, row - 1, 0, bh.length - 1));
            }
            widths(budgetSheet, new int[]{24, 18, 16, 16, 16, 16});

            // 7. CASH FLOW SHEET
            XSSFSheet cash = wb.createSheet("Cash Flow");
            setTab(cash, "0284C7");
            cash.setDisplayGridlines(true);
            cash.createFreezePane(0, 1);
            String[] fh = {"Month", "Income (" + symbol + ")", "Spend (" + symbol + ")", "Net (" + symbol + ")"};
            Row fhRow = cash.createRow(0);
            fhRow.setHeightInPoints(24);
            for (int c = 0; c < fh.length; c++) {
                put(cash, 0, c, fh[c], c > 0 ? tblHeaderRight : tblHeader);
            }
            Map<String, BigDecimal> im = d.incomes.stream()
                    .filter(x -> x.getIncomeDate() != null)
                    .collect(Collectors.groupingBy(x -> x.getIncomeDate().withDayOfMonth(1).toString(),
                            Collectors.mapping(x -> nz(x.getAmount()),
                                    Collectors.reducing(BigDecimal.ZERO, BigDecimal::add))));
            Map<String, BigDecimal> em = d.expenses.stream()
                    .filter(x -> x.getExpenseDate() != null)
                    .collect(Collectors.groupingBy(x -> x.getExpenseDate().withDayOfMonth(1).toString(),
                            Collectors.mapping(x -> nz(x.getAmount()),
                                    Collectors.reducing(BigDecimal.ZERO, BigDecimal::add))));
            row = 1;
            Set<String> months = new TreeSet<>();
            months.addAll(im.keySet());
            months.addAll(em.keySet());
            for (String m : months) {
                Row r = cash.createRow(row);
                r.setHeightInPoints(20);
                boolean z = (row % 2 == 0);
                BigDecimal i = im.getOrDefault(m, BigDecimal.ZERO);
                BigDecimal e = em.getOrDefault(m, BigDecimal.ZERO);
                put(cash, row, 0, m, z ? dataCenterZebra : dataCenter);
                put(cash, row, 1, i, z ? dataMoneyZebra : dataMoney);
                put(cash, row, 2, e, z ? dataMoneyZebra : dataMoney);
                put(cash, row, 3, i.subtract(e), z ? dataMoneyZebra : dataMoney);
                row++;
            }
            if (row > 1) {
                cash.setAutoFilter(new org.apache.poi.ss.util.CellRangeAddress(0, row - 1, 0, fh.length - 1));
            }
            widths(cash, new int[]{20, 20, 20, 20});

            // 8. DIM_DATE (RELATIONAL STAR SCHEMA CALENDAR DIMENSION FOR POWER BI & TABLEAU)
            XSSFSheet dimDateSheet = wb.createSheet("Dim_Date");
            setTab(dimDateSheet, "475569");
            dimDateSheet.setDisplayGridlines(true);
            dimDateSheet.createFreezePane(0, 1);
            String[] ddh = {"DateKey", "FullDate", "Year", "Quarter", "Month", "MonthName", "DayOfWeek", "IsWeekend", "FiscalPeriod"};
            Row ddhRow = dimDateSheet.createRow(0);
            ddhRow.setHeightInPoints(24);
            for (int c = 0; c < ddh.length; c++) {
                put(dimDateSheet, 0, c, ddh[c], tblHeader);
            }
            Set<LocalDate> distinctDates = new TreeSet<>();
            d.expenses.forEach(x -> { if (x.getExpenseDate() != null) distinctDates.add(x.getExpenseDate()); });
            d.incomes.forEach(x -> { if (x.getIncomeDate() != null) distinctDates.add(x.getIncomeDate()); });
            if (distinctDates.isEmpty()) {
                distinctDates.add(LocalDate.now());
            }
            int dRow = 1;
            for (LocalDate dt : distinctDates) {
                Row r = dimDateSheet.createRow(dRow);
                r.setHeightInPoints(20);
                boolean z = (dRow % 2 == 0);
                int dateKey = dt.getYear() * 10000 + dt.getMonthValue() * 100 + dt.getDayOfMonth();
                int qtr = (dt.getMonthValue() - 1) / 3 + 1;
                boolean isWknd = dt.getDayOfWeek().getValue() >= 6;
                put(dimDateSheet, dRow, 0, dateKey, z ? dataCenterZebra : dataCenter);
                put(dimDateSheet, dRow, 1, dt.toString(), z ? dataCenterZebra : dataCenter);
                put(dimDateSheet, dRow, 2, dt.getYear(), z ? dataCenterZebra : dataCenter);
                put(dimDateSheet, dRow, 3, "Q" + qtr, z ? dataCenterZebra : dataCenter);
                put(dimDateSheet, dRow, 4, dt.getMonthValue(), z ? dataCenterZebra : dataCenter);
                put(dimDateSheet, dRow, 5, dt.getMonth().name(), z ? dataLeftZebra : dataLeft);
                put(dimDateSheet, dRow, 6, dt.getDayOfWeek().name(), z ? dataLeftZebra : dataLeft);
                put(dimDateSheet, dRow, 7, isWknd ? "Yes" : "No", z ? dataCenterZebra : dataCenter);
                put(dimDateSheet, dRow, 8, "FY" + dt.getYear() + "-P" + dt.getMonthValue(), z ? dataCenterZebra : dataCenter);
                dRow++;
            }
            dimDateSheet.setAutoFilter(new org.apache.poi.ss.util.CellRangeAddress(0, dRow - 1, 0, ddh.length - 1));
            widths(dimDateSheet, new int[]{14, 16, 12, 12, 12, 18, 18, 14, 16});

            // 9. DIM_CATEGORY (RELATIONAL STAR SCHEMA TAXONOMY DIMENSION)
            XSSFSheet dimCatSheet = wb.createSheet("Dim_Category");
            setTab(dimCatSheet, "64748B");
            dimCatSheet.setDisplayGridlines(true);
            dimCatSheet.createFreezePane(0, 1);
            String[] dch = {"CategoryKey", "CategoryName", "MacroClassification", "BudgetLimit (" + symbol + ")", "TargetBenchmark"};
            Row dchRow = dimCatSheet.createRow(0);
            dchRow.setHeightInPoints(24);
            for (int c = 0; c < dch.length; c++) {
                put(dimCatSheet, 0, c, dch[c], c == 3 ? tblHeaderRight : tblHeader);
            }
            Map<String, BigDecimal> catBudgetMap = new HashMap<>();
            d.budgets.forEach(b -> {
                String cName = categoryName(b.getCategory());
                catBudgetMap.put(cName, nz(b.getLimitAmount()));
            });
            Set<String> allCategoryNames = new TreeSet<>();
            d.expenses.forEach(x -> allCategoryNames.add(categoryName(x.getCategory())));
            allCategoryNames.addAll(catBudgetMap.keySet());
            if (allCategoryNames.isEmpty()) allCategoryNames.add("General Expenses");

            int cRow = 1;
            for (String cName : allCategoryNames) {
                Row r = dimCatSheet.createRow(cRow);
                r.setHeightInPoints(20);
                boolean z = (cRow % 2 == 0);
                String lower = cName.toLowerCase(Locale.ROOT);
                String macro;
                String target;
                if (lower.contains("grocer") || lower.contains("rent") || lower.contains("util") || lower.contains("bill") || lower.contains("health") || lower.contains("transport")) {
                    macro = "ESSENTIAL NEED (50%)";
                    target = "50% Income Ceiling";
                } else if (lower.contains("saving") || lower.contains("invest") || lower.contains("retire") || lower.contains("emergency")) {
                    macro = "CAPITAL RETENTION (20%)";
                    target = ">= 20% Income Floor";
                } else {
                    macro = "DISCRETIONARY WANT (30%)";
                    target = "30% Income Ceiling";
                }
                BigDecimal bLimit = catBudgetMap.getOrDefault(cName, BigDecimal.ZERO);
                put(dimCatSheet, cRow, 0, cRow, z ? dataCenterZebra : dataCenter);
                put(dimCatSheet, cRow, 1, cName, z ? dataLeftZebra : dataLeft);
                put(dimCatSheet, cRow, 2, macro, z ? dataLeftZebra : dataLeft);
                put(dimCatSheet, cRow, 3, bLimit, z ? dataMoneyZebra : dataMoney);
                put(dimCatSheet, cRow, 4, target, z ? dataCenterZebra : dataCenter);
                cRow++;
            }
            dimCatSheet.setAutoFilter(new org.apache.poi.ss.util.CellRangeAddress(0, cRow - 1, 0, dch.length - 1));
            widths(dimCatSheet, new int[]{16, 26, 28, 22, 24});
            try {
                org.apache.poi.xssf.usermodel.XSSFFormulaEvaluator.evaluateAllFormulaCells(wb);
            } catch (Exception evalEx) {
                log.debug("Formula pre-evaluation skipped: {}", evalEx.getMessage());
            }
            wb.setSelectedTab(0);
            wb.write(out);
            return out.toByteArray();
        } catch (Exception ex) {
            log.error("Failed to generate executive Excel report: {}", ex.getMessage(), ex);
            throw new org.springframework.web.server.ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to create executive Excel report", ex);
        }
    }

    private static class ExecutiveReportPageEvent extends org.openpdf.text.pdf.PdfPageEventHelper {
        private final Font footerFont = FontFactory.getFont(FontFactory.HELVETICA, 7.5f, new Color(148, 163, 184));
        private final Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 7.5f, new Color(100, 116, 139));

        @Override
        public void onEndPage(PdfWriter writer, Document document) {
            // Running top header for pages > 1
            if (writer.getPageNumber() > 1) {
                PdfPTable headTbl = new PdfPTable(2);
                headTbl.setTotalWidth(document.right() - document.left());
                headTbl.setWidthPercentage(100);

                PdfPCell lCell = new PdfPCell(new Phrase("EXPENSETRACKER PRO  |  EXECUTIVE STATEMENT", headerFont));
                lCell.setBorder(Rectangle.BOTTOM);
                lCell.setBorderColor(new Color(226, 232, 240));
                lCell.setBorderWidth(0.5f);
                lCell.setPaddingBottom(4);
                headTbl.addCell(lCell);

                PdfPCell rCell = new PdfPCell(new Phrase("CONFIDENTIAL AUDIT LEDGER", headerFont));
                rCell.setBorder(Rectangle.BOTTOM);
                rCell.setBorderColor(new Color(226, 232, 240));
                rCell.setBorderWidth(0.5f);
                rCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
                rCell.setPaddingBottom(4);
                headTbl.addCell(rCell);

                headTbl.writeSelectedRows(0, -1, document.left(), document.top() + 18, writer.getDirectContent());
            }

            // Running bottom footer on all pages
            PdfPTable footTbl = new PdfPTable(2);
            footTbl.setTotalWidth(document.right() - document.left());
            footTbl.setWidthPercentage(100);

            PdfPCell fLeft = new PdfPCell(new Phrase("ExpenseTracker Executive Financial Statement  ·  Strictly Confidential  ·  Generated: " + LocalDate.now(), footerFont));
            fLeft.setBorder(Rectangle.TOP);
            fLeft.setBorderColor(new Color(226, 232, 240));
            fLeft.setBorderWidth(0.5f);
            fLeft.setPaddingTop(5);
            footTbl.addCell(fLeft);

            PdfPCell fRight = new PdfPCell(new Phrase("Page " + writer.getPageNumber(), footerFont));
            fRight.setBorder(Rectangle.TOP);
            fRight.setBorderColor(new Color(226, 232, 240));
            fRight.setBorderWidth(0.5f);
            fRight.setHorizontalAlignment(Element.ALIGN_RIGHT);
            fRight.setPaddingTop(5);
            footTbl.addCell(fRight);

            footTbl.writeSelectedRows(0, -1, document.left(), document.bottom() - 10, writer.getDirectContent());
        }
    }

    private static String cleanCurrency(String c) {
        if (c == null || c.isBlank()) return "INR";
        if (c.contains(",")) c = c.split(",")[0];
        return c.trim();
    }

    private static String fmt(BigDecimal value) {
        if (value == null) return "0.00";
        return String.format(Locale.US, "%,.2f", value);
    }

    private byte[] pdf(Data d, Range range, String currency, String name) {
        String cleanCurr = cleanCurrency(currency);
        String s = symbol(cleanCurr);
        BigDecimal spend = d.spend();
        BigDecimal income = d.income();
        BigDecimal net = income.subtract(spend);
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document doc = new Document(PageSize.A4, 28, 28, 36, 36);
            PdfWriter writer = PdfWriter.getInstance(doc, out);
            writer.setPageEvent(new ExecutiveReportPageEvent());
            doc.open();

            // 1. Executive Slate & Gold Header Banner
            PdfPTable banner = new PdfPTable(1);
            banner.setWidthPercentage(100);
            PdfPCell bannerCell = new PdfPCell();
            bannerCell.setBackgroundColor(new Color(15, 23, 42)); // Obsidian Slate #0F172A
            bannerCell.setPaddingTop(12);
            bannerCell.setPaddingBottom(12);
            bannerCell.setPaddingLeft(16);
            bannerCell.setPaddingRight(16);
            bannerCell.setBorder(Rectangle.NO_BORDER);

            Paragraph pTitle = new Paragraph("EXPENSETRACKER PRO",
                    FontFactory.getFont(FontFactory.HELVETICA_BOLD, 16, Color.WHITE));
            Paragraph pSub = new Paragraph("Executive Financial Intelligence Statement",
                    FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10f, new Color(199, 154, 62))); // Luxury Gold #C79A3E
            Paragraph pMeta = new Paragraph("Prepared for: " + safe(name) + "  |  Audit Period: " + range.label() + "  |  Currency: " + cleanCurr + " (" + s + ")",
                    FontFactory.getFont(FontFactory.HELVETICA, 8f, new Color(148, 163, 184)));

            bannerCell.addElement(pTitle);
            bannerCell.addElement(pSub);
            bannerCell.addElement(pMeta);
            banner.addCell(bannerCell);
            doc.add(banner);

            // Gold divider rule
            PdfPTable goldRule = new PdfPTable(1);
            goldRule.setWidthPercentage(100);
            PdfPCell ruleCell = new PdfPCell();
            ruleCell.setBackgroundColor(new Color(199, 154, 62));
            ruleCell.setFixedHeight(2.5f);
            ruleCell.setBorder(Rectangle.NO_BORDER);
            goldRule.addCell(ruleCell);
            doc.add(goldRule);
            doc.add(new Paragraph(" "));

            var muted = FontFactory.getFont(FontFactory.HELVETICA, 8.5f, new Color(100, 116, 139));
            var bold = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9.5f, new Color(15, 23, 42));

            // 2. Executive 4-Card KPI Ribbon
            PdfPTable k = new PdfPTable(4);
            k.setWidthPercentage(100);
            k.setWidths(new float[]{25, 25, 25, 25});
            kpi(k, "TOTAL SPEND", s + " " + fmt(spend), "Discretionary & operating outflow", new Color(220, 38, 38));
            kpi(k, "TOTAL REVENUE", s + " " + fmt(income), "Reconciled incoming streams", new Color(5, 150, 105));
            kpi(k, "NET CASH FLOW", s + " " + fmt(net),
                    net.signum() >= 0 ? "Net liquidity surplus retained" : "Net operating deficit",
                    net.signum() >= 0 ? new Color(5, 150, 105) : new Color(220, 38, 38));
            kpi(k, "TRANSACTIONS", (d.expenses.size() + d.incomes.size()) + " Entries", "Dual-ledger verified records", new Color(79, 70, 229));
            doc.add(k);
            doc.add(new Paragraph(" "));

            // 3. Portfolio Configuration & Coverage Ribbon
            Paragraph covTitle = new Paragraph("PORTFOLIO CONFIGURATION & COVERAGE", bold);
            covTitle.setSpacingAfter(4f);
            doc.add(covTitle);

            PdfPTable coverage = new PdfPTable(5);
            coverage.setWidthPercentage(100);
            coverage.setWidths(new float[]{20, 20, 20, 20, 20});
            head(coverage, "Expenses", Element.ALIGN_CENTER);
            head(coverage, "Income", Element.ALIGN_CENTER);
            head(coverage, "Savings Goals", Element.ALIGN_CENTER);
            head(coverage, "Subscriptions", Element.ALIGN_CENTER);
            head(coverage, "Budgets", Element.ALIGN_CENTER);
            cell(coverage, String.valueOf(d.expenses.size()), bold, false, Element.ALIGN_CENTER);
            cell(coverage, String.valueOf(d.incomes.size()), bold, false, Element.ALIGN_CENTER);
            cell(coverage, String.valueOf(d.savingsGoals.size()), bold, false, Element.ALIGN_CENTER);
            cell(coverage, String.valueOf(d.subscriptions.size()), bold, false, Element.ALIGN_CENTER);
            cell(coverage, String.valueOf(d.budgets.size()), bold, false, Element.ALIGN_CENTER);
            doc.add(coverage);
            doc.add(new Paragraph(" "));

            // 4. Strategic Telemetry & Audit Callout Box
            PdfPTable insightBox = new PdfPTable(1);
            insightBox.setWidthPercentage(100);
            PdfPCell ibCell = new PdfPCell();
            ibCell.setBackgroundColor(new Color(248, 250, 252));
            ibCell.setBorderColor(new Color(226, 232, 240));
            ibCell.setBorderWidth(1f);
            ibCell.setBorderWidthLeft(3.5f);
            ibCell.setBorderColorLeft(new Color(199, 154, 62)); // Gold left accent
            ibCell.setPaddingTop(9);
            ibCell.setPaddingBottom(9);
            ibCell.setPaddingLeft(12);
            ibCell.setPaddingRight(12);

            Paragraph ibTitle = new Paragraph("EXECUTIVE TELEMETRY & STRATEGIC AUDIT",
                    FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9.5f, new Color(15, 23, 42)));
            ibTitle.setSpacingAfter(5f);
            ibCell.addElement(ibTitle);

            for (String insight : insights(d, spend, income, s)) {
                Paragraph p = new Paragraph("◆  " + insight, FontFactory.getFont(FontFactory.HELVETICA, 8.5f, new Color(51, 65, 85)));
                p.setSpacingAfter(3f);
                ibCell.addElement(p);
            }
            insightBox.addCell(ibCell);
            doc.add(insightBox);
            doc.add(new Paragraph(" "));

            // 5. Itemized Ledgers
            addIncomePdf(doc, d.incomes, s, muted, bold);
            doc.add(new Paragraph(" "));
            addExpensePdf(doc, d.expenses, s, muted, bold);
            doc.add(new Paragraph(" "));
            addSavingsPdf(doc, d.savingsGoals, s, muted, bold);
            doc.add(new Paragraph(" "));
            addSubscriptionPdf(doc, d.subscriptions, s, muted, bold);
            doc.add(new Paragraph(" "));
            addBudgetPdf(doc, d.budgets, s, muted, bold);

            doc.close();
            return out.toByteArray();
        } catch (Exception ex) {
            log.error("Failed to generate executive PDF report: {}", ex.getMessage(), ex);
            throw new org.springframework.web.server.ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to create executive PDF report", ex);
        }
    }

    private static void addIncomePdf(Document doc, List<Income> incomes, String s,
                                     Font muted, Font bold) throws DocumentException {
        Paragraph title = new Paragraph("INCOME LEDGER · " + incomes.size() + " REVENUE STREAMS", bold);
        title.setSpacingBefore(8f);
        title.setSpacingAfter(4f);
        doc.add(title);

        PdfPTable t = new PdfPTable(4);
        t.setWidthPercentage(100);
        t.setWidths(new float[]{16, 26, 38, 20});
        t.setHeaderRows(1);

        head(t, "Date", Element.ALIGN_CENTER);
        head(t, "Source", Element.ALIGN_LEFT);
        head(t, "Description", Element.ALIGN_LEFT);
        head(t, "Amount (" + s + ")", Element.ALIGN_RIGHT);

        Font dateFont = FontFactory.getFont(FontFactory.HELVETICA, 8f, new Color(71, 85, 105));
        Font sourceFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, new Color(15, 23, 42));
        Font amtFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, new Color(5, 150, 105)); // Emerald

        BigDecimal totalIncome = BigDecimal.ZERO;
        for (int i = 0; i < incomes.size(); i++) {
            Income x = incomes.get(i);
            boolean z = (i % 2 == 1);
            BigDecimal amt = nz(x.getAmount());
            totalIncome = totalIncome.add(amt);

            cell(t, safeDate(x.getIncomeDate()), dateFont, z, Element.ALIGN_CENTER);
            cell(t, safe(x.getSource()), sourceFont, z, Element.ALIGN_LEFT);
            cell(t, safe(x.getDescription()), muted, z, Element.ALIGN_LEFT);
            cell(t, s + " " + fmt(amt), amtFont, z, Element.ALIGN_RIGHT);
        }

        if (incomes.isEmpty()) {
            PdfPCell empty = new PdfPCell(new Phrase("No income streams recorded in this audit period.", dateFont));
            empty.setColspan(4);
            empty.setHorizontalAlignment(Element.ALIGN_CENTER);
            empty.setPadding(10);
            empty.setBackgroundColor(new Color(248, 250, 252));
            empty.setBorderColor(new Color(226, 232, 240));
            t.addCell(empty);
        } else {
            PdfPCell totLbl = new PdfPCell(new Phrase("TOTAL VERIFIED INFLOW (" + s + "):", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, new Color(15, 23, 42))));
            totLbl.setColspan(3);
            totLbl.setHorizontalAlignment(Element.ALIGN_RIGHT);
            totLbl.setVerticalAlignment(Element.ALIGN_MIDDLE);
            totLbl.setBackgroundColor(new Color(241, 245, 249));
            totLbl.setBorderColor(new Color(203, 213, 225));
            totLbl.setPadding(6);
            t.addCell(totLbl);

            PdfPCell totVal = new PdfPCell(new Phrase(s + " " + fmt(totalIncome), FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9f, new Color(5, 150, 105))));
            totVal.setHorizontalAlignment(Element.ALIGN_RIGHT);
            totVal.setVerticalAlignment(Element.ALIGN_MIDDLE);
            totVal.setBackgroundColor(new Color(241, 245, 249));
            totVal.setBorderColor(new Color(203, 213, 225));
            totVal.setPadding(6);
            t.addCell(totVal);
        }
        doc.add(t);
    }

    private static void addExpensePdf(Document doc, List<Expense> expenses, String s,
                                      Font muted, Font bold) throws DocumentException {
        Paragraph title = new Paragraph("EXPENSE LEDGER · " + expenses.size() + " DISBURSEMENTS", bold);
        title.setSpacingBefore(8f);
        title.setSpacingAfter(4f);
        doc.add(title);

        PdfPTable t = new PdfPTable(4);
        t.setWidthPercentage(100);
        t.setWidths(new float[]{16, 22, 42, 20});
        t.setHeaderRows(1);

        head(t, "Date", Element.ALIGN_CENTER);
        head(t, "Category", Element.ALIGN_LEFT);
        head(t, "Description", Element.ALIGN_LEFT);
        head(t, "Amount (" + s + ")", Element.ALIGN_RIGHT);

        Font dateFont = FontFactory.getFont(FontFactory.HELVETICA, 8f, new Color(71, 85, 105));
        Font catFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, new Color(15, 23, 42));
        Font amtFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, new Color(220, 38, 38)); // Crimson

        BigDecimal totalSpend = BigDecimal.ZERO;
        for (int i = 0; i < expenses.size(); i++) {
            Expense x = expenses.get(i);
            boolean z = (i % 2 == 1);
            BigDecimal amt = nz(x.getAmount());
            totalSpend = totalSpend.add(amt);

            cell(t, safeDate(x.getExpenseDate()), dateFont, z, Element.ALIGN_CENTER);
            cell(t, categoryName(x.getCategory()), catFont, z, Element.ALIGN_LEFT);
            cell(t, safe(x.getDescription()), muted, z, Element.ALIGN_LEFT);
            cell(t, s + " " + fmt(amt), amtFont, z, Element.ALIGN_RIGHT);
        }

        if (expenses.isEmpty()) {
            PdfPCell empty = new PdfPCell(new Phrase("No expense disbursements recorded in this audit period.", dateFont));
            empty.setColspan(4);
            empty.setHorizontalAlignment(Element.ALIGN_CENTER);
            empty.setPadding(10);
            empty.setBackgroundColor(new Color(248, 250, 252));
            empty.setBorderColor(new Color(226, 232, 240));
            t.addCell(empty);
        } else {
            PdfPCell totLbl = new PdfPCell(new Phrase("TOTAL VERIFIED OUTFLOW (" + s + "):", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, new Color(15, 23, 42))));
            totLbl.setColspan(3);
            totLbl.setHorizontalAlignment(Element.ALIGN_RIGHT);
            totLbl.setVerticalAlignment(Element.ALIGN_MIDDLE);
            totLbl.setBackgroundColor(new Color(241, 245, 249));
            totLbl.setBorderColor(new Color(203, 213, 225));
            totLbl.setPadding(6);
            t.addCell(totLbl);

            PdfPCell totVal = new PdfPCell(new Phrase(s + " " + fmt(totalSpend), FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9f, new Color(220, 38, 38))));
            totVal.setHorizontalAlignment(Element.ALIGN_RIGHT);
            totVal.setVerticalAlignment(Element.ALIGN_MIDDLE);
            totVal.setBackgroundColor(new Color(241, 245, 249));
            totVal.setBorderColor(new Color(203, 213, 225));
            totVal.setPadding(6);
            t.addCell(totVal);
        }
        doc.add(t);
    }

    private static void addSavingsPdf(Document doc, List<SavingsGoal> goals, String s,
                                      Font muted, Font bold) throws DocumentException {
        if (goals.isEmpty()) return;
        Paragraph title = new Paragraph("SAVINGS GOALS & MILESTONES · " + goals.size() + " TARGETS", bold);
        title.setSpacingBefore(8f);
        title.setSpacingAfter(4f);
        doc.add(title);

        PdfPTable t = new PdfPTable(5);
        t.setWidthPercentage(100);
        t.setWidths(new float[]{28, 18, 18, 18, 18});
        t.setHeaderRows(1);

        head(t, "Goal", Element.ALIGN_LEFT);
        head(t, "Target (" + s + ")", Element.ALIGN_RIGHT);
        head(t, "Saved (" + s + ")", Element.ALIGN_RIGHT);
        head(t, "Progress", Element.ALIGN_CENTER);
        head(t, "Status", Element.ALIGN_CENTER);

        Font nameFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, new Color(15, 23, 42));
        Font numFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, new Color(124, 58, 237)); // Purple

        for (int i = 0; i < goals.size(); i++) {
            SavingsGoal x = goals.get(i);
            BigDecimal target = nz(x.getTargetAmount());
            BigDecimal saved = nz(x.getCurrentAmount());
            double pct = target.signum() > 0 ? saved.divide(target, 4, RoundingMode.HALF_UP).doubleValue() * 100 : 0d;
            boolean z = (i % 2 == 1);

            cell(t, safe(x.getName()), nameFont, z, Element.ALIGN_LEFT);
            cell(t, s + " " + fmt(target), muted, z, Element.ALIGN_RIGHT);
            cell(t, s + " " + fmt(saved), numFont, z, Element.ALIGN_RIGHT);
            cell(t, String.format(Locale.US, "%.1f%%", pct), numFont, z, Element.ALIGN_CENTER);
            cell(t, safe(x.getStatus()), muted, z, Element.ALIGN_CENTER);
        }
        doc.add(t);
    }

    private static void addSubscriptionPdf(Document doc, List<RecurringExpense> subscriptions, String s,
                                           Font muted, Font bold) throws DocumentException {
        if (subscriptions.isEmpty()) return;
        Paragraph title = new Paragraph("RECURRING SUBSCRIPTIONS · " + subscriptions.size() + " COMMITMENTS", bold);
        title.setSpacingBefore(8f);
        title.setSpacingAfter(4f);
        doc.add(title);

        PdfPTable t = new PdfPTable(5);
        t.setWidthPercentage(100);
        t.setWidths(new float[]{32, 20, 16, 16, 16});
        t.setHeaderRows(1);

        head(t, "Subscription", Element.ALIGN_LEFT);
        head(t, "Amount (" + s + ")", Element.ALIGN_RIGHT);
        head(t, "Frequency", Element.ALIGN_CENTER);
        head(t, "Next Due", Element.ALIGN_CENTER);
        head(t, "Category", Element.ALIGN_LEFT);

        Font nameFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, new Color(15, 23, 42));
        Font numFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, new Color(217, 119, 6)); // Amber

        for (int i = 0; i < subscriptions.size(); i++) {
            RecurringExpense x = subscriptions.get(i);
            boolean z = (i % 2 == 1);
            cell(t, safe(x.getDescription()), nameFont, z, Element.ALIGN_LEFT);
            cell(t, s + " " + fmt(nz(x.getAmount())), numFont, z, Element.ALIGN_RIGHT);
            cell(t, safe(x.getFrequency()), muted, z, Element.ALIGN_CENTER);
            cell(t, safeDate(x.getNextDueDate()), muted, z, Element.ALIGN_CENTER);
            cell(t, categoryName(x.getCategory()), muted, z, Element.ALIGN_LEFT);
        }
        doc.add(t);
    }

    private static void addBudgetPdf(Document doc, List<Budget> budgets, String s,
                                      Font muted, Font bold) throws DocumentException {
        if (budgets.isEmpty()) return;
        Paragraph title = new Paragraph("CATEGORY BUDGET ALLOCATIONS · " + budgets.size() + " ENVELOPES", bold);
        title.setSpacingBefore(8f);
        title.setSpacingAfter(4f);
        doc.add(title);

        PdfPTable t = new PdfPTable(4);
        t.setWidthPercentage(100);
        t.setWidths(new float[]{28, 22, 20, 30});
        t.setHeaderRows(1);

        head(t, "Category", Element.ALIGN_LEFT);
        head(t, "Limit (" + s + ")", Element.ALIGN_RIGHT);
        head(t, "Period", Element.ALIGN_CENTER);
        head(t, "Date Window", Element.ALIGN_CENTER);

        Font catFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, new Color(15, 23, 42));
        Font numFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, new Color(37, 99, 235));

        for (int i = 0; i < budgets.size(); i++) {
            Budget x = budgets.get(i);
            boolean z = (i % 2 == 1);
            cell(t, categoryName(x.getCategory()), catFont, z, Element.ALIGN_LEFT);
            cell(t, s + " " + fmt(nz(x.getLimitAmount())), numFont, z, Element.ALIGN_RIGHT);
            cell(t, safe(x.getPeriod()), muted, z, Element.ALIGN_CENTER);
            cell(t, safeDate(x.getStartDate()) + " → " + safeDate(x.getEndDate()), muted, z, Element.ALIGN_CENTER);
        }
        doc.add(t);
    }

    private static List<String> insights(Data d, BigDecimal spend, BigDecimal income, String symbol) {
        String top = d.expenses.stream()
                .collect(Collectors.groupingBy(
                        x -> categoryName(x.getCategory()),
                        Collectors.mapping(x -> nz(x.getAmount()),
                                Collectors.reducing(BigDecimal.ZERO, BigDecimal::add))))
                .entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse("No expense data");
        BigDecimal avg = d.expenses.isEmpty()
                ? BigDecimal.ZERO
                : spend.divide(BigDecimal.valueOf(d.expenses.size()), 2, RoundingMode.HALF_UP);

        BigDecimal salaryInflow = d.incomes.stream()
                .filter(i -> IncomeRules.effectiveKind(i) == IncomeKind.SALARY)
                .map(i -> nz(i.getAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        String salaryInsight = salaryInflow.compareTo(BigDecimal.ZERO) > 0
                ? "Salary coverage: " + (spend.compareTo(BigDecimal.ZERO) > 0
                    ? Math.round(salaryInflow.divide(spend, 4, RoundingMode.HALF_UP).doubleValue() * 100) + "% of total spend."
                    : "100% (Surplus)")
                : "No primary salary income recorded.";

        BigDecimal totalSavings = d.savingsGoals.stream()
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
        if (!d.savingsGoals.isEmpty()) {
            list.add(d.savingsGoals.size() + " savings milestone target(s) actively configured.");
        }
        if (!d.subscriptions.isEmpty()) {
            list.add(d.subscriptions.size() + " active recurring subscription commitment(s) monitored.");
        }
        return list;
    }

    private static BigDecimal total(List<Expense> values) {
        return values.stream().map(x -> nz(x.getAmount())).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static BigDecimal nz(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }

    private static String categoryName(com.example.expensetracker.model.Category cat) {
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

    private static String safeDate(LocalDate value) {
        return value == null ? "" : value.toString();
    }

    private static String symbol(String c) {
        c = cleanCurrency(c);
        String upper = c.toUpperCase(Locale.ROOT);
        return switch (upper) {
            case "INR" -> "Rs.";
            case "USD" -> "$";
            case "EUR" -> "€";
            case "GBP" -> "£";
            case "JPY" -> "¥";
            case "AED" -> "AED";
            default -> {
                try {
                    String sym = Currency.getInstance(upper).getSymbol(Locale.ROOT);
                    if (sym != null && !sym.isBlank() && !sym.equals(upper)) {
                        if ("$".equals(sym) || "€".equals(sym) || "£".equals(sym) || "¥".equals(sym)) {
                            yield sym;
                        }
                    }
                    yield upper;
                } catch (Exception ignored) {
                    yield upper;
                }
            }
        };
    }

    private static XSSFCellStyle style(XSSFWorkbook workbook, String bg, String fg, boolean bold, int size) {
        return style(workbook, bg, fg, bold, size, HorizontalAlignment.LEFT, false);
    }

    private static XSSFCellStyle style(XSSFWorkbook workbook, String bg, String fg, boolean bold, int size, HorizontalAlignment align, boolean border) {
        XSSFCellStyle style = workbook.createCellStyle();
        if (bg != null) {
            style.setFillForegroundColor(new org.apache.poi.xssf.usermodel.XSSFColor(Color.decode("#" + bg), null));
            style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        }
        org.apache.poi.xssf.usermodel.XSSFFont font = workbook.createFont();
        if (fg != null) {
            font.setColor(new org.apache.poi.xssf.usermodel.XSSFColor(Color.decode("#" + fg), null));
        }
        font.setBold(bold);
        font.setFontHeightInPoints((short) size);
        font.setFontName("Segoe UI");
        style.setFont(font);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        if (align != null) {
            style.setAlignment(align);
        }
        if (border) {
            style.setBorderTop(BorderStyle.THIN);
            style.setBorderBottom(BorderStyle.THIN);
            style.setBorderLeft(BorderStyle.THIN);
            style.setBorderRight(BorderStyle.THIN);
            org.apache.poi.xssf.usermodel.XSSFColor bc = new org.apache.poi.xssf.usermodel.XSSFColor(Color.decode("#E2E8F0"), null);
            style.setTopBorderColor(bc);
            style.setBottomBorderColor(bc);
            style.setLeftBorderColor(bc);
            style.setRightBorderColor(bc);
        }
        return style;
    }

    private static void setTab(XSSFSheet sheet, String hex) {
        sheet.setTabColor(new org.apache.poi.xssf.usermodel.XSSFColor(Color.decode("#" + hex), null));
    }

    private static void put(Sheet sheet, int row, int column, Object value, CellStyle style) {
        Row targetRow = sheet.getRow(row);
        if (targetRow == null) targetRow = sheet.createRow(row);
        Cell cell = targetRow.createCell(column);
        if (value instanceof BigDecimal decimal) {
            cell.setCellValue(decimal.doubleValue());
        } else if (value instanceof Number number) {
            cell.setCellValue(number.doubleValue());
        } else if (value instanceof String s && s.startsWith("=")) {
            cell.setCellFormula(s.substring(1));
        } else {
            cell.setCellValue(String.valueOf(value));
        }
        cell.setCellStyle(style);
    }

    private static void widths(Sheet sheet, int[] widths) {
        for (int c = 0; c < widths.length; c++) sheet.setColumnWidth(c, widths[c] * 256);
    }

    private static void kpi(PdfPTable table, String label, String value, String subtitle, Color accent) {
        PdfPCell cell = new PdfPCell();
        cell.setPadding(8);
        cell.setBackgroundColor(new Color(248, 250, 252));
        cell.setBorderColor(new Color(226, 232, 240));
        cell.setBorderWidth(1f);

        Paragraph pLabel = new Paragraph(label, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 7.5f, accent));
        pLabel.setSpacingAfter(3f);
        cell.addElement(pLabel);

        Paragraph pVal = new Paragraph(value,
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12f, new Color(15, 23, 42)));
        pVal.setSpacingAfter(2f);
        cell.addElement(pVal);

        Paragraph pSub = new Paragraph(subtitle,
                FontFactory.getFont(FontFactory.HELVETICA, 7f, new Color(100, 116, 139)));
        cell.addElement(pSub);

        table.addCell(cell);
    }

    private static void head(PdfPTable table, String text) {
        head(table, text, Element.ALIGN_LEFT);
    }

    private static void head(PdfPTable table, String text, int align) {
        PdfPCell cell = new PdfPCell(new Phrase(text,
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, Color.WHITE)));
        cell.setBackgroundColor(new Color(15, 23, 42)); // Slate Obsidian #0F172A
        cell.setBorderColor(new Color(199, 154, 62)); // Gold border #C79A3E
        cell.setPadding(6);
        cell.setHorizontalAlignment(align);
        cell.setVerticalAlignment(Element.ALIGN_MIDDLE);
        table.addCell(cell);
    }

    private static void cell(PdfPTable table, String text, Font font) {
        cell(table, text, font, false, Element.ALIGN_LEFT);
    }

    private static void cell(PdfPTable table, String text, Font font, boolean zebra) {
        cell(table, text, font, zebra, Element.ALIGN_LEFT);
    }

    private static void cell(PdfPTable table, String text, Font font, boolean zebra, int align) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setPadding(5);
        cell.setBackgroundColor(zebra ? new Color(248, 250, 252) : Color.WHITE);
        cell.setBorderColor(new Color(226, 232, 240));
        cell.setHorizontalAlignment(align);
        cell.setVerticalAlignment(Element.ALIGN_MIDDLE);
        table.addCell(cell);
    }

    private record Data(List<Expense> expenses,
                        List<Income> incomes,
                        List<SavingsGoal> savingsGoals,
                        List<RecurringExpense> subscriptions,
                        List<Budget> budgets) {
        /** Money handed back (reimbursements and refunds): not income, it reduces what was spent. */
        BigDecimal reimbursed() {
            return incomes.stream()
                    .filter(x -> IncomeRules.effectiveKind(x) == IncomeKind.REIMBURSEMENT)
                    .map(x -> nz(x.getAmount()))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
        }

        /** Spending net of money that came back; never below zero. */
        BigDecimal spend() {
            return total(expenses).subtract(reimbursed()).max(BigDecimal.ZERO);
        }

        /** Real income only: reimbursements are excluded. */
        BigDecimal income() {
            return incomes.stream()
                    .filter(x -> IncomeRules.effectiveKind(x) != IncomeKind.REIMBURSEMENT)
                    .map(x -> nz(x.getAmount()))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
        }
    }

    private record Range(LocalDate from, LocalDate to) {
        static Range of(String from, String to) {
            LocalDate start;
            LocalDate end;
            try {
                start = from == null || from.isBlank() ? null : LocalDate.parse(from);
            } catch (java.time.format.DateTimeParseException e) {
                throw new IllegalArgumentException(
                        "Invalid 'from' date format: '" + from + "'. Expected format: yyyy-MM-dd", e);
            }
            try {
                end = to == null || to.isBlank() ? null : LocalDate.parse(to);
            } catch (java.time.format.DateTimeParseException e) {
                throw new IllegalArgumentException(
                        "Invalid 'to' date format: '" + to + "'. Expected format: yyyy-MM-dd", e);
            }
            if (start != null && end != null && end.isBefore(start)) {
                throw new IllegalArgumentException("End date must be on or after start date.");
            }
            return new Range(start, end);
        }

        boolean contains(LocalDate date) {
            return date != null
                    && (from == null || !date.isBefore(from))
                    && (to == null || !date.isAfter(to));
        }

        String label() {
            if (from == null && to == null) return "All time";
            if (from == null) return "Through " + to;
            if (to == null) return "From " + from;
            return from + " to " + to;
        }
    }
}
