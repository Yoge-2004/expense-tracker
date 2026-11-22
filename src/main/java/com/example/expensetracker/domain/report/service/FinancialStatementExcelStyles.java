package com.example.expensetracker.domain.report.service;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.*;
import org.apache.poi.xssf.usermodel.DefaultIndexedColorMap;
import org.springframework.stereotype.Component;

import java.awt.Color;

/** Creates reusable workbook styles and dashboard cards. */
@Component
class FinancialStatementExcelStyles {

    static final Color PBI_DARK_SLATE    = new Color(15, 23, 42);    // #0F172A
    static final Color PBI_NAVY_HERO     = new Color(30, 41, 59);    // #1E293B
    static final Color PBI_INDIGO_ACCENT = new Color(79, 70, 229);   // #4F46E5
    static final Color PBI_EMERALD_GREEN = new Color(16, 185, 129);  // #10B981
    static final Color PBI_ROSE_RED      = new Color(239, 68, 68);   // #EF4444
    static final Color PBI_AMBER_GOLD    = new Color(245, 158, 11);  // #F59E0B
    static final Color PBI_VIOLET        = new Color(139, 92, 246);  // #8B5CF6
    static final Color PBI_CARD_BG       = new Color(248, 250, 252); // #F8FAFC
    static final Color PBI_BORDER_SLATE  = new Color(203, 213, 225); // #CBD5E1
    static final Color PBI_BORDER_LIGHT  = new Color(226, 232, 240); // #E2E8F0
    static final Color PBI_TEXT_MUTED    = new Color(100, 116, 139); // #64748B
    static final Color PBI_TEXT_DARK     = new Color(15, 23, 42);    // #0F172A

    record RowStyles(
            XSSFCellStyle currency,
            XSSFCellStyle currencyZebra,
            XSSFCellStyle percentage,
            XSSFCellStyle percentageZebra,
            XSSFCellStyle text,
            XSSFCellStyle textZebra,
            XSSFCellStyle centered,
            XSSFCellStyle centeredZebra
    ) {}

    RowStyles createRowStyles(XSSFWorkbook workbook, DefaultIndexedColorMap colorMap, String currencyFormat) {
        return new RowStyles(
                createDataRowStyle(workbook, colorMap, false, currencyFormat, HorizontalAlignment.RIGHT),
                createDataRowStyle(workbook, colorMap, true, currencyFormat, HorizontalAlignment.RIGHT),
                createDataRowStyle(workbook, colorMap, false, "0.0%", HorizontalAlignment.RIGHT),
                createDataRowStyle(workbook, colorMap, true, "0.0%", HorizontalAlignment.RIGHT),
                createDataRowStyle(workbook, colorMap, false, null, HorizontalAlignment.LEFT),
                createDataRowStyle(workbook, colorMap, true, null, HorizontalAlignment.LEFT),
                createDataRowStyle(workbook, colorMap, false, null, HorizontalAlignment.CENTER),
                createDataRowStyle(workbook, colorMap, true, null, HorizontalAlignment.CENTER));
    }

