package com.example.expensetracker.domain.report.service;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.*;
import org.springframework.stereotype.Component;

import java.awt.Color;
import java.math.BigDecimal;
import java.util.List;

import com.example.expensetracker.common.format.CurrencyFormats;
import com.example.expensetracker.domain.expense.model.Expense;
import com.example.expensetracker.domain.goal.model.SavingsGoal;
import com.example.expensetracker.domain.income.model.Income;

/** Writes the transaction and goal ledger sheets in a financial statement workbook. */
@Component
public class FinancialStatementLedgerSheetWriter {

    private final FinancialStatementExcelStyles styles;

    public FinancialStatementLedgerSheetWriter(FinancialStatementExcelStyles styles) {
        this.styles = styles;
    }

    void write(XSSFWorkbook workbook, DefaultIndexedColorMap colorMap,
               FinancialStatementWorkbookData data, FinancialStatementExcelStyles.RowStyles rowStyles) {
        DataFormat df = workbook.createDataFormat();
        CurrencyFormats.Metadata curr = data.analysis().currency();
        String curFmt = curr.excelFormat();
        List<Income> incomes = data.incomes();
        List<Expense> expenses = data.expenses();
        List<SavingsGoal> savingsGoals = data.savingsGoals();
        XSSFSheet incSheet = workbook.getSheet("Incomes");
        XSSFSheet expSheet = workbook.getSheet("Expenses");
        XSSFSheet goalSheet = workbook.getSheet("Savings Goals");
        XSSFCellStyle curDataStyle = rowStyles.currency();
        XSSFCellStyle curZebraStyle = rowStyles.currencyZebra();
        XSSFCellStyle pctDataStyle = rowStyles.percentage();
        XSSFCellStyle pctZebraStyle = rowStyles.percentageZebra();
        XSSFCellStyle txtDataStyle = rowStyles.text();
        XSSFCellStyle txtZebraStyle = rowStyles.textZebra();
        XSSFCellStyle ctrDataStyle = rowStyles.centered();
        XSSFCellStyle ctrZebraStyle = rowStyles.centeredZebra();

            // ═════════════════════════════════════════════════════════════════════════
            // POPULATE SHEET 2: INCOMES DATA LEDGER
            // ═════════════════════════════════════════════════════════════════════════
            incSheet.setDisplayGridlines(true);
            incSheet.createFreezePane(0, 1);

            XSSFCellStyle incHeader = styles.createModernHeaderStyle(workbook, colorMap, new Color(4, 120, 87));
            Row incHeaderRow = incSheet.createRow(0);
            incHeaderRow.setHeightInPoints(26);
            String[] incCols = {"ID", "Date", "Source", "Amount (" + curr.symbol() + ")", "Description", "Recurring"};
            for (int i = 0; i < incCols.length; i++) {
                Cell cell = incHeaderRow.createCell(i);
                cell.setCellValue(incCols[i]);
                cell.setCellStyle(incHeader);
            }

            int incRowIdx = 1;
            for (Income inc : incomes) {
                Row row = incSheet.createRow(incRowIdx++);
                row.setHeightInPoints(20);
                boolean isZebra = (incRowIdx % 2 == 0);

                Cell c0 = row.createCell(0);
                c0.setCellValue(inc.getId() != null ? inc.getId() : 0);
                c0.setCellStyle(isZebra ? ctrZebraStyle : ctrDataStyle);

                Cell c1 = row.createCell(1);
                c1.setCellValue(inc.getIncomeDate() != null ? inc.getIncomeDate().toString() : "");
                c1.setCellStyle(isZebra ? ctrZebraStyle : ctrDataStyle);

                Cell c2 = row.createCell(2);
                c2.setCellValue(inc.getSource() != null ? inc.getSource() : "");
                c2.setCellStyle(isZebra ? txtZebraStyle : txtDataStyle);

                Cell amtCell = row.createCell(3);
                amtCell.setCellValue(inc.getAmount() != null ? inc.getAmount().doubleValue() : 0.0);
                amtCell.setCellStyle(isZebra ? curZebraStyle : curDataStyle);

                Cell c4 = row.createCell(4);
                c4.setCellValue(inc.getDescription() != null ? inc.getDescription() : "");
                c4.setCellStyle(isZebra ? txtZebraStyle : txtDataStyle);

                Cell c5 = row.createCell(5);
                c5.setCellValue(Boolean.TRUE.equals(inc.getIsRecurring()) ? "YES" : "NO");
                c5.setCellStyle(isZebra ? ctrZebraStyle : ctrDataStyle);
            }

            Row incTotalRow = incSheet.createRow(incRowIdx);
            incTotalRow.setHeightInPoints(24);
            XSSFCellStyle incTotLblStyle = styles.createTotalLabelStyle(workbook, colorMap);
            XSSFCellStyle incTotValStyle = styles.createTotalValueStyle(workbook, colorMap, df.getFormat(curFmt));

            Cell incTotLbl = incTotalRow.createCell(2);
            incTotLbl.setCellValue("TOTAL INCOMES (" + curr.symbol() + "):");
            incTotLbl.setCellStyle(incTotLblStyle);

            Cell incTotVal = incTotalRow.createCell(3);
            if (incRowIdx > 1) {
                incTotVal.setCellFormula("SUM(D2:D" + incRowIdx + ")");
            } else {
                incTotVal.setCellValue(0.0);
            }
            incTotVal.setCellStyle(incTotValStyle);

            if (incRowIdx > 1) {
                SheetConditionalFormatting scf = incSheet.getSheetConditionalFormatting();
                ConditionalFormattingRule rule =
                        scf.createConditionalFormattingRule(ComparisonOperator.EQUAL, "\"YES\"");
                PatternFormatting pf = rule.createPatternFormatting();
                pf.setFillBackgroundColor(IndexedColors.LIGHT_GREEN.getIndex());
                pf.setFillPattern(PatternFormatting.SOLID_FOREGROUND);
                scf.addConditionalFormatting(
                        new CellRangeAddress[]{ new CellRangeAddress(1, incRowIdx - 1, 5, 5) }, rule);
            }
            int[] incColumnWidths = {3600, 4200, 6500, 5200, 9000, 4400};
            for (int i = 0; i < incColumnWidths.length; i++) {
                incSheet.setColumnWidth(i, incColumnWidths[i]);
            }

            // ═════════════════════════════════════════════════════════════════════════
            // POPULATE SHEET 3: EXPENSES DATA LEDGER
            // ═════════════════════════════════════════════════════════════════════════
            expSheet.setDisplayGridlines(true);
            expSheet.createFreezePane(0, 1);

            XSSFCellStyle expHeader = styles.createModernHeaderStyle(workbook, colorMap, new Color(30, 64, 175));
            Row expHeaderRow = expSheet.createRow(0);
            expHeaderRow.setHeightInPoints(26);
            String[] expCols = {"ID", "Date", "Category", "Amount (" + curr.symbol() + ")", "Description", "Recurring"};
            for (int i = 0; i < expCols.length; i++) {
                Cell cell = expHeaderRow.createCell(i);
                cell.setCellValue(expCols[i]);
                cell.setCellStyle(expHeader);
            }

            int expRowIdx = 1;
            for (Expense exp : expenses) {
                Row row = expSheet.createRow(expRowIdx++);
                row.setHeightInPoints(20);
                boolean isZebra = (expRowIdx % 2 == 0);

                Cell c0 = row.createCell(0);
                c0.setCellValue(exp.getId() != null ? exp.getId() : 0);
                c0.setCellStyle(isZebra ? ctrZebraStyle : ctrDataStyle);

                Cell c1 = row.createCell(1);
                c1.setCellValue(exp.getExpenseDate() != null ? exp.getExpenseDate().toString() : "");
                c1.setCellStyle(isZebra ? ctrZebraStyle : ctrDataStyle);

                Cell c2 = row.createCell(2);
                c2.setCellValue(exp.getCategory() != null ? exp.getCategory().getName() : "Uncategorized");
                c2.setCellStyle(isZebra ? txtZebraStyle : txtDataStyle);

                Cell amtCell = row.createCell(3);
                amtCell.setCellValue(exp.getAmount() != null ? exp.getAmount().doubleValue() : 0.0);
                amtCell.setCellStyle(isZebra ? curZebraStyle : curDataStyle);

                Cell c4 = row.createCell(4);
                c4.setCellValue(exp.getDescription() != null ? exp.getDescription() : "");
                c4.setCellStyle(isZebra ? txtZebraStyle : txtDataStyle);

                Cell c5 = row.createCell(5);
                c5.setCellValue(exp.isRecurring() ? "YES" : "NO");
                c5.setCellStyle(isZebra ? ctrZebraStyle : ctrDataStyle);
            }

            Row expTotalRow = expSheet.createRow(expRowIdx);
            expTotalRow.setHeightInPoints(24);
            XSSFCellStyle expTotLblStyle = styles.createTotalLabelStyle(workbook, colorMap);
            XSSFCellStyle expTotValStyle = styles.createTotalValueStyle(workbook, colorMap, df.getFormat(curFmt));

            Cell expTotLbl = expTotalRow.createCell(2);
            expTotLbl.setCellValue("TOTAL EXPENSES (" + curr.symbol() + "):");
            expTotLbl.setCellStyle(expTotLblStyle);

            Cell expTotVal = expTotalRow.createCell(3);
            if (expRowIdx > 1) {
                expTotVal.setCellFormula("SUM(D2:D" + expRowIdx + ")");
            } else {
                expTotVal.setCellValue(0.0);
            }
            expTotVal.setCellStyle(expTotValStyle);

            if (expRowIdx > 1) {
                SheetConditionalFormatting scf = expSheet.getSheetConditionalFormatting();
                // Currency-aware threshold (JPY/KRW/VND use 100,000; INR/soft currencies use 10,000; USD/EUR/etc. use
                // 1,000)
                String highAmtThreshold = styles.currencyAwareHighExpenseThreshold(curr);
                ConditionalFormattingRule rule =
                        scf.createConditionalFormattingRule(ComparisonOperator.GT, highAmtThreshold);
                PatternFormatting pf = rule.createPatternFormatting();
                pf.setFillBackgroundColor(IndexedColors.CORAL.getIndex());
                pf.setFillPattern(PatternFormatting.SOLID_FOREGROUND);
                scf.addConditionalFormatting(
                        new CellRangeAddress[]{ new CellRangeAddress(1, expRowIdx - 1, 3, 3) }, rule);

                ConditionalFormattingRule recurRule =
                        scf.createConditionalFormattingRule(ComparisonOperator.EQUAL, "\"YES\"");
                PatternFormatting recurPf = recurRule.createPatternFormatting();
                recurPf.setFillBackgroundColor(IndexedColors.LIGHT_TURQUOISE.getIndex());
                recurPf.setFillPattern(PatternFormatting.SOLID_FOREGROUND);
                scf.addConditionalFormatting(
                        new CellRangeAddress[]{ new CellRangeAddress(1, expRowIdx - 1, 5, 5) }, recurRule);
            }
            int[] expColumnWidths = {3600, 4200, 6500, 5200, 9000, 4400};
            for (int i = 0; i < expColumnWidths.length; i++) {
                expSheet.setColumnWidth(i, expColumnWidths[i]);
            }

            // ═════════════════════════════════════════════════════════════════════════
            // POPULATE SHEET 4: SAVINGS GOALS DATA LEDGER
            // ═════════════════════════════════════════════════════════════════════════
            goalSheet.setDisplayGridlines(true);
            goalSheet.createFreezePane(0, 1);

            XSSFCellStyle goalHeader = styles.createModernHeaderStyle(workbook, colorMap, new Color(109, 40, 217));
            Row goalHeaderRow = goalSheet.createRow(0);
            goalHeaderRow.setHeightInPoints(26);
            String[] goalCols =
                    {"ID", "Goal Name", "Target Amount (" + curr.symbol() + ")",
                        "Current Amount (" + curr.symbol() + ")", "Progress %", "Target Date", "Status"};
            for (int i = 0; i < goalCols.length; i++) {
                Cell cell = goalHeaderRow.createCell(i);
                cell.setCellValue(goalCols[i]);
                cell.setCellStyle(goalHeader);
            }

            int goalRowIdx = 1;
            for (SavingsGoal g : savingsGoals) {
                Row row = goalSheet.createRow(goalRowIdx++);
                row.setHeightInPoints(20);
                boolean isZebra = (goalRowIdx % 2 == 0);

                Cell c0 = row.createCell(0);
                c0.setCellValue(g.getId() != null ? g.getId() : 0);
                c0.setCellStyle(isZebra ? ctrZebraStyle : ctrDataStyle);

                Cell c1 = row.createCell(1);
                c1.setCellValue(g.getName() != null ? g.getName() : "");
                c1.setCellStyle(isZebra ? txtZebraStyle : txtDataStyle);

                Cell targetCell = row.createCell(2);
                targetCell.setCellValue(g.getTargetAmount() != null ? g.getTargetAmount().doubleValue() : 0.0);
                targetCell.setCellStyle(isZebra ? curZebraStyle : curDataStyle);

                Cell curCell = row.createCell(3);
                curCell.setCellValue(g.getCurrentAmount() != null ? g.getCurrentAmount().doubleValue() : 0.0);
                curCell.setCellStyle(isZebra ? curZebraStyle : curDataStyle);

                Cell pctCell = row.createCell(4);
                pctCell.setCellFormula("IF(C" + goalRowIdx + ">0, D" + goalRowIdx + "/C" + goalRowIdx + ", 0)");
                pctCell.setCellStyle(isZebra ? pctZebraStyle : pctDataStyle);

                Cell c5 = row.createCell(5);
                c5.setCellValue(g.getTargetDate() != null ? g.getTargetDate().toString() : "No deadline");
                c5.setCellStyle(isZebra ? ctrZebraStyle : ctrDataStyle);

                double currentRatio = (g.getTargetAmount() != null
                        && g.getTargetAmount().compareTo(BigDecimal.ZERO) > 0 && g.getCurrentAmount() != null)
                        ? g.getCurrentAmount().doubleValue() / g.getTargetAmount().doubleValue() : 0.0;
                Cell c6 = row.createCell(6);
                c6.setCellValue(currentRatio >= 1.0 ? "ACHIEVED \uD83C\uDF89" : "IN PROGRESS");
                c6.setCellStyle(isZebra ? ctrZebraStyle : ctrDataStyle);
            }

            if (goalRowIdx > 1) {
                SheetConditionalFormatting scf = goalSheet.getSheetConditionalFormatting();
                ConditionalFormattingRule rule = scf.createConditionalFormattingRule(ComparisonOperator.GE, "1.0");
                PatternFormatting pf = rule.createPatternFormatting();
                pf.setFillBackgroundColor(IndexedColors.LIGHT_GREEN.getIndex());
                pf.setFillPattern(PatternFormatting.SOLID_FOREGROUND);
                scf.addConditionalFormatting(
                        new CellRangeAddress[]{ new CellRangeAddress(1, goalRowIdx - 1, 4, 4) }, rule);
            }
            int[] goalColumnWidths = {3600, 7500, 6200, 6200, 4600, 5000, 5200};
            for (int i = 0; i < goalColumnWidths.length; i++) {
                goalSheet.setColumnWidth(i, goalColumnWidths[i]);
            }


    }
}
