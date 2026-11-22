package com.example.expensetracker.domain.report.service;

import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.*;
import org.springframework.stereotype.Component;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.util.List;

import com.example.expensetracker.domain.expense.model.Expense;
import com.example.expensetracker.domain.report.service.ExportServiceImpl.CurrencyMeta;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.infrastructure.exception.ExportException;

/**
 * Dedicated Apache POI Excel report generator for expense transactions.
 * Satisfies Single Responsibility Principle (SRP) by isolating spreadsheet generation.
 *
 * @author Yogeshwaran
 */
@Slf4j
@Component
public class ExpenseExcelReportGenerator {

    private static final Color PBI_DARK_SLATE    = new Color(15, 23, 42);
    private static final Color PBI_NAVY_HERO     = new Color(30, 41, 59);
    private static final Color PBI_ROSE_RED      = new Color(239, 68, 68);
    private static final Color PBI_BORDER_LIGHT  = new Color(226, 232, 240);
    private static final Color PBI_TEXT_DARK     = new Color(15, 23, 42);

    public byte[] generate(User user, String preferredCurrency, List<Expense> expenses) {
        CurrencyMeta curr = ExportServiceImpl.resolveCurrency(preferredCurrency, user);
        return generate(user, preferredCurrency, expenses, curr);
    }

    public byte[] generate(User user, String preferredCurrency, List<Expense> expenses, CurrencyMeta curr) {
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            DefaultIndexedColorMap colorMap = new DefaultIndexedColorMap();
            DataFormat df = workbook.createDataFormat();

            XSSFSheet sheet = workbook.createSheet("Expenses");
            sheet.setTabColor(new XSSFColor(PBI_ROSE_RED, colorMap));
            sheet.setDisplayGridlines(true);
            sheet.createFreezePane(0, 1);
            sheet.setForceFormulaRecalculation(true);

            String curFmt = curr.getExcelFormat();
            XSSFCellStyle headerStyle = createModernHeaderStyle(workbook, colorMap, new Color(30, 64, 175));
            XSSFCellStyle normalRowStyle = createDataRowStyle(workbook, colorMap, false, null, HorizontalAlignment.LEFT);
            XSSFCellStyle zebraRowStyle = createDataRowStyle(workbook, colorMap, true, null, HorizontalAlignment.LEFT);
            XSSFCellStyle ctrRowStyle = createDataRowStyle(workbook, colorMap, false, null, HorizontalAlignment.CENTER);
            XSSFCellStyle ctrZebraStyle = createDataRowStyle(workbook, colorMap, true, null, HorizontalAlignment.CENTER);
            XSSFCellStyle currencyStyle = createDataRowStyle(workbook, colorMap, false, curFmt, HorizontalAlignment.RIGHT);
            XSSFCellStyle zebraCurrencyStyle = createDataRowStyle(workbook, colorMap, true, curFmt, HorizontalAlignment.RIGHT);

            Row headerRow = sheet.createRow(0);
            String[] headers = {"ID", "Date", "Category", "Amount (" + curr.symbol() + ")", "Description", "Recurring"};
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }
            headerRow.setHeightInPoints(26);

            int rowIdx = 1;
            for (Expense exp : expenses) {
                Row row = sheet.createRow(rowIdx++);
                row.setHeightInPoints(20);
                boolean isZebra = (rowIdx % 2 == 0);

                Cell c0 = row.createCell(0);
                c0.setCellValue(exp.getId() != null ? exp.getId() : 0);
                c0.setCellStyle(isZebra ? ctrZebraStyle : ctrRowStyle);

                Cell c1 = row.createCell(1);
                c1.setCellValue(exp.getExpenseDate() != null ? exp.getExpenseDate().toString() : "");
                c1.setCellStyle(isZebra ? ctrZebraStyle : ctrRowStyle);

                Cell c2 = row.createCell(2);
                c2.setCellValue(exp.getCategory() != null ? exp.getCategory().getName() : "Uncategorized");
                c2.setCellStyle(isZebra ? zebraRowStyle : normalRowStyle);

                Cell amtCell = row.createCell(3);
                BigDecimal amt = exp.getAmount() != null ? exp.getAmount() : BigDecimal.ZERO;
                amtCell.setCellValue(amt.doubleValue());
                amtCell.setCellStyle(isZebra ? zebraCurrencyStyle : currencyStyle);

                Cell c4 = row.createCell(4);
                c4.setCellValue(exp.getDescription() != null ? exp.getDescription() : "");
                c4.setCellStyle(isZebra ? zebraRowStyle : normalRowStyle);

                Cell c5 = row.createCell(5);
                c5.setCellValue(exp.isRecurring() ? "YES" : "NO");
                c5.setCellStyle(isZebra ? ctrZebraStyle : ctrRowStyle);
            }