    void createPowerBiKpiCard(XSSFWorkbook workbook, DefaultIndexedColorMap colorMap, XSSFSheet sheet,
                                      int labelRowIdx, int valRowIdx, int subRowIdx, int startCol, int endCol,
                                      String label, String formulaOrVal, Color accentColor,
                                      short dataFormat, String subtext) {
        XSSFColor accentXssf = new XSSFColor(accentColor, colorMap);
        XSSFColor cardBgXssf = new XSSFColor(PBI_CARD_BG, colorMap);
        XSSFColor borderXssf = new XSSFColor(PBI_BORDER_SLATE, colorMap);

        // Pre-create rows if absent
        for (int r = labelRowIdx; r <= subRowIdx; r++) {
            if (sheet.getRow(r) == null) {
                sheet.createRow(r);
            }
        }

        // Fonts
        XSSFFont lblFont = workbook.createFont();
        lblFont.setFontName("Segoe UI");
        lblFont.setFontHeightInPoints((short) 9);
        lblFont.setBold(true);
        lblFont.setColor(accentXssf);

        XSSFFont valFont = workbook.createFont();
        valFont.setFontName("Segoe UI");
        valFont.setFontHeightInPoints((short) 16);
        valFont.setBold(true);
        valFont.setColor(new XSSFColor(PBI_TEXT_DARK, colorMap));

        XSSFFont subFont = workbook.createFont();
        subFont.setFontName("Segoe UI");
        subFont.setFontHeightInPoints((short) 8);
        subFont.setItalic(true);
        subFont.setColor(new XSSFColor(PBI_TEXT_MUTED, colorMap));

        // Format and style EVERY cell in the card perimeter rectangle
        for (int r = labelRowIdx; r <= subRowIdx; r++) {
            Row row = sheet.getRow(r);
            for (int c = startCol; c <= endCol; c++) {
                Cell cell = row.getCell(c);
                if (cell == null) {
                    cell = row.createCell(c);
                }

                XSSFCellStyle cellStyle = workbook.createCellStyle();
                cellStyle.setFillForegroundColor(cardBgXssf);
                cellStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
                cellStyle.setAlignment(HorizontalAlignment.CENTER);
                cellStyle.setVerticalAlignment(VerticalAlignment.CENTER);

                if (r == labelRowIdx) {
                    cellStyle.setFont(lblFont);
                } else if (r == valRowIdx) {
                    cellStyle.setFont(valFont);
                    if (dataFormat > 0) {
                        cellStyle.setDataFormat(dataFormat);
                    }
                } else {
                    cellStyle.setFont(subFont);
                }

                // Apply perimeter borders
                if (c == startCol) {
                    cellStyle.setBorderLeft(BorderStyle.THIN);
                    cellStyle.setLeftBorderColor(borderXssf);
                }
                if (c == endCol) {
                    cellStyle.setBorderRight(BorderStyle.THIN);
                    cellStyle.setRightBorderColor(borderXssf);
                }
                if (r == labelRowIdx) {
                    cellStyle.setBorderTop(BorderStyle.MEDIUM);
                    cellStyle.setTopBorderColor(accentXssf);
                }
                if (r == subRowIdx) {
                    cellStyle.setBorderBottom(BorderStyle.THIN);
                    cellStyle.setBottomBorderColor(borderXssf);
                }

                cell.setCellStyle(cellStyle);
            }
        }

        // Populate card contents
        Cell lblCell = sheet.getRow(labelRowIdx).getCell(startCol);
        lblCell.setCellValue(label);

        Cell valCell = sheet.getRow(valRowIdx).getCell(startCol);
        // FIXED FORMULA DETECTION: previously this used contains("/") / contains("-") / contains("+") / contains("*")
        // as heuristics for "is this a formula?", which incorrectly treated values like "75 / 100" or "(test)"
        // as formulas — resulting in Card 5 (FINANCIAL RESILIENCE SCORE) displaying "0.75" instead of "75 / 100".
        // Now we use a strict, explicit decision tree:
        //   1) pure number        -> numeric cell value
        //   2) starts with "="    -> Excel formula (strip the leading "=")
        //   3) starts with a cell reference like A1, B12, $A$1, or a known function name like SUM(...), IF(...)
        //      -> Excel formula
        //   4) everything else    -> literal string
        if (formulaOrVal == null || formulaOrVal.isBlank()) {
            valCell.setCellValue("");
        } else if (formulaOrVal.matches("^[+-]?[0-9]+(\\.[0-9]+)?$")) {
            valCell.setCellValue(Double.parseDouble(formulaOrVal));
        } else if (formulaOrVal.startsWith("=")) {
            valCell.setCellFormula(formulaOrVal.substring(1));
        } else if (formulaOrVal.matches("^(\\$?[A-Z]+\\$?[0-9]+|[A-Z]+\\(.+\\)).*")) {
            // Starts with a cell reference like A1 / $A$1 / SUM(...) / IF(...) — treat as formula
            valCell.setCellFormula(formulaOrVal);
        } else {
            valCell.setCellValue(formulaOrVal);
        }

        Cell subCell = sheet.getRow(subRowIdx).getCell(startCol);
        subCell.setCellValue(subtext);

        // Merge horizontal segments
        sheet.addMergedRegion(new CellRangeAddress(labelRowIdx, labelRowIdx, startCol, endCol));
        sheet.addMergedRegion(new CellRangeAddress(valRowIdx, valRowIdx, startCol, endCol));
        sheet.addMergedRegion(new CellRangeAddress(subRowIdx, subRowIdx, startCol, endCol));
    }

