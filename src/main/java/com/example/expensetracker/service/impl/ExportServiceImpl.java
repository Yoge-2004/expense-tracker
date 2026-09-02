package com.example.expensetracker.service.impl;

import com.example.expensetracker.dto.ExpenseDto;
import com.example.expensetracker.dto.IncomeDto;
import com.example.expensetracker.mapper.ExpenseMapper;
import com.example.expensetracker.mapper.IncomeMapper;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.Income;
import com.example.expensetracker.model.SavingsGoal;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.IncomeRepository;
import com.example.expensetracker.repository.SavingsGoalRepository;
import com.example.expensetracker.service.ExportService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xddf.usermodel.chart.*;
import org.apache.poi.xssf.usermodel.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Production implementation of {@link ExportService} that converts transaction,
 * category, and savings goal datasets into CSV, JSON, OpenPDF, and PowerBI-grade Excel formats.
 * <p>
 * Key Excel highlights:
 * <ul>
 *   <li><b>PowerBI Executive Dashboard Sheet:</b> High-contrast title banners, 4 responsive KPI cards,
 *       dynamic Excel formulas ({@code =SUM}, {@code =IF}), and auto-recalculating metrics.</li>
 *   <li><b>Native OpenXML XDDF Bar/Column Charts:</b> Embedded native vector charts comparing Inflow vs Outflow.</li>
 *   <li><b>Native Conditional Formatting:</b> Color-coded visual thresholds for expense spikes, recurring streams, and achieved savings milestones.</li>
 *   <li><b>Zebra striping and currency formatting:</b> Modern, clean typography and standard financial accounting formatting.</li>
 * </ul>
 * </p>
 *
 * @author Yogeshwaran
 */
@Service
public class ExportServiceImpl implements ExportService {

    private static final Logger logger = LoggerFactory.getLogger(ExportServiceImpl.class);

    private final ExpenseRepository expenseRepository;
    private final IncomeRepository incomeRepository;
    private final SavingsGoalRepository savingsGoalRepository;
    private final ObjectMapper objectMapper;

    /**
     * Constructs a new {@code ExportServiceImpl} with repositories and JSON mapping support.
     *
     * @param expenseRepository the expense persistence repository
     * @param incomeRepository the income persistence repository
     * @param savingsGoalRepository the savings goal persistence repository
     */
    public ExportServiceImpl(ExpenseRepository expenseRepository,
                             IncomeRepository incomeRepository,
                             SavingsGoalRepository savingsGoalRepository) {
        this.expenseRepository = expenseRepository;
        this.incomeRepository = incomeRepository;
        this.savingsGoalRepository = savingsGoalRepository;
        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new JavaTimeModule());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EXPENSES EXPORT
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public byte[] exportExpensesToCsv(User user) {
        List<Expense> expenses = expenseRepository.findByUser(user);
        StringBuilder sb = new StringBuilder();
        sb.append("ID,Date,Category,Amount,Description,Recurring\n");
        for (Expense exp : expenses) {
            sb.append(exp.getId()).append(",")
                    .append(exp.getExpenseDate() != null ? exp.getExpenseDate() : "").append(",")
                    .append("\"").append(escapeCsv(exp.getCategory() != null ? exp.getCategory().getName() : "")).append("\",")
                    .append(exp.getAmount() != null ? exp.getAmount() : BigDecimal.ZERO).append(",")
                    .append("\"").append(escapeCsv(exp.getDescription() != null ? exp.getDescription() : "")).append("\",")
                    .append(exp.isRecurring()).append("\n");
        }
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    @Override
    public byte[] exportExpensesToJson(User user) {
        List<Expense> expenses = expenseRepository.findByUser(user);
        List<ExpenseDto> dtos = expenses.stream().map(ExpenseMapper::toDto).collect(Collectors.toList());
        try {
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(dtos);
        } catch (Exception e) {
            logger.error("Failed to export expenses to JSON for user {}", user.getId(), e);
            throw new RuntimeException("Error exporting expenses to JSON", e);
        }
    }

    @Override
    public byte[] exportExpensesToPdf(User user) {
        List<Expense> expenses = expenseRepository.findByUser(user);

        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document document = new Document(PageSize.A4, 36, 36, 36, 36);
            PdfWriter.getInstance(document, out);
            document.open();

            com.lowagie.text.Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18, Color.DARK_GRAY);
            Paragraph title = new Paragraph("Expense Report", titleFont);
            title.setAlignment(Element.ALIGN_CENTER);
            document.add(title);

            com.lowagie.text.Font subTitleFont = FontFactory.getFont(FontFactory.HELVETICA, 11, Color.GRAY);
            Paragraph userPara = new Paragraph(
                    "User: " + user.getName() + " (" + user.getEmail() + ")\nGenerated: " + LocalDate.now() + "\n\n",
                    subTitleFont
            );
            userPara.setAlignment(Element.ALIGN_CENTER);
            document.add(userPara);

            PdfPTable table = new PdfPTable(4);
            table.setWidthPercentage(100);
            table.setWidths(new float[]{20, 25, 35, 20});

            com.lowagie.text.Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11, Color.WHITE);
            Color headerBg = new Color(37, 99, 235);

            addHeaderCell(table, "Date", headerFont, headerBg);
            addHeaderCell(table, "Category", headerFont, headerBg);
            addHeaderCell(table, "Description", headerFont, headerBg);
            addHeaderCell(table, "Amount", headerFont, headerBg);

            BigDecimal total = BigDecimal.ZERO;
            com.lowagie.text.Font dataFont = FontFactory.getFont(FontFactory.HELVETICA, 10, Color.BLACK);