            // Totals Row with live Excel Formulas and complete perimeter borders
            Row totalRow = sheet.createRow(rowIdx);
            totalRow.setHeightInPoints(24);
            XSSFCellStyle totalLabelStyle = createTotalLabelStyle(workbook, colorMap);
            XSSFCellStyle totalValStyle = createTotalValueStyle(workbook, colorMap, df.getFormat(curFmt));

            Cell totalLabel = totalRow.createCell(2);
            totalLabel.setCellValue("TOTAL OUTFLOW (" + curr.symbol() + "):");
            totalLabel.setCellStyle(totalLabelStyle);

            Cell totalVal = totalRow.createCell(3);
            if (rowIdx > 1) {
                totalVal.setCellFormula("SUM(D2:D" + rowIdx + ")");
            } else {
                totalVal.setCellValue(0.0);
            }
            totalVal.setCellStyle(totalValStyle);

            // Conditional Formatting
            if (rowIdx > 1) {
                SheetConditionalFormatting scf = sheet.getSheetConditionalFormatting();
                String highAmtThreshold = currencyAwareHighExpenseThreshold(curr);
                ConditionalFormattingRule rule =
                        scf.createConditionalFormattingRule(ComparisonOperator.GT, highAmtThreshold);
                PatternFormatting pf = rule.createPatternFormatting();
                pf.setFillBackgroundColor(IndexedColors.CORAL.getIndex());
                pf.setFillPattern(PatternFormatting.SOLID_FOREGROUND);
                scf.addConditionalFormatting(new CellRangeAddress[]{ new CellRangeAddress(1, rowIdx - 1, 3, 3) }, rule);

                ConditionalFormattingRule recurRule =
                        scf.createConditionalFormattingRule(ComparisonOperator.EQUAL, "\"YES\"");
                PatternFormatting recurPf = recurRule.createPatternFormatting();
                recurPf.setFillBackgroundColor(IndexedColors.LIGHT_TURQUOISE.getIndex());
                recurPf.setFillPattern(PatternFormatting.SOLID_FOREGROUND);
                scf.addConditionalFormatting(
                        new CellRangeAddress[]{ new CellRangeAddress(1, rowIdx - 1, 5, 5) }, recurRule);
            }