    XSSFCellStyle createModernHeaderStyle(XSSFWorkbook workbook, DefaultIndexedColorMap colorMap, Color bg) {
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

    XSSFCellStyle createDataRowStyle(XSSFWorkbook workbook, DefaultIndexedColorMap colorMap,
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

    XSSFCellStyle createTotalLabelStyle(XSSFWorkbook workbook, DefaultIndexedColorMap colorMap) {
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

    XSSFCellStyle createTotalValueStyle(XSSFWorkbook workbook, DefaultIndexedColorMap colorMap, short format) {
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

    XSSFCellStyle createPrescriptionLabelStyle(
            XSSFWorkbook workbook, DefaultIndexedColorMap colorMap, Color accent) {
        XSSFCellStyle style = workbook.createCellStyle();
        XSSFFont font = workbook.createFont();
        font.setFontName("Segoe UI");
        font.setFontHeightInPoints((short) 9);
        font.setBold(true);
        font.setColor(new XSSFColor(Color.WHITE, colorMap));
        style.setFont(font);
        style.setFillForegroundColor(new XSSFColor(accent, colorMap));
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setBorderLeft(BorderStyle.MEDIUM);
        style.setLeftBorderColor(new XSSFColor(accent, colorMap));
        style.setBorderTop(BorderStyle.THIN);
        style.setTopBorderColor(new XSSFColor(PBI_BORDER_SLATE, colorMap));
        style.setBorderBottom(BorderStyle.THIN);
        style.setBottomBorderColor(new XSSFColor(PBI_BORDER_SLATE, colorMap));
        style.setBorderRight(BorderStyle.THIN);
        style.setRightBorderColor(new XSSFColor(PBI_BORDER_SLATE, colorMap));
        return style;
    }

    XSSFCellStyle createPrescriptionTextStyle(XSSFWorkbook workbook, DefaultIndexedColorMap colorMap) {
        XSSFCellStyle style = workbook.createCellStyle();
        XSSFFont font = workbook.createFont();
        font.setFontName("Segoe UI");
        font.setFontHeightInPoints((short) 9);
        font.setColor(new XSSFColor(PBI_TEXT_DARK, colorMap));
        style.setFont(font);
        style.setFillForegroundColor(new XSSFColor(new Color(248, 250, 252), colorMap));
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.LEFT);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setWrapText(true);
        style.setBorderTop(BorderStyle.THIN);
        style.setTopBorderColor(new XSSFColor(PBI_BORDER_LIGHT, colorMap));
        style.setBorderBottom(BorderStyle.THIN);
        style.setBottomBorderColor(new XSSFColor(PBI_BORDER_LIGHT, colorMap));
        style.setBorderLeft(BorderStyle.THIN);
        style.setLeftBorderColor(new XSSFColor(PBI_BORDER_LIGHT, colorMap));
        style.setBorderRight(BorderStyle.THIN);
        style.setRightBorderColor(new XSSFColor(PBI_BORDER_SLATE, colorMap));
        return style;
    }


    String currencyAwareHighExpenseThreshold(CurrencyFormats.Metadata curr) {
        if (curr == null) return "1000";
        if (!curr.decimals()) {
            // JPY, KRW, VND, IDR, HUF, CLP — amounts are typically 100x larger
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
