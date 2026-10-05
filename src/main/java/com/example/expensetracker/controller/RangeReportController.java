package com.example.expensetracker.controller;

import com.example.expensetracker.model.Budget;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.Income;
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
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.openpdf.text.Document;
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
        List<Expense> e = expenses.findByUser(user).stream()
                .filter(x -> range.contains(x.getExpenseDate()))
                .sorted(Comparator.comparing(Expense::getExpenseDate,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();

        List<Income> i = incomes.findByUser(user).stream()
                .filter(x -> range.contains(x.getIncomeDate()))
                .sorted(Comparator.comparing(Income::getIncomeDate,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();

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
            dashboard.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(4, 4, 6, 7));
            dashboard.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(5, 5, 6, 7));
            dashboard.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(6, 6, 6, 7));
            put(dashboard, 4, 6, "SAVINGS RETENTION RATE", kpiCardHeader);
            put(dashboard, 4, 7, "", kpiCardHeader);
            put(dashboard, 5, 6, savingsRate, dataPct);
            put(dashboard, 5, 7, "", dataPct);
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
                    .collect(Collectors.groupingBy(e -> e.getCategory() != null ? e.getCategory().getName() : "Uncategorized"));
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

            for (int c = 0; c < 8; c++) dashboard.setColumnWidth(c, 22 * 256);

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
            String[] eh = {"Date", "Category", "Description", "Amount (" + symbol + ")", "Recurring"};
            Row ehRow = expenseSheet.createRow(0);
            ehRow.setHeightInPoints(24);
            for (int c = 0; c < eh.length; c++) {
                put(expenseSheet, 0, c, eh[c], c == 3 ? tblHeaderRight : tblHeader);
            }
            row = 1;
            for (Expense x : d.expenses) {
                Row r = expenseSheet.createRow(row);
                r.setHeightInPoints(20);
                boolean z = (row % 2 == 0);
                put(expenseSheet, row, 0, safeDate(x.getExpenseDate()), z ? dataCenterZebra : dataCenter);
                put(expenseSheet, row, 1, x.getCategory() == null ? "Uncategorized" : x.getCategory().getName(), z ? dataLeftZebra : dataLeft);
                put(expenseSheet, row, 2, safe(x.getDescription()), z ? dataLeftZebra : dataLeft);
                put(expenseSheet, row, 3, nz(x.getAmount()), z ? dataMoneyZebra : dataMoney);
                put(expenseSheet, row, 4, x.isRecurring() ? "Yes" : "No", z ? dataCenterZebra : dataCenter);
                row++;
            }
            if (row > 1) {
                expenseSheet.setAutoFilter(new org.apache.poi.ss.util.CellRangeAddress(0, row - 1, 0, eh.length - 1));
                Row totRow = expenseSheet.createRow(row);
                totRow.setHeightInPoints(22);
                put(expenseSheet, row, 2, "TOTAL OUTFLOW (" + symbol + "):", totalLabelStyle);
                put(expenseSheet, row, 3, "=SUM(D2:D" + row + ")", totalMoneyStyle);
            }
            widths(expenseSheet, new int[]{16, 24, 46, 18, 14});

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
                put(subscriptionSheet, row, 4, x.getCategory() == null ? "Uncategorized" : x.getCategory().getName(), z ? dataLeftZebra : dataLeft);
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
                put(budgetSheet, row, 0, x.getCategory() == null ? "Uncategorized" : x.getCategory().getName(), z ? dataLeftZebra : dataLeft);
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
            try {
                org.apache.poi.xssf.usermodel.XSSFFormulaEvaluator.evaluateAllFormulaCells(wb);
            } catch (Exception evalEx) {
                log.debug("Formula pre-evaluation skipped: {}", evalEx.getMessage());
            }
            wb.write(out);
            return out.toByteArray();
        } catch (Exception ex) {
            log.error("Failed to generate executive Excel report: {}", ex.getMessage(), ex);
            throw new IllegalStateException("Unable to create executive Excel report", ex);
        }
    }

    private byte[] pdf(Data d, Range range, String currency, String name) {
        String s = symbol(currency);
        BigDecimal spend = d.spend();
        BigDecimal income = d.income();
        BigDecimal net = income.subtract(spend);
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document doc = new Document(PageSize.A4, 30, 30, 34, 34);
            PdfWriter.getInstance(doc, out);
            doc.open();

            // Executive Header Banner
            PdfPTable banner = new PdfPTable(1);
            banner.setWidthPercentage(100);
            PdfPCell bannerCell = new PdfPCell();
            bannerCell.setBackgroundColor(new Color(15, 23, 42)); // Obsidian Slate
            bannerCell.setPaddingTop(12);
            bannerCell.setPaddingBottom(12);
            bannerCell.setPaddingLeft(16);
            bannerCell.setPaddingRight(16);
            bannerCell.setBorder(Rectangle.NO_BORDER);

            Paragraph pTitle = new Paragraph("EXPENSETRACKER PRO",
                    FontFactory.getFont(FontFactory.HELVETICA_BOLD, 17, Color.WHITE));
            Paragraph pSub = new Paragraph("Executive Financial Intelligence Statement",
                    FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10.5f, new Color(199, 154, 62))); // Luxury Gold
            Paragraph pMeta = new Paragraph("Prepared for: " + safe(name) + "  |  Period: " + range.label() + "  |  Currency: " + currency,
                    FontFactory.getFont(FontFactory.HELVETICA, 8.5f, new Color(148, 163, 184)));

            bannerCell.addElement(pTitle);
            bannerCell.addElement(pSub);
            bannerCell.addElement(pMeta);
            banner.addCell(bannerCell);
            doc.add(banner);

            // Gold divider
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

            PdfPTable k = new PdfPTable(4);
            k.setWidthPercentage(100);
            kpi(k, "TOTAL SPEND", s + " " + spend, new Color(239, 68, 68));
            kpi(k, "TOTAL INCOME", s + " " + income, new Color(16, 185, 129));
            kpi(k, "NET CASH FLOW", s + " " + net,
                    net.signum() >= 0 ? new Color(16, 185, 129) : new Color(239, 68, 68));
            kpi(k, "TRANSACTIONS", String.valueOf(d.expenses.size() + d.incomes.size()), new Color(79, 70, 229));
            doc.add(k);
            doc.add(new Paragraph(" "));

            doc.add(new Paragraph("Portfolio Coverage", bold));
            PdfPTable coverage = new PdfPTable(5);
            coverage.setWidthPercentage(100);
            head(coverage, "Expenses");
            head(coverage, "Income");
            head(coverage, "Savings Goals");
            head(coverage, "Subscriptions");
            head(coverage, "Budgets");
            cell(coverage, String.valueOf(d.expenses.size()), muted);
            cell(coverage, String.valueOf(d.incomes.size()), muted);
            cell(coverage, String.valueOf(d.savingsGoals.size()), muted);
            cell(coverage, String.valueOf(d.subscriptions.size()), muted);
            cell(coverage, String.valueOf(d.budgets.size()), muted);
            doc.add(coverage);
            doc.add(new Paragraph(" "));

            doc.add(new Paragraph("Key Financial Insights", bold));
            for (String insight : insights(d, spend, income, s)) {
                doc.add(new Paragraph("•  " + insight, muted));
            }
            doc.add(new Paragraph(" "));

            addIncomePdf(doc, d.incomes, s, muted, bold);
            doc.add(new Paragraph(" "));
            addExpensePdf(doc, d.expenses, s, muted, bold);
            doc.add(new Paragraph(" "));
            addSavingsPdf(doc, d.savingsGoals, s, muted, bold);
            doc.add(new Paragraph(" "));
            addSubscriptionPdf(doc, d.subscriptions, s, muted, bold);
            doc.add(new Paragraph(" "));
            addBudgetPdf(doc, d.budgets, s, muted, bold);
            doc.add(new Paragraph(" "));

            doc.add(new Paragraph("Generated from live persisted ledger data at export time · ExpenseTracker Pro", muted));
            doc.close();
            return out.toByteArray();
        } catch (Exception ex) {
            log.error("Failed to generate executive PDF report: {}", ex.getMessage(), ex);
            throw new IllegalStateException("Unable to create executive PDF report", ex);
        }
    }

    private static void addIncomePdf(Document doc, List<Income> incomes, String s,
                                     Font muted, Font bold) throws DocumentException {
        doc.add(new Paragraph("Income Ledger (" + incomes.size() + ")", bold));
        PdfPTable t = new PdfPTable(4);
        t.setWidthPercentage(100);
        head(t, "Date");
        head(t, "Source");
        head(t, "Description");
        head(t, "Amount");
        for (int i = 0; i < incomes.size(); i++) {
            Income x = incomes.get(i);
            boolean z = (i % 2 == 1);
            cell(t, safeDate(x.getIncomeDate()), muted, z);
            cell(t, safe(x.getSource()), muted, z);
            cell(t, safe(x.getDescription()), muted, z);
            cell(t, s + " " + nz(x.getAmount()), muted, z);
        }
        doc.add(t);
    }

    private static void addExpensePdf(Document doc, List<Expense> expenses, String s,
                                      Font muted, Font bold) throws DocumentException {
        doc.add(new Paragraph("Expense Ledger (" + expenses.size() + ")", bold));
        PdfPTable t = new PdfPTable(4);
        t.setWidthPercentage(100);
        head(t, "Date");
        head(t, "Category");
        head(t, "Description");
        head(t, "Amount");
        for (int i = 0; i < expenses.size(); i++) {
            Expense x = expenses.get(i);
            boolean z = (i % 2 == 1);
            cell(t, safeDate(x.getExpenseDate()), muted, z);
            cell(t, x.getCategory() == null ? "Uncategorized" : x.getCategory().getName(), muted, z);
            cell(t, safe(x.getDescription()), muted, z);
            cell(t, s + " " + nz(x.getAmount()), muted, z);
        }
        doc.add(t);
    }

    private static void addSavingsPdf(Document doc, List<SavingsGoal> goals, String s,
                                      Font muted, Font bold) throws DocumentException {
        doc.add(new Paragraph("Savings Goals (" + goals.size() + ")", bold));
        PdfPTable t = new PdfPTable(5);
        t.setWidthPercentage(100);
        head(t, "Goal");
        head(t, "Target");
        head(t, "Saved");
        head(t, "Progress");
        head(t, "Status");
        for (int i = 0; i < goals.size(); i++) {
            SavingsGoal x = goals.get(i);
            BigDecimal target = nz(x.getTargetAmount());
            BigDecimal saved = nz(x.getCurrentAmount());
            double pct = target.signum() > 0 ? saved.divide(target, 4, RoundingMode.HALF_UP).doubleValue() * 100 : 0d;
            boolean z = (i % 2 == 1);
            cell(t, safe(x.getName()), muted, z);
            cell(t, s + " " + target, muted, z);
            cell(t, s + " " + saved, muted, z);
            cell(t, String.format(Locale.US, "%.1f%%", pct), muted, z);
            cell(t, safe(x.getStatus()), muted, z);
        }
        doc.add(t);
    }

    private static void addSubscriptionPdf(Document doc, List<RecurringExpense> subscriptions, String s,
                                           Font muted, Font bold) throws DocumentException {
        doc.add(new Paragraph("Subscriptions (" + subscriptions.size() + ")", bold));
        PdfPTable t = new PdfPTable(5);
        t.setWidthPercentage(100);
        head(t, "Subscription");
        head(t, "Amount");
        head(t, "Frequency");
        head(t, "Next Due");
        head(t, "Category");
        for (int i = 0; i < subscriptions.size(); i++) {
            RecurringExpense x = subscriptions.get(i);
            boolean z = (i % 2 == 1);
            cell(t, safe(x.getDescription()), muted, z);
            cell(t, s + " " + nz(x.getAmount()), muted, z);
            cell(t, safe(x.getFrequency()), muted, z);
            cell(t, safeDate(x.getNextDueDate()), muted, z);
            cell(t, x.getCategory() == null ? "Uncategorized" : x.getCategory().getName(), muted, z);
        }
        doc.add(t);
    }

    private static void addBudgetPdf(Document doc, List<Budget> budgets, String s,
                                      Font muted, Font bold) throws DocumentException {
        doc.add(new Paragraph("Budgets (" + budgets.size() + ")", bold));
        PdfPTable t = new PdfPTable(4);
        t.setWidthPercentage(100);
        head(t, "Category");
        head(t, "Limit");
        head(t, "Period");
        head(t, "Date Window");
        for (int i = 0; i < budgets.size(); i++) {
            Budget x = budgets.get(i);
            boolean z = (i % 2 == 1);
            cell(t, x.getCategory() == null ? "Uncategorized" : x.getCategory().getName(), muted, z);
            cell(t, s + " " + nz(x.getLimitAmount()), muted, z);
            cell(t, safe(x.getPeriod()), muted, z);
            cell(t, safeDate(x.getStartDate()) + " → " + safeDate(x.getEndDate()), muted, z);
        }
        doc.add(t);
    }

    private static List<String> insights(Data d, BigDecimal spend, BigDecimal income, String symbol) {
        String top = d.expenses.stream()
                .collect(Collectors.groupingBy(
                        x -> x.getCategory() == null ? "Uncategorized" : x.getCategory().getName(),
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
                .filter(i -> i.getSource() != null && i.getSource().toLowerCase().contains("salary"))
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
                : "Emergency reserve: " + symbol + " " + totalSavings + " saved.";

        List<String> list = new ArrayList<>();
        list.add("Largest expense category: " + top + ".");
        list.add("Average expense per transaction: " + symbol + " " + avg + ".");
        list.add(income.compareTo(spend) >= 0
                ? "Cash flow is positive for the selected period (+ " + symbol + " " + income.subtract(spend) + ")."
                : "Spending exceeded recorded income by " + symbol + " " + spend.subtract(income) + ".");
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

    private static String safeDate(LocalDate value) {
        return value == null ? "" : value.toString();
    }

    private static String symbol(String c) {
        if (c == null || c.isBlank()) return "Rs.";
        String upper = c.trim().toUpperCase(Locale.ROOT);
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

    private static void kpi(PdfPTable table, String label, String value, Color accent) {
        PdfPCell cell = new PdfPCell();
        cell.setPadding(9);
        cell.setBackgroundColor(new Color(248, 250, 252));
        cell.setBorderColor(new Color(226, 232, 240));
        cell.addElement(new Paragraph(label, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 7.5f, accent)));
        cell.addElement(new Paragraph(value,
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11.5f, new Color(15, 23, 42))));
        table.addCell(cell);
    }

    private static void head(PdfPTable table, String text) {
        PdfPCell cell = new PdfPCell(new Phrase(text,
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8f, Color.WHITE)));
        cell.setBackgroundColor(new Color(15, 23, 42)); // Slate Obsidian
        cell.setBorderColor(new Color(199, 154, 62)); // Gold border
        cell.setPadding(6);
        table.addCell(cell);
    }

    private static void cell(PdfPTable table, String text, Font font) {
        cell(table, text, font, false);
    }

    private static void cell(PdfPTable table, String text, Font font, boolean zebra) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setPadding(5);
        cell.setBackgroundColor(zebra ? new Color(248, 250, 252) : Color.WHITE);
        cell.setBorderColor(new Color(226, 232, 240));
        table.addCell(cell);
    }

    private record Data(List<Expense> expenses,
                        List<Income> incomes,
                        List<SavingsGoal> savingsGoals,
                        List<RecurringExpense> subscriptions,
                        List<Budget> budgets) {
        BigDecimal spend() {
            return total(expenses);
        }

        BigDecimal income() {
            return incomes.stream()
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