            if (rowIdx > 1) {
                sheet.setAutoFilter(new CellRangeAddress(0, rowIdx - 1, 0, headers.length - 1));
            }
            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
                sheet.setColumnWidth(i, Math.max(sheet.getColumnWidth(i) + 1600, 4200));
            }
            sheet.setColumnWidth(4, Math.max(sheet.getColumnWidth(4), 8500));

            try {
                XSSFFormulaEvaluator.evaluateAllFormulaCells(workbook);
            } catch (Exception evalEx) {
                log.debug("Expense export formula evaluation note: {}", evalEx.getMessage());
            }

            workbook.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            log.error("Failed to export expenses to Excel for user {}", user.getId(), e);
            throw new ExportException("Error exporting expenses to Excel", e);
        }
    }

    private XSSFCellStyle createModernHeaderStyle(XSSFWorkbook workbook, DefaultIndexedColorMap colorMap, Color bg) {
        XSSFCellStyle style = workbook.createCellStyle();
        XSSFFont font = workbook.createFont();
        font.setFontName("Segoe UI");
        font.setFontHeightInPoints((short) 10);
        font.setBold(true);
        font.setColor(new XSSFColor(Color.WHITE, colorMap));
        style.setFont(font);
        style.setFillForegroundColor(new XSSFColor(bg, colorMap));
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setBorderBottom(BorderStyle.MEDIUM);
        style.setBottomBorderColor(new XSSFColor(PBI_DARK_SLATE, colorMap));
        return style;
    }

    private XSSFCellStyle createDataRowStyle(XSSFWorkbook workbook, DefaultIndexedColorMap colorMap,
                                             boolean isZebra, String format, HorizontalAlignment align) {
        XSSFCellStyle style = workbook.createCellStyle();
        XSSFFont font = workbook.createFont();
        font.setFontName("Segoe UI");
        font.setFontHeightInPoints((short) 9);
        font.setColor(new XSSFColor(PBI_TEXT_DARK, colorMap));
        style.setFont(font);

        Color rowBg = isZebra ? new Color(241, 245, 249) : Color.WHITE;
        style.setFillForegroundColor(new XSSFColor(rowBg, colorMap));
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setVerticalAlignment(VerticalAlignment.CENTER);

        XSSFColor borderClr = new XSSFColor(PBI_BORDER_LIGHT, colorMap);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBottomBorderColor(borderClr);
        style.setBorderTop(BorderStyle.THIN);
        style.setTopBorderColor(borderClr);
        style.setBorderLeft(BorderStyle.THIN);
        style.setLeftBorderColor(borderClr);
        style.setBorderRight(BorderStyle.THIN);
        style.setRightBorderColor(borderClr);

        if (format != null) {
            style.setDataFormat(workbook.createDataFormat().getFormat(format));
        }
        style.setAlignment(align);
        return style;
    }

    private XSSFCellStyle createTotalLabelStyle(XSSFWorkbook workbook, DefaultIndexedColorMap colorMap) {
        XSSFCellStyle style = workbook.createCellStyle();
        XSSFFont font = workbook.createFont();
        font.setFontName("Segoe UI");
        font.setFontHeightInPoints((short) 9);
        font.setBold(true);
        font.setColor(new XSSFColor(PBI_TEXT_DARK, colorMap));
        style.setFont(font);
        style.setFillForegroundColor(new XSSFColor(new Color(226, 232, 240), colorMap));
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.RIGHT);
        style.setVerticalAlignment(VerticalAlignment.CENTER);

        XSSFColor borderClr = new XSSFColor(PBI_BORDER_LIGHT, colorMap);
        style.setBorderTop(BorderStyle.THIN);
        style.setTopBorderColor(borderClr);
        style.setBorderBottom(BorderStyle.DOUBLE);
        style.setBottomBorderColor(new XSSFColor(PBI_NAVY_HERO, colorMap));
        style.setBorderLeft(BorderStyle.THIN);
        style.setLeftBorderColor(borderClr);
        style.setBorderRight(BorderStyle.THIN);
        style.setRightBorderColor(borderClr);
        return style;
    }

    private XSSFCellStyle createTotalValueStyle(XSSFWorkbook workbook, DefaultIndexedColorMap colorMap, short format) {
        XSSFCellStyle style = workbook.createCellStyle();
        XSSFFont font = workbook.createFont();
        font.setFontName("Segoe UI");
        font.setFontHeightInPoints((short) 10);
        font.setBold(true);
        font.setColor(new XSSFColor(PBI_TEXT_DARK, colorMap));
        style.setFont(font);
        style.setDataFormat(format);
        style.setFillForegroundColor(new XSSFColor(new Color(226, 232, 240), colorMap));
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.RIGHT);
        style.setVerticalAlignment(VerticalAlignment.CENTER);

        XSSFColor borderClr = new XSSFColor(PBI_BORDER_LIGHT, colorMap);
        style.setBorderTop(BorderStyle.THIN);
        style.setTopBorderColor(borderClr);
        style.setBorderBottom(BorderStyle.DOUBLE);
        style.setBottomBorderColor(new XSSFColor(PBI_NAVY_HERO, colorMap));
        style.setBorderLeft(BorderStyle.THIN);
        style.setLeftBorderColor(borderClr);
        style.setBorderRight(BorderStyle.THIN);
        style.setRightBorderColor(borderClr);
        return style;
    }

    private String currencyAwareHighExpenseThreshold(CurrencyMeta curr) {
        if (curr == null) return "1000";
        if (!curr.decimals()) {
            return "100000";
        }
        String code = curr.code();
        if ("INR".equals(code) || "PKR".equals(code) || "NGN".equals(code)
                || "ARS".equals(code) || "COP".equals(code) || "LBP".equals(code)
                || "BDT".equals(code) || "LKR".equals(code) || "NPR".equals(code)
                || "EGP".equals(code) || "TRY".equals(code)
                || "PHP".equals(code) || "KES".equals(code)) {
            return "10000";
        }
        return "1000";
    }
}