            for (Expense exp : expenses) {
                table.addCell(new Phrase(exp.getExpenseDate() != null ? exp.getExpenseDate().toString() : "", dataFont));
                table.addCell(new Phrase(exp.getCategory() != null ? exp.getCategory().getName() : "Uncategorized", dataFont));
                table.addCell(new Phrase(exp.getDescription() != null ? exp.getDescription() : "", dataFont));
                BigDecimal amt = exp.getAmount() != null ? exp.getAmount() : BigDecimal.ZERO;
                table.addCell(new Phrase(amt.toString(), dataFont));
                total = total.add(amt);
            }
            document.add(table);

            com.lowagie.text.Font totalFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14, new Color(37, 99, 235));
            Paragraph totalPara = new Paragraph("\nTotal Expenses: " + total.toString(), totalFont);
            totalPara.setAlignment(Element.ALIGN_RIGHT);
            document.add(totalPara);

            document.close();
            return out.toByteArray();
        } catch (Exception e) {
            logger.error("Failed to export expenses to PDF for user {}", user.getId(), e);
            throw new RuntimeException("Error exporting expenses to PDF", e);
        }
    }

    @Override
    public byte[] exportExpensesToExcel(User user) {
        List<Expense> expenses = expenseRepository.findByUser(user);

        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            XSSFSheet sheet = workbook.createSheet("Expenses");
            sheet.setDisplayGridlines(true);

            CellStyle headerStyle = createHeaderStyle(workbook, IndexedColors.ROYAL_BLUE.getIndex());
            DataFormat df = workbook.createDataFormat();
            CellStyle currencyStyle = workbook.createCellStyle();
            currencyStyle.setDataFormat(df.getFormat("$#,##0.00"));

            CellStyle zebraCurrencyStyle = workbook.createCellStyle();
            zebraCurrencyStyle.cloneStyleFrom(currencyStyle);
            zebraCurrencyStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            zebraCurrencyStyle.setFillPattern(FillPatternType.FINE_DOTS);

            Row headerRow = sheet.createRow(0);
            String[] headers = {"ID", "Date", "Category", "Amount", "Description", "Recurring"};
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            int rowIdx = 1;
            for (Expense exp : expenses) {
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(exp.getId() != null ? exp.getId() : 0);
                row.createCell(1).setCellValue(exp.getExpenseDate() != null ? exp.getExpenseDate().toString() : "");
                row.createCell(2).setCellValue(exp.getCategory() != null ? exp.getCategory().getName() : "Uncategorized");

                Cell amtCell = row.createCell(3);
                BigDecimal amt = exp.getAmount() != null ? exp.getAmount() : BigDecimal.ZERO;
                amtCell.setCellValue(amt.doubleValue());
                amtCell.setCellStyle(rowIdx % 2 == 0 ? zebraCurrencyStyle : currencyStyle);

                row.createCell(4).setCellValue(exp.getDescription() != null ? exp.getDescription() : "");
                row.createCell(5).setCellValue(exp.isRecurring() ? "YES" : "NO");
            }

            // Totals row with dynamic formula
            Row totalRow = sheet.createRow(rowIdx);
            Cell totalLabel = totalRow.createCell(2);
            totalLabel.setCellValue("TOTAL:");
            CellStyle boldStyle = workbook.createCellStyle();
            XSSFFont boldFont = workbook.createFont();
            boldFont.setBold(true);
            boldStyle.setFont(boldFont);
            totalLabel.setCellStyle(boldStyle);

            Cell totalVal = totalRow.createCell(3);
            if (rowIdx > 1) {
                totalVal.setCellFormula("SUM(D2:D" + rowIdx + ")");
            } else {
                totalVal.setCellValue(0.0);
            }
            CellStyle totalCurStyle = workbook.createCellStyle();
            totalCurStyle.cloneStyleFrom(boldStyle);
            totalCurStyle.setDataFormat(df.getFormat("$#,##0.00"));
            totalVal.setCellStyle(totalCurStyle);

            // Conditional Formatting: highlight amounts > 1000
            if (rowIdx > 1) {
                SheetConditionalFormatting scf = sheet.getSheetConditionalFormatting();
                ConditionalFormattingRule rule = scf.createConditionalFormattingRule(ComparisonOperator.GT, "1000");
                PatternFormatting pf = rule.createPatternFormatting();
                pf.setFillBackgroundColor(IndexedColors.CORAL.getIndex());
                pf.setFillPattern(PatternFormatting.SOLID_FOREGROUND);
                CellRangeAddress[] regions = { new CellRangeAddress(1, rowIdx - 1, 3, 3) };
                scf.addConditionalFormatting(regions, rule);
            }

            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }

            workbook.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            logger.error("Failed to export expenses to Excel for user {}", user.getId(), e);
            throw new RuntimeException("Error exporting expenses to Excel", e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INCOMES EXPORT
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public byte[] exportIncomesToCsv(User user) {
        List<Income> incomes = incomeRepository.findByUser(user);
        StringBuilder sb = new StringBuilder();
        sb.append("ID,Date,Source,Amount,Description,Recurring\n");
        for (Income inc : incomes) {
            sb.append(inc.getId()).append(",")
                    .append(inc.getIncomeDate() != null ? inc.getIncomeDate() : "").append(",")
                    .append("\"").append(escapeCsv(inc.getSource() != null ? inc.getSource() : "")).append("\",")
                    .append(inc.getAmount() != null ? inc.getAmount() : BigDecimal.ZERO).append(",")
                    .append("\"").append(escapeCsv(inc.getDescription() != null ? inc.getDescription() : "")).append("\",")
                    .append(Boolean.TRUE.equals(inc.getIsRecurring())).append("\n");
        }
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    @Override
    public byte[] exportIncomesToJson(User user) {
        List<Income> incomes = incomeRepository.findByUser(user);
        List<IncomeDto> dtos = incomes.stream().map(IncomeMapper::toDto).collect(Collectors.toList());
        try {
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(dtos);
        } catch (Exception e) {
            logger.error("Failed to export incomes to JSON for user {}", user.getId(), e);
            throw new RuntimeException("Error exporting incomes to JSON", e);
        }
    }

    @Override
    public byte[] exportIncomesToPdf(User user) {
        List<Income> incomes = incomeRepository.findByUser(user);

        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document document = new Document(PageSize.A4, 36, 36, 36, 36);
            PdfWriter.getInstance(document, out);
            document.open();

            com.lowagie.text.Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18, Color.DARK_GRAY);
            Paragraph title = new Paragraph("Income Tracker Summary Report", titleFont);
            title.setAlignment(Element.ALIGN_CENTER);
            document.add(title);

            com.lowagie.text.Font subTitleFont = FontFactory.getFont(FontFactory.HELVETICA, 11, Color.GRAY);
            Paragraph userPara = new Paragraph(
                    "User: " + user.getName() + " (" + user.getEmail() + ")\nGenerated: " + LocalDate.now() + "\n\n",
                    subTitleFont
            );
            userPara.setAlignment(Element.ALIGN_CENTER);
            document.add(userPara);

            PdfPTable table = new PdfPTable(4);
            table.setWidthPercentage(100);
            table.setWidths(new float[]{20, 25, 35, 20});

            com.lowagie.text.Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11, Color.WHITE);
            Color headerBg = new Color(16, 185, 129); // Emerald Green

            addHeaderCell(table, "Date", headerFont, headerBg);
            addHeaderCell(table, "Source", headerFont, headerBg);
            addHeaderCell(table, "Description", headerFont, headerBg);
            addHeaderCell(table, "Amount", headerFont, headerBg);

            BigDecimal total = BigDecimal.ZERO;
            com.lowagie.text.Font dataFont = FontFactory.getFont(FontFactory.HELVETICA, 10, Color.BLACK);

            for (Income inc : incomes) {
                table.addCell(new Phrase(inc.getIncomeDate() != null ? inc.getIncomeDate().toString() : "", dataFont));
                table.addCell(new Phrase(inc.getSource() != null ? inc.getSource() : "", dataFont));
                table.addCell(new Phrase(inc.getDescription() != null ? inc.getDescription() : "", dataFont));
                BigDecimal amt = inc.getAmount() != null ? inc.getAmount() : BigDecimal.ZERO;
                table.addCell(new Phrase(amt.toString(), dataFont));
                total = total.add(amt);
            }
            document.add(table);

            com.lowagie.text.Font totalFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14, new Color(16, 185, 129));
            Paragraph totalPara = new Paragraph("\nTotal Income: " + total.toString(), totalFont);
            totalPara.setAlignment(Element.ALIGN_RIGHT);
            document.add(totalPara);

            document.close();
            return out.toByteArray();
        } catch (Exception e) {
            logger.error("Failed to export incomes to PDF for user {}", user.getId(), e);
            throw new RuntimeException("Error exporting incomes to PDF", e);
        }
    }

    @Override
    public byte[] exportIncomesToExcel(User user) {
        List<Income> incomes = incomeRepository.findByUser(user);

        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            XSSFSheet sheet = workbook.createSheet("Incomes");
            sheet.setDisplayGridlines(true);

            CellStyle headerStyle = createHeaderStyle(workbook, IndexedColors.SEA_GREEN.getIndex());
            DataFormat df = workbook.createDataFormat();
            CellStyle currencyStyle = workbook.createCellStyle();
            currencyStyle.setDataFormat(df.getFormat("$#,##0.00"));

            Row headerRow = sheet.createRow(0);
            String[] headers = {"ID", "Date", "Source", "Amount", "Description", "Recurring"};
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            int rowIdx = 1;
            for (Income inc : incomes) {
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(inc.getId() != null ? inc.getId() : 0);
                row.createCell(1).setCellValue(inc.getIncomeDate() != null ? inc.getIncomeDate().toString() : "");
                row.createCell(2).setCellValue(inc.getSource() != null ? inc.getSource() : "");

                Cell amtCell = row.createCell(3);
                BigDecimal amt = inc.getAmount() != null ? inc.getAmount() : BigDecimal.ZERO;
                amtCell.setCellValue(amt.doubleValue());
                amtCell.setCellStyle(currencyStyle);

                row.createCell(4).setCellValue(inc.getDescription() != null ? inc.getDescription() : "");
                row.createCell(5).setCellValue(Boolean.TRUE.equals(inc.getIsRecurring()) ? "YES" : "NO");
            }

            // Total row with dynamic formula
            Row totalRow = sheet.createRow(rowIdx);
            Cell totalLabel = totalRow.createCell(2);
            totalLabel.setCellValue("TOTAL:");
            CellStyle boldStyle = workbook.createCellStyle();
            XSSFFont boldFont = workbook.createFont();
            boldFont.setBold(true);
            boldStyle.setFont(boldFont);
            totalLabel.setCellStyle(boldStyle);

            Cell totalVal = totalRow.createCell(3);
            if (rowIdx > 1) {
                totalVal.setCellFormula("SUM(D2:D" + rowIdx + ")");
            } else {
                totalVal.setCellValue(0.0);
            }
            CellStyle totalCurStyle = workbook.createCellStyle();
            totalCurStyle.cloneStyleFrom(boldStyle);
            totalCurStyle.setDataFormat(df.getFormat("$#,##0.00"));
            totalVal.setCellStyle(totalCurStyle);

            // Conditional formatting: highlight recurring incomes
            if (rowIdx > 1) {
                SheetConditionalFormatting scf = sheet.getSheetConditionalFormatting();
                ConditionalFormattingRule rule = scf.createConditionalFormattingRule(ComparisonOperator.EQUAL, "\"YES\"");
                PatternFormatting pf = rule.createPatternFormatting();
                pf.setFillBackgroundColor(IndexedColors.LIGHT_GREEN.getIndex());
                pf.setFillPattern(PatternFormatting.SOLID_FOREGROUND);
                CellRangeAddress[] regions = { new CellRangeAddress(1, rowIdx - 1, 5, 5) };
                scf.addConditionalFormatting(regions, rule);
            }

            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }

            workbook.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            logger.error("Failed to export incomes to Excel for user {}", user.getId(), e);
            throw new RuntimeException("Error exporting incomes to Excel", e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POWERBI-STYLE FINANCIAL INTELLIGENCE DASHBOARD EXCEL EXPORT
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public byte[] exportFinancialStatementExcel(User user) {
        List<Expense> expenses = expenseRepository.findByUser(user);
        List<Income> incomes = incomeRepository.findByUser(user);
        List<SavingsGoal> savingsGoals = savingsGoalRepository.findByUser(user);

        BigDecimal totalIncome = incomes.stream()
                .map(Income::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalExpenses = expenses.stream()
                .map(Expense::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal netSavings = totalIncome.subtract(totalExpenses);

        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            DataFormat df = workbook.createDataFormat();

            // ─────────────────────────────────────────────────────────────────
            // SHEET 1: POWERBI EXECUTIVE DASHBOARD
            // ─────────────────────────────────────────────────────────────────
            XSSFSheet dashSheet = workbook.createSheet("Dashboard");
            dashSheet.setDisplayGridlines(true);

            // 1. Dashboard Title Banner (Rows 0-1, Columns A to I)
            dashSheet.addMergedRegion(new CellRangeAddress(0, 1, 0, 8));
            Row titleRow = dashSheet.createRow(0);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("FINANCIAL INTELLIGENCE EXECUTIVE DASHBOARD");

            CellStyle titleStyle = workbook.createCellStyle();
            XSSFFont titleFont = workbook.createFont();
            titleFont.setFontName("Calibri");
            titleFont.setFontHeightInPoints((short) 16);
            titleFont.setBold(true);
            titleFont.setColor(IndexedColors.WHITE.getIndex());
            titleStyle.setFont(titleFont);
            titleStyle.setFillForegroundColor(IndexedColors.GREY_80_PERCENT.getIndex());
            titleStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            titleStyle.setAlignment(HorizontalAlignment.CENTER);
            titleStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            titleCell.setCellStyle(titleStyle);

            dashSheet.createRow(1); // placeholder for merged region

            // Subtitle Row (Row 2)
            Row subRow = dashSheet.createRow(2);
            Cell subCell = subRow.createCell(0);
            subCell.setCellValue("User: " + user.getName() + " | Email: " + user.getEmail() + " | Generated: " + LocalDate.now());
            CellStyle subStyle = workbook.createCellStyle();
            XSSFFont subFont = workbook.createFont();
            subFont.setItalic(true);
            subFont.setColor(IndexedColors.GREY_50_PERCENT.getIndex());
            subStyle.setFont(subFont);
            subCell.setCellStyle(subStyle);

            // 2. Executive KPI Cards (Row 4 = Label, Row 5 = Metric Value)
            Row kpiLabelRow = dashSheet.createRow(4);
            Row kpiValRow = dashSheet.createRow(5);

            // Helper for KPI styling
            createKpiCard(workbook, dashSheet, kpiLabelRow, kpiValRow, 0, 1,
                    "TOTAL INFLOW (EARNINGS)",
                    incomes.isEmpty() ? "0" : "SUM(Incomes!D2:D" + (incomes.size() + 1) + ")",
                    IndexedColors.SEA_GREEN.getIndex(), df.getFormat("$#,##0.00"));

            createKpiCard(workbook, dashSheet, kpiLabelRow, kpiValRow, 2, 3,
                    "TOTAL OUTFLOW (EXPENSES)",
                    expenses.isEmpty() ? "0" : "SUM(Expenses!D2:D" + (expenses.size() + 1) + ")",
                    IndexedColors.CORAL.getIndex(), df.getFormat("$#,##0.00"));

            createKpiCard(workbook, dashSheet, kpiLabelRow, kpiValRow, 4, 5,
                    "NET CASH FLOW",
                    "A6-C6",
                    IndexedColors.ROYAL_BLUE.getIndex(), df.getFormat("$#,##0.00"));

            createKpiCard(workbook, dashSheet, kpiLabelRow, kpiValRow, 6, 7,
                    "SAVINGS RATE",
                    "IF(A6>0, E6/A6, 0)",
                    IndexedColors.GOLD.getIndex(), df.getFormat("0.0%"));

            // 3. Mini Summary Data Table (Row 7 to 11, Cols A & B) for Native Chart data source
            Row tHeader = dashSheet.createRow(7);
            tHeader.createCell(0).setCellValue("Cash Flow Component");
            tHeader.createCell(1).setCellValue("Amount");
            CellStyle tableHeadStyle = createHeaderStyle(workbook, IndexedColors.GREY_50_PERCENT.getIndex());
            tHeader.getCell(0).setCellStyle(tableHeadStyle);
            tHeader.getCell(1).setCellStyle(tableHeadStyle);

            Row r1 = dashSheet.createRow(8);
            r1.createCell(0).setCellValue("Total Inflows");
            Cell c1 = r1.createCell(1);
            c1.setCellFormula("A6");
            CellStyle curStyle = workbook.createCellStyle();
            curStyle.setDataFormat(df.getFormat("$#,##0.00"));
            c1.setCellStyle(curStyle);

            Row r2 = dashSheet.createRow(9);
            r2.createCell(0).setCellValue("Total Outflows");
            Cell c2 = r2.createCell(1);
            c2.setCellFormula("C6");
            c2.setCellStyle(curStyle);

            Row r3 = dashSheet.createRow(10);
            r3.createCell(0).setCellValue("Net Savings");
            Cell c3 = r3.createCell(1);
            c3.setCellFormula("E6");
            c3.setCellStyle(curStyle);

            // 4. Native OpenXML XDDF Bar/Column Chart
            try {
                XSSFDrawing drawing = dashSheet.createDrawingPatriarch();
                XSSFClientAnchor anchor = drawing.createAnchor(0, 0, 0, 0, 2, 7, 8, 22);
                XSSFChart chart = drawing.createChart(anchor);
                chart.setTitleText("CASH FLOW PERFORMANCE (Inflows vs Outflows)");
                chart.setTitleOverlay(false);

                XDDFCategoryAxis bottomAxis = chart.createCategoryAxis(AxisPosition.BOTTOM);
                XDDFValueAxis leftAxis = chart.createValueAxis(AxisPosition.LEFT);
                leftAxis.setCrosses(AxisCrosses.AUTO_ZERO);

                XDDFChartData data = chart.createData(ChartTypes.BAR, bottomAxis, leftAxis);
                ((XDDFBarChartData) data).setBarDirection(BarDirection.COL);

                XDDFDataSource<String> xs = XDDFDataSourcesFactory.fromArray(new String[]{"Total Inflow", "Total Outflow", "Net Savings"});
                XDDFNumericalDataSource<Double> ys = XDDFDataSourcesFactory.fromArray(new Double[]{totalIncome.doubleValue(), totalExpenses.doubleValue(), netSavings.doubleValue()});

                XDDFChartData.Series series = data.addSeries(xs, ys);
                series.setTitle("Cash Flow ($)", null);
                chart.plot(data);
            } catch (Exception chartEx) {
                logger.warn("Native chart generation note: {}", chartEx.getMessage());
            }

            // 5. Conditional Formatting on Net Cash Flow Card & Summary Table
            SheetConditionalFormatting dashScf = dashSheet.getSheetConditionalFormatting();
            ConditionalFormattingRule positiveRule = dashScf.createConditionalFormattingRule(ComparisonOperator.GE, "0");
            PatternFormatting posPf = positiveRule.createPatternFormatting();
            posPf.setFillBackgroundColor(IndexedColors.LIGHT_GREEN.getIndex());
            posPf.setFillPattern(PatternFormatting.SOLID_FOREGROUND);

            ConditionalFormattingRule negativeRule = dashScf.createConditionalFormattingRule(ComparisonOperator.LT, "0");
            PatternFormatting negPf = negativeRule.createPatternFormatting();
            negPf.setFillBackgroundColor(IndexedColors.CORAL.getIndex());
            negPf.setFillPattern(PatternFormatting.SOLID_FOREGROUND);

            CellRangeAddress[] kpiNetRegions = { new CellRangeAddress(5, 5, 4, 5), new CellRangeAddress(10, 10, 1, 1) };
            dashScf.addConditionalFormatting(kpiNetRegions, positiveRule);
            dashScf.addConditionalFormatting(kpiNetRegions, negativeRule);

            dashSheet.autoSizeColumn(0);
            dashSheet.autoSizeColumn(1);

            // ─────────────────────────────────────────────────────────────────
            // SHEET 2: INCOMES DATA
            // ─────────────────────────────────────────────────────────────────
            XSSFSheet incSheet = workbook.createSheet("Incomes");
            incSheet.setDisplayGridlines(true);
            CellStyle incHeader = createHeaderStyle(workbook, IndexedColors.SEA_GREEN.getIndex());
            Row incHeaderRow = incSheet.createRow(0);
            String[] incCols = {"ID", "Date", "Source", "Amount", "Description", "Recurring"};
            for (int i = 0; i < incCols.length; i++) {
                Cell cell = incHeaderRow.createCell(i);
                cell.setCellValue(incCols[i]);
                cell.setCellStyle(incHeader);
            }
            int incRowIdx = 1;
            for (Income inc : incomes) {
                Row row = incSheet.createRow(incRowIdx++);
                row.createCell(0).setCellValue(inc.getId() != null ? inc.getId() : 0);
                row.createCell(1).setCellValue(inc.getIncomeDate() != null ? inc.getIncomeDate().toString() : "");
                row.createCell(2).setCellValue(inc.getSource() != null ? inc.getSource() : "");

                Cell amtCell = row.createCell(3);
                amtCell.setCellValue(inc.getAmount() != null ? inc.getAmount().doubleValue() : 0.0);
                amtCell.setCellStyle(curStyle);

                row.createCell(4).setCellValue(inc.getDescription() != null ? inc.getDescription() : "");
                row.createCell(5).setCellValue(Boolean.TRUE.equals(inc.getIsRecurring()) ? "YES" : "NO");
            }

            // Totals row
            Row incTotalRow = incSheet.createRow(incRowIdx);
            Cell incTotLbl = incTotalRow.createCell(2);
            incTotLbl.setCellValue("TOTAL INCOMES:");
            CellStyle bldStyle = workbook.createCellStyle();
            XSSFFont bldFont = workbook.createFont();
            bldFont.setBold(true);
            bldStyle.setFont(bldFont);
            incTotLbl.setCellStyle(bldStyle);

            Cell incTotVal = incTotalRow.createCell(3);
            if (incRowIdx > 1) {
                incTotVal.setCellFormula("SUM(D2:D" + incRowIdx + ")");
            } else {
                incTotVal.setCellValue(0.0);
            }
            CellStyle incTotCurStyle = workbook.createCellStyle();
            incTotCurStyle.cloneStyleFrom(bldStyle);
            incTotCurStyle.setDataFormat(df.getFormat("$#,##0.00"));
            incTotVal.setCellStyle(incTotCurStyle);

            // Conditional formatting: highlight recurring incomes
            if (incRowIdx > 1) {
                SheetConditionalFormatting scf = incSheet.getSheetConditionalFormatting();
                ConditionalFormattingRule rule = scf.createConditionalFormattingRule(ComparisonOperator.EQUAL, "\"YES\"");
                PatternFormatting pf = rule.createPatternFormatting();
                pf.setFillBackgroundColor(IndexedColors.LIGHT_GREEN.getIndex());
                pf.setFillPattern(PatternFormatting.SOLID_FOREGROUND);
                scf.addConditionalFormatting(new CellRangeAddress[]{ new CellRangeAddress(1, incRowIdx - 1, 5, 5) }, rule);
            }
            for (int i = 0; i < incCols.length; i++) incSheet.autoSizeColumn(i);

            // ─────────────────────────────────────────────────────────────────
            // SHEET 3: EXPENSES DATA
            // ─────────────────────────────────────────────────────────────────
            XSSFSheet expSheet = workbook.createSheet("Expenses");
            expSheet.setDisplayGridlines(true);
            CellStyle expHeader = createHeaderStyle(workbook, IndexedColors.ROYAL_BLUE.getIndex());
            Row expHeaderRow = expSheet.createRow(0);
            String[] expCols = {"ID", "Date", "Category", "Amount", "Description", "Recurring"};
            for (int i = 0; i < expCols.length; i++) {
                Cell cell = expHeaderRow.createCell(i);
                cell.setCellValue(expCols[i]);
                cell.setCellStyle(expHeader);
            }
            int expRowIdx = 1;
            for (Expense exp : expenses) {
                Row row = expSheet.createRow(expRowIdx++);
                row.createCell(0).setCellValue(exp.getId() != null ? exp.getId() : 0);
                row.createCell(1).setCellValue(exp.getExpenseDate() != null ? exp.getExpenseDate().toString() : "");
                row.createCell(2).setCellValue(exp.getCategory() != null ? exp.getCategory().getName() : "Uncategorized");

                Cell amtCell = row.createCell(3);
                amtCell.setCellValue(exp.getAmount() != null ? exp.getAmount().doubleValue() : 0.0);
                amtCell.setCellStyle(curStyle);

                row.createCell(4).setCellValue(exp.getDescription() != null ? exp.getDescription() : "");
                row.createCell(5).setCellValue(exp.isRecurring() ? "YES" : "NO");
            }

            // Totals row
            Row expTotalRow = expSheet.createRow(expRowIdx);
            Cell expTotLbl = expTotalRow.createCell(2);
            expTotLbl.setCellValue("TOTAL EXPENSES:");
            expTotLbl.setCellStyle(bldStyle);

            Cell expTotVal = expTotalRow.createCell(3);
            if (expRowIdx > 1) {
                expTotVal.setCellFormula("SUM(D2:D" + expRowIdx + ")");
            } else {
                expTotVal.setCellValue(0.0);
            }
            CellStyle expTotCurStyle = workbook.createCellStyle();
            expTotCurStyle.cloneStyleFrom(bldStyle);
            expTotCurStyle.setDataFormat(df.getFormat("$#,##0.00"));
            expTotVal.setCellStyle(expTotCurStyle);

            // Conditional formatting: highlight expenses > 1000 in soft red
            if (expRowIdx > 1) {
                SheetConditionalFormatting scf = expSheet.getSheetConditionalFormatting();
                ConditionalFormattingRule rule = scf.createConditionalFormattingRule(ComparisonOperator.GT, "1000");
                PatternFormatting pf = rule.createPatternFormatting();
                pf.setFillBackgroundColor(IndexedColors.CORAL.getIndex());
                pf.setFillPattern(PatternFormatting.SOLID_FOREGROUND);
                scf.addConditionalFormatting(new CellRangeAddress[]{ new CellRangeAddress(1, expRowIdx - 1, 3, 3) }, rule);
            }
            for (int i = 0; i < expCols.length; i++) expSheet.autoSizeColumn(i);

            // ─────────────────────────────────────────────────────────────────
            // SHEET 4: SAVINGS GOALS DATA
            // ─────────────────────────────────────────────────────────────────
            XSSFSheet goalSheet = workbook.createSheet("Savings Goals");
            goalSheet.setDisplayGridlines(true);
            CellStyle goalHeader = createHeaderStyle(workbook, IndexedColors.VIOLET.getIndex());
            Row goalHeaderRow = goalSheet.createRow(0);
            String[] goalCols = {"ID", "Goal Name", "Target Amount", "Current Amount", "Progress %", "Target Date", "Status"};
            for (int i = 0; i < goalCols.length; i++) {
                Cell cell = goalHeaderRow.createCell(i);
                cell.setCellValue(goalCols[i]);
                cell.setCellStyle(goalHeader);
            }

            CellStyle pctStyle = workbook.createCellStyle();
            pctStyle.setDataFormat(df.getFormat("0.0%"));

            int goalRowIdx = 1;
            for (SavingsGoal g : savingsGoals) {
                Row row = goalSheet.createRow(goalRowIdx++);
                row.createCell(0).setCellValue(g.getId() != null ? g.getId() : 0);
                row.createCell(1).setCellValue(g.getName() != null ? g.getName() : "");

                Cell targetCell = row.createCell(2);
                targetCell.setCellValue(g.getTargetAmount() != null ? g.getTargetAmount().doubleValue() : 0.0);
                targetCell.setCellStyle(curStyle);

                Cell curCell = row.createCell(3);
                curCell.setCellValue(g.getCurrentAmount() != null ? g.getCurrentAmount().doubleValue() : 0.0);
                curCell.setCellStyle(curStyle);

                Cell pctCell = row.createCell(4);
                pctCell.setCellFormula("IF(C" + goalRowIdx + ">0, D" + goalRowIdx + "/C" + goalRowIdx + ", 0)");
                pctCell.setCellStyle(pctStyle);

                row.createCell(5).setCellValue(g.getTargetDate() != null ? g.getTargetDate().toString() : "No deadline");

                double currentRatio = (g.getTargetAmount() != null && g.getTargetAmount().compareTo(BigDecimal.ZERO) > 0 && g.getCurrentAmount() != null)
                        ? g.getCurrentAmount().doubleValue() / g.getTargetAmount().doubleValue() : 0.0;
                row.createCell(6).setCellValue(currentRatio >= 1.0 ? "ACHIEVED" : "IN PROGRESS");
            }

            // Conditional formatting on progress column: highlight >= 100% (>= 1.0) in green
            if (goalRowIdx > 1) {
                SheetConditionalFormatting scf = goalSheet.getSheetConditionalFormatting();
                ConditionalFormattingRule rule = scf.createConditionalFormattingRule(ComparisonOperator.GE, "1.0");
                PatternFormatting pf = rule.createPatternFormatting();
                pf.setFillBackgroundColor(IndexedColors.LIGHT_GREEN.getIndex());
                pf.setFillPattern(PatternFormatting.SOLID_FOREGROUND);
                scf.addConditionalFormatting(new CellRangeAddress[]{ new CellRangeAddress(1, goalRowIdx - 1, 4, 4) }, rule);
            }
            for (int i = 0; i < goalCols.length; i++) goalSheet.autoSizeColumn(i);

            workbook.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            logger.error("Failed to export financial workbook to Excel for user {}", user.getId(), e);
            throw new RuntimeException("Error exporting financial workbook to Excel", e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PDF AND EXCEL STYLING HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    private void createKpiCard(XSSFWorkbook workbook, XSSFSheet sheet,
                               Row labelRow, Row valRow, int startCol, int endCol,
                               String label, String formulaOrVal, short accentColor, short dataFormat) {
        sheet.addMergedRegion(new CellRangeAddress(labelRow.getRowNum(), labelRow.getRowNum(), startCol, endCol));
        sheet.addMergedRegion(new CellRangeAddress(valRow.getRowNum(), valRow.getRowNum(), startCol, endCol));

        // Label style
        CellStyle lblStyle = workbook.createCellStyle();
        XSSFFont lblFont = workbook.createFont();
        lblFont.setFontHeightInPoints((short) 9);
        lblFont.setBold(true);
        lblFont.setColor(IndexedColors.GREY_50_PERCENT.getIndex());
        lblStyle.setFont(lblFont);
        lblStyle.setAlignment(HorizontalAlignment.CENTER);
        lblStyle.setVerticalAlignment(VerticalAlignment.CENTER);
        lblStyle.setBorderTop(BorderStyle.MEDIUM);
        lblStyle.setTopBorderColor(accentColor);
        lblStyle.setBorderLeft(BorderStyle.THIN);
        lblStyle.setLeftBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
        lblStyle.setBorderRight(BorderStyle.THIN);
        lblStyle.setRightBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());

        Cell lblCell = labelRow.createCell(startCol);
        lblCell.setCellValue(label);
        lblCell.setCellStyle(lblStyle);

        // Value style
        CellStyle valStyle = workbook.createCellStyle();
        XSSFFont valFont = workbook.createFont();
        valFont.setFontHeightInPoints((short) 14);
        valFont.setBold(true);
        valFont.setColor(accentColor);
        valStyle.setFont(valFont);
        valStyle.setDataFormat(dataFormat);
        valStyle.setAlignment(HorizontalAlignment.CENTER);
        valStyle.setVerticalAlignment(VerticalAlignment.CENTER);
        valStyle.setBorderBottom(BorderStyle.MEDIUM);
        valStyle.setBottomBorderColor(accentColor);
        valStyle.setBorderLeft(BorderStyle.THIN);
        valStyle.setLeftBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
        valStyle.setBorderRight(BorderStyle.THIN);
        valStyle.setRightBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());

        Cell valCell = valRow.createCell(startCol);
        if (formulaOrVal.matches("^[0-9.]+$")) {
            valCell.setCellValue(Double.parseDouble(formulaOrVal));
        } else {
            valCell.setCellFormula(formulaOrVal);
        }
        valCell.setCellStyle(valStyle);
    }

    @Override
    public byte[] exportFinancialStatementPdf(User user) {
        List<Expense> expenses = expenseRepository.findByUser(user);
        List<Income> incomes = incomeRepository.findByUser(user);
        List<SavingsGoal> savingsGoals = savingsGoalRepository.findByUser(user);

        BigDecimal totalIncome = incomes.stream()
                .map(Income::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalExpenses = expenses.stream()
                .map(Expense::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal netSavings = totalIncome.subtract(totalExpenses);

        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document document = new Document(PageSize.A4, 36, 36, 36, 36);
            PdfWriter.getInstance(document, out);
            document.open();

            com.lowagie.text.Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 20, Color.DARK_GRAY);
            Paragraph title = new Paragraph("EXECUTIVE FINANCIAL STATEMENT", titleFont);
            title.setAlignment(Element.ALIGN_CENTER);
            document.add(title);

            com.lowagie.text.Font subTitleFont = FontFactory.getFont(FontFactory.HELVETICA, 10, Color.GRAY);
            Paragraph userPara = new Paragraph(
                    "User: " + user.getName() + " (" + user.getEmail() + ") | Generated: " + LocalDate.now() + "\n\n",
                    subTitleFont
            );
            userPara.setAlignment(Element.ALIGN_CENTER);
            document.add(userPara);

            // Summary KPI Table
            PdfPTable kpiTable = new PdfPTable(3);
            kpiTable.setWidthPercentage(100);
            kpiTable.setWidths(new float[]{33, 33, 34});

            com.lowagie.text.Font kpiHeaderFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, Color.WHITE);
            addHeaderCell(kpiTable, "Total Earnings", kpiHeaderFont, new Color(16, 185, 129));
            addHeaderCell(kpiTable, "Total Spendings", kpiHeaderFont, new Color(239, 68, 68));
            addHeaderCell(kpiTable, "Net Cash Flow", kpiHeaderFont, new Color(59, 130, 246));

            com.lowagie.text.Font kpiValFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14, Color.BLACK);
            addKpiValueCell(kpiTable, "$" + totalIncome.toString(), kpiValFont);
            addKpiValueCell(kpiTable, "$" + totalExpenses.toString(), kpiValFont);
            addKpiValueCell(kpiTable, "$" + netSavings.toString(), kpiValFont);
            document.add(kpiTable);

            document.add(new Paragraph("\n"));

            // Incomes Section
            com.lowagie.text.Font sectionFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 13, new Color(16, 185, 129));
            document.add(new Paragraph("Recent Incomes", sectionFont));
            document.add(new Paragraph(" "));

            PdfPTable incTable = new PdfPTable(4);
            incTable.setWidthPercentage(100);
            incTable.setWidths(new float[]{25, 30, 25, 20});
            addHeaderCell(incTable, "Date", kpiHeaderFont, new Color(16, 185, 129));
            addHeaderCell(incTable, "Source", kpiHeaderFont, new Color(16, 185, 129));
            addHeaderCell(incTable, "Description", kpiHeaderFont, new Color(16, 185, 129));
            addHeaderCell(incTable, "Amount", kpiHeaderFont, new Color(16, 185, 129));

            com.lowagie.text.Font rowFont = FontFactory.getFont(FontFactory.HELVETICA, 9, Color.BLACK);
            for (Income inc : incomes) {
                incTable.addCell(new Phrase(inc.getIncomeDate() != null ? inc.getIncomeDate().toString() : "", rowFont));
                incTable.addCell(new Phrase(inc.getSource() != null ? inc.getSource() : "", rowFont));
                incTable.addCell(new Phrase(inc.getDescription() != null ? inc.getDescription() : "", rowFont));
                incTable.addCell(new Phrase("$" + (inc.getAmount() != null ? inc.getAmount().toString() : "0.00"), rowFont));
            }
            document.add(incTable);

            document.add(new Paragraph("\n"));

            // Expenses Section
            com.lowagie.text.Font expSecFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 13, new Color(37, 99, 235));
            document.add(new Paragraph("Recent Expenses", expSecFont));
            document.add(new Paragraph(" "));

            PdfPTable expTable = new PdfPTable(4);
            expTable.setWidthPercentage(100);
            expTable.setWidths(new float[]{25, 30, 25, 20});
            addHeaderCell(expTable, "Date", kpiHeaderFont, new Color(37, 99, 235));
            addHeaderCell(expTable, "Category", kpiHeaderFont, new Color(37, 99, 235));
            addHeaderCell(expTable, "Description", kpiHeaderFont, new Color(37, 99, 235));
            addHeaderCell(expTable, "Amount", kpiHeaderFont, new Color(37, 99, 235));

            for (Expense exp : expenses) {
                expTable.addCell(new Phrase(exp.getExpenseDate() != null ? exp.getExpenseDate().toString() : "", rowFont));
                expTable.addCell(new Phrase(exp.getCategory() != null ? exp.getCategory().getName() : "Uncategorized", rowFont));
                expTable.addCell(new Phrase(exp.getDescription() != null ? exp.getDescription() : "", rowFont));
                expTable.addCell(new Phrase("$" + (exp.getAmount() != null ? exp.getAmount().toString() : "0.00"), rowFont));
            }
            document.add(expTable);

            document.add(new Paragraph("\n"));

            // Savings Goals Section
            com.lowagie.text.Font goalSecFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 13, new Color(124, 58, 237));
            document.add(new Paragraph("Active Savings Goals", goalSecFont));
            document.add(new Paragraph(" "));

            PdfPTable goalTable = new PdfPTable(4);
            goalTable.setWidthPercentage(100);
            goalTable.setWidths(new float[]{30, 25, 25, 20});
            addHeaderCell(goalTable, "Goal Name", kpiHeaderFont, new Color(124, 58, 237));
            addHeaderCell(goalTable, "Target Amount", kpiHeaderFont, new Color(124, 58, 237));
            addHeaderCell(goalTable, "Saved Amount", kpiHeaderFont, new Color(124, 58, 237));
            addHeaderCell(goalTable, "Progress", kpiHeaderFont, new Color(124, 58, 237));

            for (SavingsGoal g : savingsGoals) {
                goalTable.addCell(new Phrase(g.getName() != null ? g.getName() : "", rowFont));
                goalTable.addCell(new Phrase("$" + (g.getTargetAmount() != null ? g.getTargetAmount().toString() : "0.00"), rowFont));
                goalTable.addCell(new Phrase("$" + (g.getCurrentAmount() != null ? g.getCurrentAmount().toString() : "0.00"), rowFont));
                double pct = (g.getTargetAmount() != null && g.getTargetAmount().compareTo(BigDecimal.ZERO) > 0 && g.getCurrentAmount() != null)
                        ? g.getCurrentAmount().doubleValue() / g.getTargetAmount().doubleValue() * 100.0 : 0.0;
                goalTable.addCell(new Phrase(String.format("%.1f%%", pct), rowFont));
            }
            document.add(goalTable);

            document.close();
            return out.toByteArray();
        } catch (Exception e) {
            logger.error("Failed to export financial statement PDF for user {}", user.getId(), e);
            throw new RuntimeException("Error exporting financial statement PDF", e);
        }
    }

    private void addHeaderCell(PdfPTable table, String text, com.lowagie.text.Font font, Color bg) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setBackgroundColor(bg);
        cell.setHorizontalAlignment(Element.ALIGN_CENTER);
        cell.setPadding(6);
        table.addCell(cell);
    }

    private void addKpiValueCell(PdfPTable table, String text, com.lowagie.text.Font font) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setHorizontalAlignment(Element.ALIGN_CENTER);
        cell.setPadding(10);
        table.addCell(cell);
    }

    private CellStyle createHeaderStyle(Workbook workbook, short bgColorIndex) {
        CellStyle style = workbook.createCellStyle();
        org.apache.poi.ss.usermodel.Font font = workbook.createFont();
        font.setBold(true);
        font.setColor(IndexedColors.WHITE.getIndex());
        style.setFont(font);
        style.setFillForegroundColor(bgColorIndex);
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.CENTER);
        return style;
    }

    private String escapeCsv(String val) {
        return val.replace("\"", "\"\"");
    }
}
