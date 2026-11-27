package com.example.expensetracker.domain.income.service;

import com.example.expensetracker.common.format.CurrencyFormats;

import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.*;
import org.springframework.stereotype.Component;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.util.List;

import com.example.expensetracker.common.CurrencyAwareDocumentExporter;
import com.example.expensetracker.domain.income.model.Income;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.infrastructure.exception.ExportException;

/**
 * Dedicated Apache POI Excel report generator for income streams.
 * Satisfies Single Responsibility Principle (SRP) by isolating spreadsheet generation.
 *
 * @author Yogeshwaran
 */
@Slf4j
@Component
public class IncomeExcelReportGenerator implements CurrencyAwareDocumentExporter<User, List<Income>> {

    private static final Color PBI_DARK_SLATE    = new Color(15, 23, 42);
    private static final Color PBI_NAVY_HERO     = new Color(30, 41, 59);
    private static final Color PBI_EMERALD_GREEN = new Color(16, 185, 129);
    private static final Color PBI_BORDER_LIGHT  = new Color(226, 232, 240);
    private static final Color PBI_TEXT_DARK     = new Color(15, 23, 42);

    @Override
    public String getFormat() {
        return "EXCEL";
    }

    @Override
    public byte[] export(User user, String preferredCurrency, List<Income> incomes) {
        return generate(user, preferredCurrency, incomes);
    }

    public byte[] generate(User user, String preferredCurrency, List<Income> incomes) {
        CurrencyFormats.Metadata curr = CurrencyFormats.resolve(preferredCurrency, user != null ? user.getCurrency() : null);
        return generate(user, preferredCurrency, incomes, curr);
    }

    public byte[] generate(User user, String preferredCurrency, List<Income> incomes, CurrencyFormats.Metadata curr) {
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            DefaultIndexedColorMap colorMap = new DefaultIndexedColorMap();
            DataFormat df = workbook.createDataFormat();

            XSSFSheet sheet = workbook.createSheet("Incomes");
            sheet.setTabColor(new XSSFColor(PBI_EMERALD_GREEN, colorMap));
            sheet.setDisplayGridlines(true);
            sheet.createFreezePane(0, 1);
            sheet.setForceFormulaRecalculation(true);

            String curFmt = curr.excelFormat();
            XSSFCellStyle headerStyle = createModernHeaderStyle(workbook, colorMap, new Color(4, 120, 87));
            XSSFCellStyle normalRowStyle = createDataRowStyle(workbook, colorMap, false, null, HorizontalAlignment.LEFT);
            XSSFCellStyle zebraRowStyle = createDataRowStyle(workbook, colorMap, true, null, HorizontalAlignment.LEFT);
            XSSFCellStyle ctrRowStyle = createDataRowStyle(workbook, colorMap, false, null, HorizontalAlignment.CENTER);
            XSSFCellStyle ctrZebraStyle = createDataRowStyle(workbook, colorMap, true, null, HorizontalAlignment.CENTER);
            XSSFCellStyle currencyStyle = createDataRowStyle(workbook, colorMap, false, curFmt, HorizontalAlignment.RIGHT);
            XSSFCellStyle zebraCurrencyStyle = createDataRowStyle(workbook, colorMap, true, curFmt, HorizontalAlignment.RIGHT);

            Row headerRow = sheet.createRow(0);
            String[] headers = {"ID", "Date", "Source", "Amount (" + curr.symbol() + ")", "Description", "Recurring"};
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }
            headerRow.setHeightInPoints(26);

            int rowIdx = 1;
            for (Income inc : incomes) {
                Row row = sheet.createRow(rowIdx++);
                row.setHeightInPoints(20);
                boolean isZebra = (rowIdx % 2 == 0);

                Cell c0 = row.createCell(0);
                c0.setCellValue(inc.getId() != null ? inc.getId() : 0);
                c0.setCellStyle(isZebra ? ctrZebraStyle : ctrRowStyle);

                Cell c1 = row.createCell(1);
                c1.setCellValue(inc.getIncomeDate() != null ? inc.getIncomeDate().toString() : "");
                c1.setCellStyle(isZebra ? ctrZebraStyle : ctrRowStyle);

                Cell c2 = row.createCell(2);
                c2.setCellValue(inc.getSource() != null ? inc.getSource() : "");
                c2.setCellStyle(isZebra ? zebraRowStyle : normalRowStyle);

                Cell amtCell = row.createCell(3);
                BigDecimal amt = inc.getAmount() != null ? inc.getAmount() : BigDecimal.ZERO;
                amtCell.setCellValue(amt.doubleValue());
                amtCell.setCellStyle(isZebra ? zebraCurrencyStyle : currencyStyle);

                Cell c4 = row.createCell(4);
                c4.setCellValue(inc.getDescription() != null ? inc.getDescription() : "");
                c4.setCellStyle(isZebra ? zebraRowStyle : normalRowStyle);

                Cell c5 = row.createCell(5);
                c5.setCellValue(Boolean.TRUE.equals(inc.getIsRecurring()) ? "YES" : "NO");
                c5.setCellStyle(isZebra ? ctrZebraStyle : ctrRowStyle);
            }

            // Totals Row with live Excel Formulas and complete perimeter borders
            Row totalRow = sheet.createRow(rowIdx);
            totalRow.setHeightInPoints(24);
            XSSFCellStyle totalLabelStyle = createTotalLabelStyle(workbook, colorMap);
            XSSFCellStyle totalValStyle = createTotalValueStyle(workbook, colorMap, df.getFormat(curFmt));

            Cell totalLabel = totalRow.createCell(2);
            totalLabel.setCellValue("TOTAL INCOMES (" + curr.symbol() + "):");
            totalLabel.setCellStyle(totalLabelStyle);

            Cell totalVal = totalRow.createCell(3);
            if (rowIdx > 1) {
                totalVal.setCellFormula("SUM(D2:D" + rowIdx + ")");
            } else {
                totalVal.setCellValue(0.0);
            }
            totalVal.setCellStyle(totalValStyle);

            // Conditional formatting: highlight recurring incomes
            if (rowIdx > 1) {
                SheetConditionalFormatting scf = sheet.getSheetConditionalFormatting();
                ConditionalFormattingRule rule =
                        scf.createConditionalFormattingRule(ComparisonOperator.EQUAL, "\"YES\"");
                PatternFormatting pf = rule.createPatternFormatting();
                pf.setFillBackgroundColor(IndexedColors.LIGHT_GREEN.getIndex());
                pf.setFillPattern(PatternFormatting.SOLID_FOREGROUND);
                scf.addConditionalFormatting(new CellRangeAddress[]{ new CellRangeAddress(1, rowIdx - 1, 5, 5) }, rule);
            }

            // Fixed widths avoid POI scanning every populated cell again during auto-sizing.
            int[] columnWidths = {10, 16, 30, 20, 52, 14};
            for (int i = 0; i < columnWidths.length; i++) {
                sheet.setColumnWidth(i, columnWidths[i] * 256);
            }

            try {
                XSSFFormulaEvaluator.evaluateAllFormulaCells(workbook);
            } catch (Exception evalEx) {
                log.debug("Income export formula evaluation note: {}", evalEx.getMessage());
            }

            workbook.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            log.error("Failed to export incomes to Excel for user {}", user.getId(), e);
            throw new ExportException("Error exporting incomes to Excel", e);
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
}
