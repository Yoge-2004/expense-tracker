package com.example.expensetracker.domain.report.service;

import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xddf.usermodel.chart.*;
import org.apache.poi.xssf.usermodel.*;
import org.springframework.stereotype.Component;

import java.awt.Color;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.NavigableMap;

import com.example.expensetracker.common.format.CurrencyFormats;
import com.example.expensetracker.domain.expense.model.Expense;
import com.example.expensetracker.domain.income.model.Income;
import com.example.expensetracker.domain.goal.model.SavingsGoal;
import com.example.expensetracker.domain.user.model.User;

/** Renders the executive dashboard sheet and its charts from precomputed report data. */
@Slf4j
@Component
public class FinancialStatementDashboardSheetWriter {

    private final FinancialStatementExcelStyles styles;
    private final Clock clock;

    public FinancialStatementDashboardSheetWriter(FinancialStatementExcelStyles styles, Clock clock) {
        this.styles = styles;
        this.clock = clock;
    }

    void write(XSSFWorkbook workbook, DefaultIndexedColorMap colorMap, XSSFSheet dashSheet,
               FinancialStatementWorkbookData data, FinancialStatementExcelStyles.RowStyles rowStyles) {
        FinancialStatementAnalysis analysis = data.analysis();
        CurrencyFormats.Metadata curr = analysis.currency();
        String curFmt = curr.excelFormat();
        User user = data.user();
        List<Income> incomes = data.incomes();
        List<Expense> expenses = data.expenses();
        List<SavingsGoal> savingsGoals = data.savingsGoals();
        Map<String, Double> budgetMap = analysis.budgets().limitsByCategory();
        NavigableMap<String, Double> dailyTotals = analysis.cashFlow().dailyTotals();
        int activeDays = analysis.cashFlow().activeDays();
        double totalInc = analysis.cashFlow().income();
        double totalExp = analysis.cashFlow().expenses();
        double netSurplus = analysis.cashFlow().netSurplus();
        double savingsRate = analysis.cashFlow().savingsRate();
        double dailyBurn = analysis.cashFlow().dailyBurn();
        double monthlyBurnRunRate = analysis.cashFlow().monthlyBurnRunRate();
        double runwayDays = analysis.cashFlow().runwayDays();
        double runwayMonths = analysis.cashFlow().runwayMonths();
        double needsSpend = analysis.allocation().needsSpend();
        double wantsSpend = analysis.allocation().wantsSpend();
        double needsPct = analysis.allocation().needsPercent();
        double wantsPct = analysis.allocation().wantsPercent();
        double savingsPct = analysis.allocation().savingsPercent();
        int healthScore = analysis.health().score();
        String healthGrade = analysis.health().grade();
        String healthStatusText = analysis.health().status();
        Color healthColor = healthScore >= 70 ? FinancialStatementExcelStyles.PBI_EMERALD_GREEN
                : healthScore >= 55 ? FinancialStatementExcelStyles.PBI_AMBER_GOLD
                : FinancialStatementExcelStyles.PBI_ROSE_RED;
        List<Map.Entry<String, Double>> sortedCategories = analysis.categories().sortedTotals();
        Map<String, String> paretoTiers = analysis.categories().paretoTiers();
        String p1 = analysis.recommendations().costOptimization();
        String p2 = analysis.recommendations().liquidity();
        String p3 = analysis.recommendations().allocation();
        String p4 = analysis.recommendations().goals();
        DataFormat df = workbook.createDataFormat();
        XSSFCellStyle curDataStyle = rowStyles.currency();
        XSSFCellStyle curZebraStyle = rowStyles.currencyZebra();
        XSSFCellStyle pctDataStyle = rowStyles.percentage();
        XSSFCellStyle pctZebraStyle = rowStyles.percentageZebra();
        XSSFCellStyle txtDataStyle = rowStyles.text();
        XSSFCellStyle txtZebraStyle = rowStyles.textZebra();
        XSSFCellStyle ctrDataStyle = rowStyles.centered();
        XSSFCellStyle ctrZebraStyle = rowStyles.centeredZebra();

            // ═════════════════════════════════════════════════════════════════════════
            // POPULATE SHEET 1: POWERBI FINANCIAL INTELLIGENCE EXECUTIVE DASHBOARD
            // ═════════════════════════════════════════════════════════════════════════
            dashSheet.setDisplayGridlines(false);
            // FIXED: previously froze only through row 7 (the primary KPI ribbon). The secondary KPI ribbon
            // (rows 8-10: Financial Resilience Score, Daily Burn, Runway, 50/30/20 Status) scrolled out of
            // view as the user moved down the dashboard. Now we freeze through row 11 so both KPI ribbons
            // stay visible while scrolling through the data tables, charts, and AI prescriptions below.
            dashSheet.createFreezePane(0, 11);

            // Standardize balanced 8-column layout (Columns A through H)
            dashSheet.setColumnWidth(0, 7000); // Col A: Category / Dimension / Date
            dashSheet.setColumnWidth(1, 5400); // Col B: Gross Amount / Spend
            dashSheet.setColumnWidth(2, 4600); // Col C: Share % / Flow Direction
            dashSheet.setColumnWidth(3, 4800); // Col D: Transactions / Benchmark %
            dashSheet.setColumnWidth(4, 5400); // Col E: Budget Limit / Benchmark
            dashSheet.setColumnWidth(5, 4800); // Col F: Utilization % / Variance
            dashSheet.setColumnWidth(6, 5200); // Col G: Remaining Buffer / Velocity Tag
            dashSheet.setColumnWidth(7, 6800); // Col H: Executive Risk Status / Telemetry

            // 1. Executive Dark Slate Hero Banner (Rows 0-1, Cols A to H)
            XSSFCellStyle bannerStyle = workbook.createCellStyle();
            XSSFFont bannerFont = workbook.createFont();
            bannerFont.setFontName("Segoe UI");
            bannerFont.setFontHeightInPoints((short) 16);
            bannerFont.setBold(true);
            bannerFont.setColor(new XSSFColor(Color.WHITE, colorMap));
            bannerStyle.setFont(bannerFont);
            bannerStyle.setFillForegroundColor(new XSSFColor(FinancialStatementExcelStyles.PBI_DARK_SLATE, colorMap));
            bannerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            bannerStyle.setAlignment(HorizontalAlignment.CENTER);
            bannerStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            for (int r = 0; r <= 1; r++) {
                Row row = dashSheet.createRow(r);
                row.setHeightInPoints(r == 0 ? 24 : 20);
                for (int c = 0; c <= 7; c++) {
                    Cell cell = row.createCell(c);
                    cell.setCellStyle(bannerStyle);
                }
            }
            dashSheet.getRow(0).getCell(0).setCellValue(
                    "EXECUTIVE FINANCIAL INTELLIGENCE & PERFORMANCE DASHBOARD");
            dashSheet.addMergedRegion(new CellRangeAddress(0, 1, 0, 7));

            // Sub-Banner Row 2
            XSSFCellStyle subBannerStyle = workbook.createCellStyle();
            XSSFFont subBannerFont = workbook.createFont();
            subBannerFont.setFontName("Segoe UI");
            subBannerFont.setFontHeightInPoints((short) 9);
            subBannerFont.setBold(true);
            subBannerFont.setColor(new XSSFColor(new Color(148, 163, 184), colorMap));
            subBannerStyle.setFont(subBannerFont);
            subBannerStyle.setFillForegroundColor(new XSSFColor(FinancialStatementExcelStyles.PBI_NAVY_HERO, colorMap));
            subBannerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            subBannerStyle.setAlignment(HorizontalAlignment.CENTER);
            subBannerStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            Row subRow = dashSheet.createRow(2);
            subRow.setHeightInPoints(22);
            for (int c = 0; c <= 7; c++) {
                Cell cell = subRow.createCell(c);
                cell.setCellStyle(subBannerStyle);
            }
            subRow.getCell(0).setCellValue("PORTFOLIO PERFORMANCE & CASH FLOW ANALYTICS  |  USER: " + user.getName()
                    + " (" + user.getEmail() + ")  |  BASE CURRENCY: " + curr.code() + " (" + curr.symbol() + ") "
                    + " |  GENERATED: " + LocalDate.now(clock) + "  |  PERIOD: FISCAL YEAR-TO-DATE");
            dashSheet.addMergedRegion(new CellRangeAddress(2, 2, 0, 7));

            XSSFCellStyle canvasStyle = workbook.createCellStyle();
            canvasStyle.setFillForegroundColor(new XSSFColor(new Color(248, 250, 252), colorMap));
            canvasStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            Row spacer3 = dashSheet.createRow(3);
            spacer3.setHeightInPoints(10);
            for (int c = 0; c <= 7; c++) {
                spacer3.createCell(c).setCellStyle(canvasStyle);
            }

            // 2. Primary 4-Card KPI Metric Ribbon (Rows 4, 5, 6 across Columns A to H)
            dashSheet.createRow(4).setHeightInPoints(20);
            dashSheet.createRow(5).setHeightInPoints(36);
            dashSheet.createRow(6).setHeightInPoints(18);

            short kpiCurFormat = df.getFormat(curFmt);
            short kpiPctFormat = df.getFormat("0.0%");

            // Card 1: TOTAL INFLOW (Cols A–B / 0–1)
            styles.createPowerBiKpiCard(workbook, colorMap, dashSheet, 4, 5, 6, 0, 1,
                    "\u25B2 TOTAL REVENUE & INFLOW",
                    incomes.isEmpty() ? "0" : "SUM(Incomes!D2:D" + (incomes.size() + 1) + ")",
                    FinancialStatementExcelStyles.PBI_EMERALD_GREEN, kpiCurFormat, "Active & recurring revenue streams");

            // Card 2: TOTAL OUTFLOW (Cols C–D / 2–3)
            styles.createPowerBiKpiCard(workbook, colorMap, dashSheet, 4, 5, 6, 2, 3,
                    "\u25BC TOTAL OPERATING EXPENDITURES",
                    expenses.isEmpty() ? "0" : "SUM(Expenses!D2:D" + (expenses.size() + 1) + ")",
                    FinancialStatementExcelStyles.PBI_ROSE_RED, kpiCurFormat, "Discretionary & operational burn");

            // Card 3: NET CASH FLOW (Cols E–F / 4–5)
            styles.createPowerBiKpiCard(workbook, colorMap, dashSheet, 4, 5, 6, 4, 5,
                    "\u25C6 NET CAPITAL SURPLUS",
                    "A6-C6",
                    FinancialStatementExcelStyles.PBI_INDIGO_ACCENT, kpiCurFormat, "Net retained capital velocity");

            // Card 4: SAVINGS RATE (Cols G–H / 6–7)
            styles.createPowerBiKpiCard(workbook, colorMap, dashSheet, 4, 5, 6, 6, 7,
                    "\u2605 CAPITAL RETENTION RATE",
                    "IF(AND(A6>0, E6>0), E6/A6, 0)",
                    FinancialStatementExcelStyles.PBI_AMBER_GOLD, kpiPctFormat, "Target Benchmark: \u2265 20.0%");

            Row spacer7 = dashSheet.createRow(7);
            spacer7.setHeightInPoints(10);
            for (int c = 0; c <= 7; c++) {
                spacer7.createCell(c).setCellStyle(canvasStyle);
            }

            // 3. Secondary 4-Card Resilience & Burn Velocity KPI Ribbon (Rows 8, 9, 10 across Columns A to H)
            dashSheet.createRow(8).setHeightInPoints(20);
            dashSheet.createRow(9).setHeightInPoints(34);
            dashSheet.createRow(10).setHeightInPoints(18);

            // Card 5: FINANCIAL HEALTH SCORE (Cols A–B / 0–1)
            styles.createPowerBiKpiCard(workbook, colorMap, dashSheet, 8, 9, 10, 0, 1,
                    "\u25C8 FINANCIAL RESILIENCE INDEX",
                    healthScore + " / 100",
                    healthColor, (short) 0, healthGrade + " \u2022 " + healthStatusText);

            // Card 6: DAILY CASH BURN VELOCITY (Cols C–D / 2–3)
            styles.createPowerBiKpiCard(workbook, colorMap, dashSheet, 8, 9, 10, 2, 3,
                    "\u26A1 DAILY CASH BURN VELOCITY",
                    String.format(Locale.US, "%.2f", dailyBurn),
                    FinancialStatementExcelStyles.PBI_ROSE_RED, kpiCurFormat,
                    String.format(Locale.US, "Monthly Run-Rate: %s %,.0f", curr.symbol(), monthlyBurnRunRate));

            // Card 7: LIQUIDITY RUNWAY (Cols E–F / 4–5)
            styles.createPowerBiKpiCard(workbook, colorMap, dashSheet, 8, 9, 10, 4, 5,
                    "\u29BE LIQUIDITY SURVIVAL RUNWAY",
                    Double.isInfinite(runwayDays) ? "\u221E Continuous"
                            : String.format(Locale.US, "%.0f Days", runwayDays),
                    FinancialStatementExcelStyles.PBI_INDIGO_ACCENT, (short) 0, Double.isInfinite(runwayDays) ?
                            "Surplus growing without net burn" :
                            String.format(Locale.US, "%.1f Months of operational capital", runwayMonths));

            // Card 8: 50/30/20 ALLOCATION STATUS (Cols G–H / 6–7)
            styles.createPowerBiKpiCard(workbook, colorMap, dashSheet, 8, 9, 10, 6, 7,
                    "\u2731 50/30/20 ALLOCATION STATUS",
                    savingsPct >= 0.20 ? "\u2705 COMPOUNDING" :
                            (wantsPct > 0.35 ? "\u26A0\uFE0F HIGH WANTS" : "\u26A1 DISCIPLINED"),
                    savingsPct >= 0.20 ? FinancialStatementExcelStyles.PBI_EMERALD_GREEN : FinancialStatementExcelStyles.PBI_AMBER_GOLD, (short) 0,
                    String.format(Locale.US, "Needs: %.0f%% \u2022 Wants: %.0f%% \u2022 Save: %.0f%%",
                            needsPct * 100, wantsPct * 100, savingsPct * 100));

            Row spacer11 = dashSheet.createRow(11);
            spacer11.setHeightInPoints(12);
            for (int c = 0; c <= 7; c++) {
                spacer11.createCell(c).setCellStyle(canvasStyle);
            }

            // Background Canvas for Floating Vector Visuals (Rows 12 to 41, Cols A to H)
            for (int r = 12; r <= 41; r++) {
                Row cr = dashSheet.createRow(r);
                cr.setHeightInPoints(18);
                for (int c = 0; c <= 7; c++) {
                    Cell cell = cr.createCell(c);
                    cell.setCellStyle(canvasStyle);
                }
            }

            Row spacer42 = dashSheet.createRow(42);
            spacer42.setHeightInPoints(14);
            for (int c = 0; c <= 7; c++) {
                spacer42.createCell(c).setCellStyle(canvasStyle);
            }

            // ═════════════════════════════════════════════════════════════════════════
            // SECTION 1: 50/30/20 CAPITAL ALLOCATION & MACRO BENCHMARK (Rows 43 to 48)
            // ═════════════════════════════════════════════════════════════════════════
            Row bmBannerRow = dashSheet.createRow(43);
            bmBannerRow.setHeightInPoints(24);
            XSSFCellStyle mBannerStyle = workbook.createCellStyle();
            XSSFFont mBannerFont = workbook.createFont();
            mBannerFont.setFontName("Segoe UI");
            mBannerFont.setFontHeightInPoints((short) 11);
            mBannerFont.setBold(true);
            mBannerFont.setColor(new XSSFColor(Color.WHITE, colorMap));
            mBannerStyle.setFont(mBannerFont);
            mBannerStyle.setFillForegroundColor(new XSSFColor(FinancialStatementExcelStyles.PBI_DARK_SLATE, colorMap));
            mBannerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            mBannerStyle.setAlignment(HorizontalAlignment.LEFT);
            mBannerStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            for (int c = 0; c <= 7; c++) {
                Cell cell = bmBannerRow.createCell(c);
                cell.setCellStyle(mBannerStyle);
            }
            bmBannerRow.getCell(0).setCellValue("  1. MACRO 50/30/20 CAPITAL ALLOCATION & WEALTH BENCHMARK");
            dashSheet.addMergedRegion(new CellRangeAddress(43, 43, 0, 7));

            Row bmHeader = dashSheet.createRow(44);
            bmHeader.setHeightInPoints(24);
            XSSFCellStyle tblHeadStyle = styles.createModernHeaderStyle(workbook, colorMap, FinancialStatementExcelStyles.PBI_NAVY_HERO);

            String[] bmHeaders = {
                    "Macro Allocation Dimension",
                    "Allocated Spend (" + curr.symbol() + ")",
                    "Actual Share %",
                    "Benchmark %",
                    "Variance vs Target",
                    "Compliance Status",
                    "Strategic Assessment",
                    "Constituent Scope"
            };
            for (int c = 0; c < bmHeaders.length; c++) {
                Cell hCell = bmHeader.createCell(c);
                hCell.setCellValue(bmHeaders[c]);
                hCell.setCellStyle(tblHeadStyle);
            }

            // 3 Benchmark Data Rows: Needs, Wants, Savings
            int bmStartRow = 45;
            String[] bmDimensions = {
                    "Essential Living Needs (Needs)",
                    "Discretionary Lifestyle (Wants)",
                    "Capital Retention & Savings (Savings)"
            };
            double[] bmAmounts = {needsSpend, wantsSpend, Math.max(0.0, netSurplus)};
            double[] bmTargets = {0.50, 0.30, 0.20};
            String[] bmScopes = {
                    "Housing, rent, utilities, groceries, transport, health, EMI",
                    "Dining out, entertainment, shopping, leisure, recreation",
                    "Net accumulated surplus, debt amortization, asset investing"
            };

            for (int i = 0; i < 3; i++) {
                int rIdx = bmStartRow + i;
                Row r = dashSheet.createRow(rIdx);
                r.setHeightInPoints(20);
                boolean isZebra = (i % 2 == 1);

                Cell c0 = r.createCell(0);
                c0.setCellValue(bmDimensions[i]);
                c0.setCellStyle(isZebra ? txtZebraStyle : txtDataStyle);

                Cell c1 = r.createCell(1);
                c1.setCellValue(bmAmounts[i]);
                c1.setCellStyle(isZebra ? curZebraStyle : curDataStyle);

                Cell c2 = r.createCell(2);
                c2.setCellFormula("IF($A$6>0, B" + (rIdx + 1) + "/$A$6, 0)");
                c2.setCellStyle(isZebra ? pctZebraStyle : pctDataStyle);

                Cell c3 = r.createCell(3);
                c3.setCellValue(bmTargets[i]);
                c3.setCellStyle(isZebra ? pctZebraStyle : pctDataStyle);

                Cell c4 = r.createCell(4);
                c4.setCellFormula("C" + (rIdx + 1) + "-D" + (rIdx + 1));
                c4.setCellStyle(isZebra ? pctZebraStyle : pctDataStyle);

                Cell c5 = r.createCell(5);
                if (i == 0) {
                    c5.setCellFormula(
                            "IF(C" + (rIdx + 1) + "<=0.50, \"\u2705 OPTIMAL\", "
                                    + "IF(C" + (rIdx + 1) + "<=0.60, "
                                    + "\"\u26A0\uFE0F ELEVATED\", \"\uD83D\uDEA8 HIGH BURDEN\"))");
                } else if (i == 1) {
                    c5.setCellFormula(
                            "IF(C" + (rIdx + 1) + "<=0.30, \"\u2705 OPTIMAL\", "
                                    + "IF(C" + (rIdx + 1) + "<=0.40, "
                                    + "\"\u26A0\uFE0F ELEVATED\", \"\uD83D\uDEA8 OVER BUDGET\"))");
                } else {
                    c5.setCellFormula(
                            "IF(C" + (rIdx + 1) + ">=0.20, \"\uD83D\uDE80 ACCELERATING\", "
                                    + "IF(C" + (rIdx + 1) + ">=0.10, \"\u2705 MODERATE\", \"\uD83D\uDEA8 DEFICIT\"))");
                }
                c5.setCellStyle(isZebra ? ctrZebraStyle : ctrDataStyle);

                Cell c6 = r.createCell(6);
                if (i == 0) {
                    c6.setCellFormula(
                            "IF(C" + (rIdx + 1) + "<=0.50, \"Living costs fully within guidelines\", "
                                    + "\"Essential expenses consume over 50% of revenue\")");
                } else if (i == 1) {
                    c6.setCellFormula(
                            "IF(C" + (rIdx + 1) + "<=0.30, \"Controlled lifestyle expenditure\", "
                                    + "\"Discretionary spending exceeds 30% threshold\")");
                } else {
                    c6.setCellFormula(
                            "IF(C" + (rIdx + 1) + ">=0.20, \"Capital accumulation expanding rapidly\", "
                                    + "\"Retention pace below 20% benchmark\")");
                }
                c6.setCellStyle(isZebra ? txtZebraStyle : txtDataStyle);

                Cell c7 = r.createCell(7);
                c7.setCellValue(bmScopes[i]);
                c7.setCellStyle(isZebra ? txtZebraStyle : txtDataStyle);
            }

            int bmTotRowIdx = bmStartRow + 3;
            Row bmTotRow = dashSheet.createRow(bmTotRowIdx);
            bmTotRow.setHeightInPoints(24);
            XSSFCellStyle totLbl = styles.createTotalLabelStyle(workbook, colorMap);
            XSSFCellStyle totCur = styles.createTotalValueStyle(workbook, colorMap, df.getFormat(curFmt));
            XSSFCellStyle totPct = styles.createTotalValueStyle(workbook, colorMap, df.getFormat("0.0%"));

            Cell bmt0 = bmTotRow.createCell(0);
            bmt0.setCellValue("CONSOLIDATED CAPITAL ALLOCATION:");
            bmt0.setCellStyle(totLbl);

            Cell bmt1 = bmTotRow.createCell(1);
            bmt1.setCellFormula("SUM(B" + (bmStartRow + 1) + ":B" + (bmStartRow + 3) + ")");
            bmt1.setCellStyle(totCur);

            Cell bmt2 = bmTotRow.createCell(2);
            bmt2.setCellFormula("SUM(C" + (bmStartRow + 1) + ":C" + (bmStartRow + 3) + ")");
            bmt2.setCellStyle(totPct);

            Cell bmt3 = bmTotRow.createCell(3);
            bmt3.setCellValue(1.0);
            bmt3.setCellStyle(totPct);

            Cell bmt4 = bmTotRow.createCell(4);
            bmt4.setCellFormula("C" + (bmTotRowIdx + 1) + "-D" + (bmTotRowIdx + 1));
            bmt4.setCellStyle(totPct);

            Cell bmt5 = bmTotRow.createCell(5);
            bmt5.setCellValue("100% RECONCILED");
            bmt5.setCellStyle(totLbl);

            Cell bmt6 = bmTotRow.createCell(6);
            bmt6.setCellValue("PORTFOLIO VERIFIED");
            bmt6.setCellStyle(totLbl);

            Cell bmt7 = bmTotRow.createCell(7);
            bmt7.setCellValue("ANNUALIZED MACRO PROFILE");
            bmt7.setCellStyle(totLbl);

            dashSheet.createRow(bmTotRowIdx + 1).setHeightInPoints(14); // Spacer

            // ═════════════════════════════════════════════════════════════════════════
            // SECTION 2: CATEGORY COST DRIVERS & PARETO ALLOCATION MATRIX
            // ═════════════════════════════════════════════════════════════════════════
            int catBannerRowIdx = bmTotRowIdx + 2;
            Row catBannerRow = dashSheet.createRow(catBannerRowIdx);
            catBannerRow.setHeightInPoints(24);
            for (int c = 0; c <= 7; c++) {
                Cell cell = catBannerRow.createCell(c);
                cell.setCellStyle(mBannerStyle);
            }
            catBannerRow.getCell(0).setCellValue(
                    "  2. EXPENDITURE CATEGORY CONCENTRATION & 80/20 PARETO MATRIX");
            dashSheet.addMergedRegion(new CellRangeAddress(catBannerRowIdx, catBannerRowIdx, 0, 7));

            int catHeadRowIdx = catBannerRowIdx + 1;
            Row matrixHeader = dashSheet.createRow(catHeadRowIdx);
            matrixHeader.setHeightInPoints(24);

            String[] mHeaders = {
                    "Category Name",
                    "Allocated Spend (" + curr.symbol() + ")",
                    "Share of Outflow",
                    "Pareto Tier",
                    "Monthly Budget (" + curr.symbol() + ")",
                    "Utilization Rate",
                    "Remaining Buffer (" + curr.symbol() + ")",
                    "Executive Risk Status"
            };
            for (int c = 0; c < mHeaders.length; c++) {
                Cell hCell = matrixHeader.createCell(c);
                hCell.setCellValue(mHeaders[c]);
                hCell.setCellStyle(tblHeadStyle);
            }

            int catStartRow = catHeadRowIdx + 1;
            int catIdx = 0;
            for (Map.Entry<String, Double> entry : sortedCategories) {
                int rIdx = catStartRow + catIdx;
                Row r = dashSheet.createRow(rIdx);
                r.setHeightInPoints(20);
                boolean isZebra = (catIdx % 2 == 1);

                Cell c0 = r.createCell(0);
                c0.setCellValue(entry.getKey());
                c0.setCellStyle(isZebra ? txtZebraStyle : txtDataStyle);

                Cell c1 = r.createCell(1);
                c1.setCellValue(entry.getValue());
                c1.setCellStyle(isZebra ? curZebraStyle : curDataStyle);

                Cell c2 = r.createCell(2);
                c2.setCellFormula("IF($C$6>0, B" + (rIdx + 1) + "/$C$6, 0)");
                c2.setCellStyle(isZebra ? pctZebraStyle : pctDataStyle);

                Cell c3 = r.createCell(3);
                c3.setCellValue(paretoTiers.getOrDefault(entry.getKey(), "TIER B (SECONDARY)"));
                c3.setCellStyle(isZebra ? ctrZebraStyle : ctrDataStyle);

                Double bAmount = budgetMap.getOrDefault(entry.getKey(), 0.0);
                Cell c4 = r.createCell(4);
                c4.setCellValue(bAmount);
                c4.setCellStyle(isZebra ? curZebraStyle : curDataStyle);

                Cell c5 = r.createCell(5);
                c5.setCellFormula("IF(E" + (rIdx + 1) + ">0, B" + (rIdx + 1) + "/E" + (rIdx + 1) + ", 0)");
                c5.setCellStyle(isZebra ? pctZebraStyle : pctDataStyle);

                Cell c6 = r.createCell(6);
                c6.setCellFormula("IF(E" + (rIdx + 1) + ">0, E" + (rIdx + 1) + "-B" + (rIdx + 1) + ", 0)");
                c6.setCellStyle(isZebra ? curZebraStyle : curDataStyle);

                Cell c7 = r.createCell(7);
                c7.setCellFormula(
                        "IF(E" + (rIdx + 1) + ">0, IF(F" + (rIdx + 1) + ">1.0, \"\u26A0\uFE0F EXCEEDED\", "
                                + "IF(F" + (rIdx + 1) + ">0.8, \"\u26A1 ALERT (>80%)\", \"\u2705 OPTIMAL\")), "
                                + "IF(C" + (rIdx + 1) + ">0.3, \"\u26A0\uFE0F HIGH BURDEN\", \"\u2705 ON TRACK\"))");
                c7.setCellStyle(isZebra ? ctrZebraStyle : ctrDataStyle);

                catIdx++;
            }
            int catEndRow = catStartRow + catIdx - 1;

            int catTotRowIdx = catEndRow + 1;
            Row catTotRow = dashSheet.createRow(catTotRowIdx);
            catTotRow.setHeightInPoints(24);

            Cell ctl0 = catTotRow.createCell(0);
            ctl0.setCellValue("TOTAL MONITORED EXPENDITURES:");
            ctl0.setCellStyle(totLbl);

            Cell ctl1 = catTotRow.createCell(1);
            ctl1.setCellFormula("SUM(B" + (catStartRow + 1) + ":B" + (catEndRow + 1) + ")");
            ctl1.setCellStyle(totCur);

            Cell ctl2 = catTotRow.createCell(2);
            ctl2.setCellFormula("IF($C$6>0, B" + (catTotRowIdx + 1) + "/$C$6, 1.0)");
            ctl2.setCellStyle(totPct);

            Cell ctl3 = catTotRow.createCell(3);
            ctl3.setCellValue("100% PARETO COVERAGE");
            ctl3.setCellStyle(totLbl);

            Cell ctl4 = catTotRow.createCell(4);
            ctl4.setCellFormula("SUM(E" + (catStartRow + 1) + ":E" + (catEndRow + 1) + ")");
            ctl4.setCellStyle(totCur);

            Cell ctl5 = catTotRow.createCell(5);
            ctl5.setCellFormula(
                    "IF(E" + (catTotRowIdx + 1) + ">0, B" + (catTotRowIdx + 1) + "/E" + (catTotRowIdx + 1) + ", 0)");
            ctl5.setCellStyle(totPct);

            Cell ctl6 = catTotRow.createCell(6);
            ctl6.setCellFormula("E" + (catTotRowIdx + 1) + "-B" + (catTotRowIdx + 1));
            ctl6.setCellStyle(totCur);

            Cell ctl7 = catTotRow.createCell(7);
            ctl7.setCellValue("PORTFOLIO VERIFIED");
            ctl7.setCellStyle(totLbl);

            // ═════════════════════════════════════════════════════════════════════════
            // SECTION 3: PORTFOLIO CASH FLOW DYNAMICS & LIQUIDITY LEDGER
            // ═════════════════════════════════════════════════════════════════════════
            dashSheet.createRow(catTotRowIdx + 1).setHeightInPoints(14); // Spacer
            int sec2BannerRowIdx = catTotRowIdx + 2;
            Row sec2BannerRow = dashSheet.createRow(sec2BannerRowIdx);
            sec2BannerRow.setHeightInPoints(24);
            for (int c = 0; c <= 7; c++) {
                Cell cell = sec2BannerRow.createCell(c);
                cell.setCellStyle(mBannerStyle);
            }
            sec2BannerRow.getCell(0).setCellValue("  3. PORTFOLIO CASH FLOW DYNAMICS & LIQUIDITY LEDGER");
            dashSheet.addMergedRegion(new CellRangeAddress(sec2BannerRowIdx, sec2BannerRowIdx, 0, 7));

            int t2HeadRowIdx = sec2BannerRowIdx + 1;
            Row t2HeadRow = dashSheet.createRow(t2HeadRowIdx);
            t2HeadRow.setHeightInPoints(24);
            String[] t2Headers = {
                    "Cash Flow Dimension",
                    "Gross Amount (" + curr.symbol() + ")",
                    "Flow Direction",
                    "Classification",
                    "Portfolio Ratio",
                    "Monthly Run-Rate (" + curr.symbol() + ")",
                    "Liquidity Impact",
                    "Strategic Assessment"
            };
            for (int c = 0; c < t2Headers.length; c++) {
                Cell hCell = t2HeadRow.createCell(c);
                hCell.setCellValue(t2Headers[c]);
                hCell.setCellStyle(tblHeadStyle);
            }

            int cfStartRow = t2HeadRowIdx + 1;
            String[] cfLabels = {
                    "Total Operating Revenue & Inflows",
                    "Total Operating Expenditures & Burn",
                    "Net Retained Capital Surplus",
                    "Active Savings Goals Reserve Allocation"
            };
            String[] cfFormulas = {
                    "A6",
                    "C6",
                    "E6",
                    savingsGoals.isEmpty() ? "0" : "SUM('Savings Goals'!D2:D" + (savingsGoals.size() + 1) + ")"
            };
            String[] cfDirs = {"INFLOW (+)", "OUTFLOW (-)", "NET LIQUIDITY", "RESERVE (+)"};
            String[] cfClasses = {"Capital Driver", "Operational Burn", "Retained Wealth", "Wealth Preservation"};
            String[] cfImpacts = {"+ Liquidity Growth", "- Capital Drain", "\u00B1 Balance Impact", "+ Asset Cushion"};
            String[] cfStratFormulas = {
                    "\"\u2705 Active Revenue Engine\"",
                    "IF(E" + (cfStartRow + 2) + ">0.8, \"\u26A0\uFE0F High Burn Rate\", \"\u2705 Controlled Burn\")",
                    "IF(B" + (cfStartRow + 3) + ">=0, \"\u2705 Capital Expansion\", \"\u26A0\uFE0F Capital Deficit\")",
                    "\"\u2705 Reserve Accumulation\""
            };

            for (int i = 0; i < 4; i++) {
                int rIdx = cfStartRow + i;
                Row r = dashSheet.createRow(rIdx);
                r.setHeightInPoints(20);
                boolean isZebra = (i % 2 == 1);

                Cell c0 = r.createCell(0);
                c0.setCellValue(cfLabels[i]);
                c0.setCellStyle(isZebra ? txtZebraStyle : txtDataStyle);

                Cell c1 = r.createCell(1);
                c1.setCellFormula(cfFormulas[i]);
                c1.setCellStyle(isZebra ? curZebraStyle : curDataStyle);

                Cell c2 = r.createCell(2);
                c2.setCellValue(cfDirs[i]);
                c2.setCellStyle(isZebra ? ctrZebraStyle : ctrDataStyle);

                Cell c3 = r.createCell(3);
                c3.setCellValue(cfClasses[i]);
                c3.setCellStyle(isZebra ? ctrZebraStyle : ctrDataStyle);

                Cell c4 = r.createCell(4);
                if (i == 0) {
                    c4.setCellValue(1.0);
                } else {
                    c4.setCellFormula("IF($A$6>0, B" + (rIdx + 1) + "/$A$6, 0)");
                }
                c4.setCellStyle(isZebra ? pctZebraStyle : pctDataStyle);

                Cell c5 = r.createCell(5);
                // FIXED: previously c5.setCellFormula("B" + (rIdx + 1)) which just duplicated
                // the Gross Amount column — the "Monthly Run-Rate" header was a lie. Now we
                // compute a real monthly run-rate = (B{row} / activeDays) * 30.4, where
                // activeDays is the actual span of the user's expense history. We inline the
                // activeDays value as a literal because it's not stored in any cell.
                // For non-expense rows (income, net, savings) this is still meaningful as a
                // normalized monthly figure.
                c5.setCellFormula("IF(" + activeDays + ">0, B" + (rIdx + 1) + "/" + activeDays + "*30.4, 0)");
                c5.setCellStyle(isZebra ? curZebraStyle : curDataStyle);

                Cell c6 = r.createCell(6);
                c6.setCellValue(cfImpacts[i]);
                c6.setCellStyle(isZebra ? ctrZebraStyle : ctrDataStyle);

                Cell c7 = r.createCell(7);
                c7.setCellFormula(cfStratFormulas[i]);
                c7.setCellStyle(isZebra ? ctrZebraStyle : ctrDataStyle);
            }

            int t2TotRowIdx = cfStartRow + 4;
            Row t2TotRow = dashSheet.createRow(t2TotRowIdx);
            t2TotRow.setHeightInPoints(24);

            Cell t2Lbl = t2TotRow.createCell(0);
            t2Lbl.setCellValue("CONSOLIDATED CAPITAL POSITION:");
            t2Lbl.setCellStyle(totLbl);

            Cell t2Val = t2TotRow.createCell(1);
            t2Val.setCellFormula("E6");
            t2Val.setCellStyle(totCur);

            Cell t2c2 = t2TotRow.createCell(2);
            t2c2.setCellValue("NET POSITION");
            t2c2.setCellStyle(totLbl);

            Cell t2c3 = t2TotRow.createCell(3);
            t2c3.setCellValue("Balance Sheet");
            t2c3.setCellStyle(totLbl);

            Cell t2c4 = t2TotRow.createCell(4);
            // FIXED: previously t2c4.setCellFormula("G6") which displayed the savings rate
            // (Card 4 value) in the "Portfolio Ratio" column of the total row — semantically
            // wrong. Now we show the consolidated portfolio ratio = total inflow / total inflow = 100%
            // (i.e. the share of the total that this consolidated position represents).
            t2c4.setCellFormula("IF($A$6>0, B" + (t2TotRowIdx + 1) + "/$A$6, 0)");
            t2c4.setCellStyle(totPct);

            Cell t2c5 = t2TotRow.createCell(5);
            // FIXED: previously t2c5.setCellFormula("B" + (t2TotRowIdx + 1)) which duplicated
            // the Net Cash Flow value already shown in col B. Now we show the consolidated
            // monthly run-rate, matching the per-row formula in column E.
            t2c5.setCellFormula("IF(" + activeDays + ">0, B" + (t2TotRowIdx + 1) + "/" + activeDays + "*30.4, 0)");
            t2c5.setCellStyle(totCur);

            Cell t2c6 = t2TotRow.createCell(6);
            t2c6.setCellValue("VERIFIED");
            t2c6.setCellStyle(totLbl);

            Cell t2c7 = t2TotRow.createCell(7);
            t2c7.setCellValue("STATUS NOMINAL");
            t2c7.setCellStyle(totLbl);

            // ═════════════════════════════════════════════════════════════════════════
            // SECTION 4: CHRONOLOGICAL DISBURSEMENT RUN-RATE & SPEND TIMELINE
            // ═════════════════════════════════════════════════════════════════════════
            dashSheet.createRow(t2TotRowIdx + 1).setHeightInPoints(14); // Spacer
            int sec3BannerRowIdx = t2TotRowIdx + 2;
            Row sec3BannerRow = dashSheet.createRow(sec3BannerRowIdx);
            sec3BannerRow.setHeightInPoints(24);
            for (int c = 0; c <= 7; c++) {
                Cell cell = sec3BannerRow.createCell(c);
                cell.setCellStyle(mBannerStyle);
            }
            sec3BannerRow.getCell(0).setCellValue("  4. CHRONOLOGICAL CASH OUTFLOW RUN-RATE & TIMELINE");
            dashSheet.addMergedRegion(new CellRangeAddress(sec3BannerRowIdx, sec3BannerRowIdx, 0, 7));

            int t3HeadRowIdx = sec3BannerRowIdx + 1;
            Row t3HeadRow = dashSheet.createRow(t3HeadRowIdx);
            t3HeadRow.setHeightInPoints(24);
            String[] t3Headers = {
                    "Disbursement Date",
                    "Daily Outflow (" + curr.symbol() + ")",
                    "Share of Total Outflow",
                    "Transactions",
                    "Daily Average Benchmark (" + curr.symbol() + ")",
                    "Variance vs Benchmark (" + curr.symbol() + ")",
                    "Velocity Intensity",
                    "Liquidity Status Tag"
            };
            for (int c = 0; c < t3Headers.length; c++) {
                Cell hCell = t3HeadRow.createCell(c);
                hCell.setCellValue(t3Headers[c]);
                hCell.setCellStyle(tblHeadStyle);
            }

            int timeStartRow = t3HeadRowIdx + 1;
            int timeIdx = 0;
            int totalDailyEntries = dailyTotals.size();

            for (Map.Entry<String, Double> entry : dailyTotals.entrySet()) {
                int rIdx = timeStartRow + timeIdx;
                Row r = dashSheet.createRow(rIdx);
                r.setHeightInPoints(20);
                boolean isZebra = (timeIdx % 2 == 1);

                Cell ck0 = r.createCell(0);
                ck0.setCellValue(entry.getKey());
                ck0.setCellStyle(isZebra ? ctrZebraStyle : ctrDataStyle);

                Cell ck1 = r.createCell(1);
                ck1.setCellValue(entry.getValue());
                ck1.setCellStyle(isZebra ? curZebraStyle : curDataStyle);

                Cell ck2 = r.createCell(2);
                ck2.setCellFormula("IF($C$6>0, B" + (rIdx + 1) + "/$C$6, 0)");
                ck2.setCellStyle(isZebra ? pctZebraStyle : pctDataStyle);

                Cell ck3 = r.createCell(3);
                ck3.setCellFormula("COUNTIF(Expenses!B:B, A" + (rIdx + 1) + ")");
                ck3.setCellStyle(isZebra ? ctrZebraStyle : ctrDataStyle);

                Cell ck4 = r.createCell(4);
                ck4.setCellFormula("IF($C$6>0, $C$6/" + Math.max(1, totalDailyEntries) + ", 0)");
                ck4.setCellStyle(isZebra ? curZebraStyle : curDataStyle);

                Cell ck5 = r.createCell(5);
                ck5.setCellFormula("B" + (rIdx + 1) + "-E" + (rIdx + 1));
                ck5.setCellStyle(isZebra ? curZebraStyle : curDataStyle);

                Cell ck6 = r.createCell(6);
                ck6.setCellFormula(
                        "IF(B" + (rIdx + 1) + ">E" + (rIdx + 1) + "*1.5, \"\u26A1 HIGH SURGE\", "
                                + "IF(B" + (rIdx + 1) + ">E" + (rIdx + 1) + ", "
                                + "\"\u25B2 ELEVATED\", \"\u25BC CONTROLLED\"))");
                ck6.setCellStyle(isZebra ? ctrZebraStyle : ctrDataStyle);

                Cell ck7 = r.createCell(7);
                ck7.setCellFormula(
                        "IF(B" + (rIdx + 1) + ">E" + (rIdx + 1) + "*1.5, "
                                + "\"\u26A0\uFE0F REVIEW TRANSACTIONS\", \"\u2705 NOMINAL RUN-RATE\")");
                ck7.setCellStyle(isZebra ? ctrZebraStyle : ctrDataStyle);

                timeIdx++;
            }
            int timeEndRow = timeStartRow + timeIdx - 1;

            int t3TotRowIdx = timeEndRow + 1;
            Row t3TotRow = dashSheet.createRow(t3TotRowIdx);
            t3TotRow.setHeightInPoints(24);

            Cell t3Lbl = t3TotRow.createCell(0);
            t3Lbl.setCellValue("TOTAL RECORDED DISBURSEMENTS:");
            t3Lbl.setCellStyle(totLbl);

            Cell t3Val = t3TotRow.createCell(1);
            t3Val.setCellFormula("SUM(B" + (timeStartRow + 1) + ":B" + (timeEndRow + 1) + ")");
            t3Val.setCellStyle(totCur);

            Cell t3c2 = t3TotRow.createCell(2);
            t3c2.setCellFormula("IF($C$6>0, B" + (t3TotRowIdx + 1) + "/$C$6, 1.0)");
            t3c2.setCellStyle(totPct);

            Cell t3c3 = t3TotRow.createCell(3);
            t3c3.setCellFormula("SUM(D" + (timeStartRow + 1) + ":D" + (timeEndRow + 1) + ")");
            t3c3.setCellStyle(totLbl);

            Cell t3c4 = t3TotRow.createCell(4);
            // FIXED (B7): previously AVERAGE(E{start}:E{end}) but every E{row} cell contains the
            // SAME formula (IF($C$6>0, $C$6/N, 0)), so the average is just that same value.
            // Now we just reference the first E cell directly — semantically equivalent and clearer.
            t3c4.setCellFormula("E" + (timeStartRow + 1));
            t3c4.setCellStyle(totCur);

            Cell t3c5 = t3TotRow.createCell(5);
            // FIXED (B6): previously SUM(F{start}:F{end}) where each F{row} = B{row} - E{row}
            // and E{row} = TotalExp/N for every row. So SUM(F) = SUM(B) - N*(TotalExp/N) =
            // TotalExp - TotalExp = 0 — always zero, misleading. Now we show the MAX variance
            // (peak day's deviation from the benchmark) which is actually useful information.
            t3c5.setCellFormula("MAX(F" + (timeStartRow + 1) + ":F" + (timeEndRow + 1) + ")");
            t3c5.setCellStyle(totCur);

            Cell t3c6 = t3TotRow.createCell(6);
            t3c6.setCellValue("ACTIVE TIMELINE");
            t3c6.setCellStyle(totLbl);

            Cell t3c7 = t3TotRow.createCell(7);
            t3c7.setCellValue("STATUS NOMINAL");
            t3c7.setCellStyle(totLbl);

            // ═════════════════════════════════════════════════════════════════════════
            // SECTION 5: STRATEGIC EXECUTIVE AI PRESCRIPTIONS & ACTIONABLE DIRECTIVES
            // ═════════════════════════════════════════════════════════════════════════
            dashSheet.createRow(t3TotRowIdx + 1).setHeightInPoints(14); // Spacer
            int aiBannerRowIdx = t3TotRowIdx + 2;
            Row aiBannerRow = dashSheet.createRow(aiBannerRowIdx);
            aiBannerRow.setHeightInPoints(24);
            for (int c = 0; c <= 7; c++) {
                Cell cell = aiBannerRow.createCell(c);
                cell.setCellStyle(mBannerStyle);
            }
            aiBannerRow.getCell(0).setCellValue(
                    "  5. STRATEGIC FINANCIAL INTELLIGENCE & ACTIONABLE RECOMMENDATIONS");
            dashSheet.addMergedRegion(new CellRangeAddress(aiBannerRowIdx, aiBannerRowIdx, 0, 7));

            String[] aiLabels = {
                    "\uD83C\uDFAF COST OPTIMIZATION",
                    "\uD83D\uDEE1\uFE0F LIQUIDITY RUNWAY",
                    "\u2696\uFE0F 50/30/20 BENCHMARK",
                    "\uD83D\uDE80 WEALTH ACCELERATION"
            };
            String[] aiTexts = {p1, p2, p3, p4};
            Color[] aiColors = {FinancialStatementExcelStyles.PBI_ROSE_RED, FinancialStatementExcelStyles.PBI_INDIGO_ACCENT, FinancialStatementExcelStyles.PBI_AMBER_GOLD, FinancialStatementExcelStyles.PBI_EMERALD_GREEN};

            int aiStartRow = aiBannerRowIdx + 1;
            for (int i = 0; i < 4; i++) {
                int rIdx = aiStartRow + i;
                Row r = dashSheet.createRow(rIdx);
                // FIXED: previously fixed at 34 pt (\u2248 2 lines). Long AI prescriptions (p1, p2 are often
                // 3+ lines) got visually clipped because the cell style sets wrapText=true but the row
                // wasn't tall enough. Now we compute a height proportional to the text length, assuming
                // \u2248 95 chars per line at the given column width and 14 pt per line.
                String txt = aiTexts[i];
                int estimatedLines = Math.max(2, (int) Math.ceil((double) txt.length() / 95.0));
                r.setHeightInPoints((short) (Math.max(34, estimatedLines * 14)));

                XSSFCellStyle lblStyle = styles.createPrescriptionLabelStyle(workbook, colorMap, aiColors[i]);
                XSSFCellStyle txtStyle = styles.createPrescriptionTextStyle(workbook, colorMap);

                Cell c0 = r.createCell(0);
                c0.setCellValue(aiLabels[i]);
                c0.setCellStyle(lblStyle);

                for (int c = 1; c <= 7; c++) {
                    Cell cTxt = r.createCell(c);
                    cTxt.setCellStyle(txtStyle);
                }
                r.getCell(1).setCellValue(aiTexts[i]);
                dashSheet.addMergedRegion(new CellRangeAddress(rIdx, rIdx, 1, 7));
            }

            // ═════════════════════════════════════════════════════════════════════════
            // 6. EMBEDDED VECTOR XDDF CHARTS (Rows 12 to 41, Cols A to H)
            // ═════════════════════════════════════════════════════════════════════════
            try {
                XSSFDrawing drawing = dashSheet.createDrawingPatriarch();

                // Chart 1: Cash Flow Column Chart (Cols A–D / 0 to 4, Rows 12 to 27)
                XSSFClientAnchor anchor1 = drawing.createAnchor(0, 0, 0, 0, 0, 12, 4, 27);
                XSSFChart chart1 = drawing.createChart(anchor1);
                chart1.setTitleText("CASH FLOW DYNAMICS & LIQUIDITY (" + curr.symbol() + ")");
                chart1.setTitleOverlay(false);

                XDDFChartLegend legend1 = chart1.getOrAddLegend();
                legend1.setPosition(LegendPosition.TOP_RIGHT);
                legend1.setOverlay(false);

                XDDFCategoryAxis bAxis1 = chart1.createCategoryAxis(AxisPosition.BOTTOM);
                XDDFValueAxis lAxis1 = chart1.createValueAxis(AxisPosition.LEFT);
                lAxis1.setCrosses(AxisCrosses.AUTO_ZERO);

                XDDFBarChartData barChart = (XDDFBarChartData) chart1.createData(ChartTypes.BAR, bAxis1, lAxis1);
                barChart.setBarDirection(BarDirection.COL);

                // FIXED: previously the cash-flow table writes 4 rows (Revenue, Expenditures, Net Surplus, Savings
                // Goals)
                // but the chart only plotted the first 3 (cfStartRow..cfStartRow+2). The "Active Savings Goals Reserve
                // Allocation" row was silently dropped from the visualization. Now we extend the range by one row
                // so all 4 cash-flow bars appear in the chart.
                XDDFDataSource<String> cfCategories =
                        XDDFDataSourcesFactory.fromStringCellRange(
                                dashSheet, new CellRangeAddress(cfStartRow, cfStartRow + 3, 0, 0));
                XDDFNumericalDataSource<Double> cfValues =
                        XDDFDataSourcesFactory.fromNumericCellRange(
                                dashSheet, new CellRangeAddress(cfStartRow, cfStartRow + 3, 1, 1));

                XDDFChartData.Series cfSeries = barChart.addSeries(cfCategories, cfValues);
                cfSeries.setTitle("Portfolio Dynamics (" + curr.symbol() + ")", null);
                chart1.plot(barChart);

                // Chart 2: Category Expense Donut Chart (Cols E–H / 4 to 8, Rows 12 to 27)
                XSSFClientAnchor anchor2 = drawing.createAnchor(0, 0, 0, 0, 4, 12, 8, 27);
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

                XDDFDataSource<String> catCategories =
                        XDDFDataSourcesFactory.fromStringCellRange(
                                dashSheet, new CellRangeAddress(catStartRow, catEndRow, 0, 0));
                XDDFNumericalDataSource<Double> catValues =
                        XDDFDataSourcesFactory.fromNumericCellRange(
                                dashSheet, new CellRangeAddress(catStartRow, catEndRow, 1, 1));

                XDDFChartData.Series donutSeries = donutChart.addSeries(catCategories, catValues);
                donutSeries.setTitle("Expenditure Breakdown", null);
                chart2.plot(donutChart);

                // Chart 3: Daily Outflow Trendline Line Chart (Cols A–H / 0 to 8, Rows 28 to 41)
                XSSFClientAnchor anchor3 = drawing.createAnchor(0, 0, 0, 0, 0, 28, 8, 41);
                XSSFChart chart3 = drawing.createChart(anchor3);
                chart3.setTitleText("DAILY DISBURSEMENT VELOCITY & RUN-RATE (" + curr.symbol() + ")");
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
                                dashSheet, new CellRangeAddress(timeStartRow, timeEndRow, 0, 0));
                XDDFNumericalDataSource<Double> timeValues =
                        XDDFDataSourcesFactory.fromNumericCellRange(
                                dashSheet, new CellRangeAddress(timeStartRow, timeEndRow, 1, 1));

                XDDFChartData.Series lineSeries = lineChart.addSeries(timeCategories, timeValues);
                lineSeries.setTitle("Daily Outflow (" + curr.symbol() + ")", null);
                chart3.plot(lineChart);

            } catch (Exception chartEx) {
                log.warn("Native XDDF Chart generation note: {}", chartEx.getMessage());
            }

            // 7. Rich Native Conditional Formatting Across Dashboard
            SheetConditionalFormatting dashScf = dashSheet.getSheetConditionalFormatting();

            // Highlight Category Over-Budget (> 100% utilization)
            ConditionalFormattingRule overBudgetRule =
                    dashScf.createConditionalFormattingRule(ComparisonOperator.GT, "1.0");
            PatternFormatting overBudgetPf = overBudgetRule.createPatternFormatting();
            overBudgetPf.setFillBackgroundColor(IndexedColors.CORAL.getIndex());
            overBudgetPf.setFillPattern(PatternFormatting.SOLID_FOREGROUND);
            dashScf.addConditionalFormatting(
                    new CellRangeAddress[]{ new CellRangeAddress(catStartRow, catEndRow, 5, 5) }, overBudgetRule);

            // Highlight High Concentration (> 30% of outflow)
            ConditionalFormattingRule burdenRule =
                    dashScf.createConditionalFormattingRule(ComparisonOperator.GT, "0.30");
            PatternFormatting burdenPf = burdenRule.createPatternFormatting();
            burdenPf.setFillBackgroundColor(IndexedColors.LIGHT_YELLOW.getIndex());
            burdenPf.setFillPattern(PatternFormatting.SOLID_FOREGROUND);
            dashScf.addConditionalFormatting(
                    new CellRangeAddress[]{ new CellRangeAddress(catStartRow, catEndRow, 2, 2) }, burdenRule);

            // Highlight Daily Spending Surges
            // Currency-aware threshold (JPY/KRW/VND use 100,000; INR/soft currencies use 10,000; USD/EUR/etc. use
            // 1,000)
            String dailySurgeThreshold = styles.currencyAwareHighExpenseThreshold(curr);
            ConditionalFormattingRule dailySurgeRule =
                    dashScf.createConditionalFormattingRule(ComparisonOperator.GT, dailySurgeThreshold);
            PatternFormatting dailySurgePf = dailySurgeRule.createPatternFormatting();
            dailySurgePf.setFillBackgroundColor(IndexedColors.LIGHT_YELLOW.getIndex());
            dailySurgePf.setFillPattern(PatternFormatting.SOLID_FOREGROUND);
            dashScf.addConditionalFormatting(
                    new CellRangeAddress[]{ new CellRangeAddress(timeStartRow, timeEndRow, 1, 1) }, dailySurgeRule);

            // Select Dashboard as primary active tab
            workbook.setSelectedTab(0);


    }
}
