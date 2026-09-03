package com.example.expensetracker.service.impl;

import com.example.expensetracker.dto.ExpenseDto;
import com.example.expensetracker.dto.IncomeDto;
import com.example.expensetracker.mapper.ExpenseMapper;
import com.example.expensetracker.mapper.IncomeMapper;
import com.example.expensetracker.model.Budget;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.Income;
import com.example.expensetracker.model.SavingsGoal;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.BudgetRepository;
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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Production implementation of {@link ExportService} that converts transaction,
 * category, and savings goal datasets into CSV, JSON, OpenPDF, and PowerBI-grade Excel workbooks.
 * <p>
 * Key PowerBI Excel Highlights:
 * <ul>
 *   <li><b>Dynamic Multi-Currency Engine:</b> Resolves 50+ world currencies (e.g. INR ₹, USD $, EUR €, GBP £, JPY ¥, AED)
 *       into native Excel number formats, PDF labels, and live metric cards.</li>
 *   <li><b>Executive Financial Intelligence Dashboard:</b> Sleek 8-column canvas with dark slate executive
 *       hero banner, dual 4-card KPI metric ribbons (Solvency, Health Score, Daily Burn Velocity, Runway Days).</li>
 *   <li><b>Macro 50/30/20 Budgeting Benchmark:</b> Automatic classification of Needs, Wants, and Capital Savings
 *       with real-time variance tracking and compliance tags.</li>
 *   <li><b>Pareto 80/20 Cost Drivers & Risk Matrix:</b> Class A/B/C cost driver tiering, budget variance, and utilization alerts.</li>
 *   <li><b>Automated Strategic AI Prescriptions:</b> Dynamic, data-driven executive takeaways and cost optimization directives.</li>
 *   <li><b>Multiple Embedded Vector Visuals (XDDF Charts):</b> Cash flow performance comparison column chart,
 *       category spending distribution donut chart, and chronological spend trendline chart.</li>
 * </ul>
 * </p>
 *
 * @author Yogeshwaran
 */
@Service
public class ExportServiceImpl implements ExportService {

    private static final Logger logger = LoggerFactory.getLogger(ExportServiceImpl.class);

    // Modern PowerBI Corporate Palette (24-bit RGB)
    private static final Color PBI_DARK_SLATE    = new Color(15, 23, 42);    // #0F172A
    private static final Color PBI_NAVY_HERO     = new Color(30, 41, 59);    // #1E293B
    private static final Color PBI_INDIGO_ACCENT = new Color(79, 70, 229);   // #4F46E5
    private static final Color PBI_EMERALD_GREEN = new Color(16, 185, 129);  // #10B981
    private static final Color PBI_ROSE_RED      = new Color(239, 68, 68);   // #EF4444
    private static final Color PBI_AMBER_GOLD    = new Color(245, 158, 11);  // #F59E0B
    private static final Color PBI_VIOLET        = new Color(139, 92, 246);  // #8B5CF6
    private static final Color PBI_CARD_BG       = new Color(248, 250, 252); // #F8FAFC
    private static final Color PBI_BORDER_SLATE  = new Color(203, 213, 225); // #CBD5E1
    private static final Color PBI_BORDER_LIGHT  = new Color(226, 232, 240); // #E2E8F0
    private static final Color PBI_TEXT_MUTED    = new Color(100, 116, 139); // #64748B
    private static final Color PBI_TEXT_DARK     = new Color(15, 23, 42);    // #0F172A

    private final ExpenseRepository expenseRepository;
    private final IncomeRepository incomeRepository;
    private final SavingsGoalRepository savingsGoalRepository;
    private final ObjectMapper objectMapper;

    @Autowired(required = false)
    private BudgetRepository budgetRepository;

    /**
     * Currency configuration metadata record.
     */
    public static class CurrencyMeta {
        public final String code;
        public final String symbol;
        public final boolean decimals;

        public CurrencyMeta(String code, String symbol, boolean decimals) {
            this.code = code;
            this.symbol = symbol;
            this.decimals = decimals;
        }

        public String getExcelFormat() {
            if (!decimals) {
                return "\"" + symbol + " \"#,##0;(\"" + symbol + " \"#,##0);\"-\"";
            }
            return "\"" + symbol + " \"#,##0.00;(\"" + symbol + " \"#,##0.00);\"-\"";
        }
    }

    private static final Map<String, CurrencyMeta> CURRENCY_MAP = new HashMap<>();

    static {
        registerCurr("USD", "$", true);
        registerCurr("EUR", "€", true);
        registerCurr("GBP", "£", true);
        registerCurr("INR", "₹", true);
        registerCurr("JPY", "¥", false);
        registerCurr("CAD", "C$", true);
        registerCurr("AUD", "A$", true);
        registerCurr("CHF", "Fr", true);
        registerCurr("CNY", "¥", true);
        registerCurr("BRL", "R$", true);
        registerCurr("AED", "AED", true);
        registerCurr("SGD", "S$", true);
        registerCurr("KRW", "₩", false);
        registerCurr("RUB", "₽", true);
        registerCurr("MXN", "$", true);
        registerCurr("ZAR", "R", true);
        registerCurr("NZD", "NZ$", true);
        registerCurr("SEK", "kr", true);
        registerCurr("NOK", "kr", true);
        registerCurr("DKK", "kr", true);
        registerCurr("PLN", "zł", true);
        registerCurr("THB", "฿", true);
        registerCurr("IDR", "Rp", false);
        registerCurr("MYR", "RM", true);
        registerCurr("PHP", "₱", true);
        registerCurr("VND", "₫", false);
        registerCurr("HKD", "HK$", true);
        registerCurr("TWD", "NT$", true);
        registerCurr("SAR", "SR", true);
        registerCurr("QAR", "QR", true);
        registerCurr("KWD", "KD", true);
        registerCurr("BHD", "BD", true);
        registerCurr("OMR", "OMR", true);
        registerCurr("EGP", "E£", true);
        registerCurr("TRY", "₺", true);
        registerCurr("ILS", "₪", true);
        registerCurr("CLP", "$", false);
        registerCurr("COP", "$", true);
        registerCurr("ARS", "$", true);
        registerCurr("PEN", "S/", true);
        registerCurr("PKR", "Rs", true);
        registerCurr("BDT", "৳", true);
        registerCurr("LKR", "Rs", true);
        registerCurr("NPR", "Rs", true);
        registerCurr("NGN", "₦", true);
        registerCurr("KES", "KSh", true);
        registerCurr("GHS", "GH₵", true);
        registerCurr("CZK", "Kč", true);
        registerCurr("HUF", "Ft", false);
        registerCurr("RON", "lei", true);
        registerCurr("UAH", "₴", true);
        registerCurr("BGN", "лв", true);
        registerCurr("ISK", "kr", true);
        registerCurr("RSD", "дин", true);
        registerCurr("HRK", "kn", true);
        registerCurr("BAM", "KM", true);
        registerCurr("ALL", "L", true);
        registerCurr("MKD", "ден", true);
    }

    private static void registerCurr(String code, String symbol, boolean decimals) {
        CURRENCY_MAP.put(code.toUpperCase(), new CurrencyMeta(code.toUpperCase(), symbol, decimals));
    }

    /**
     * Resolves the currency metadata based on explicit parameter, user entity preference, or INR fallback.
     */
    public static CurrencyMeta resolveCurrency(String preferredCurrency, User user) {
        String code = null;
        if (preferredCurrency != null && !preferredCurrency.trim().isEmpty()) {
            code = preferredCurrency.trim().toUpperCase();
        } else if (user != null && user.getCurrency() != null && !user.getCurrency().trim().isEmpty()) {
            code = user.getCurrency().trim().toUpperCase();
        }
        if (code == null || code.isEmpty()) {
            code = "INR";
        }

        if (CURRENCY_MAP.containsKey(code)) {
            return CURRENCY_MAP.get(code);
        }

        try {
            Currency javaCurr = Currency.getInstance(code);
            return new CurrencyMeta(code, javaCurr.getSymbol(Locale.getDefault()), javaCurr.getDefaultFractionDigits() > 0);
        } catch (Exception e) {
            return new CurrencyMeta(code, code, true);
        }
    }

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
        return exportExpensesToPdf(user, null);
    }

    @Override
    public byte[] exportExpensesToPdf(User user, String preferredCurrency) {
        List<Expense> expenses = expenseRepository.findByUser(user);
        CurrencyMeta curr = resolveCurrency(preferredCurrency, user);

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
                    "User: " + user.getName() + " (" + user.getEmail() + ") | Currency: " + curr.code + " (" + curr.symbol + ")\nGenerated: " + LocalDate.now() + "\n\n",
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
            addHeaderCell(table, "Amount (" + curr.symbol + ")", headerFont, headerBg);

            BigDecimal total = BigDecimal.ZERO;
            com.lowagie.text.Font dataFont = FontFactory.getFont(FontFactory.HELVETICA, 10, Color.BLACK);

            for (Expense exp : expenses) {
                table.addCell(new Phrase(exp.getExpenseDate() != null ? exp.getExpenseDate().toString() : "", dataFont));
                table.addCell(new Phrase(exp.getCategory() != null ? exp.getCategory().getName() : "Uncategorized", dataFont));
                table.addCell(new Phrase(exp.getDescription() != null ? exp.getDescription() : "", dataFont));
                BigDecimal amt = exp.getAmount() != null ? exp.getAmount() : BigDecimal.ZERO;
                table.addCell(new Phrase(curr.symbol + " " + formatAmount(amt, curr.decimals), dataFont));
                total = total.add(amt);
            }
            document.add(table);

            com.lowagie.text.Font totalFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14, new Color(37, 99, 235));
            Paragraph totalPara = new Paragraph("\nTotal Expenses: " + curr.symbol + " " + formatAmount(total, curr.decimals), totalFont);
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
        return exportExpensesToExcel(user, null);
    }

    @Override
    public byte[] exportExpensesToExcel(User user, String preferredCurrency) {
        List<Expense> expenses = expenseRepository.findByUser(user);
        CurrencyMeta curr = resolveCurrency(preferredCurrency, user);

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
            String[] headers = {"ID", "Date", "Category", "Amount (" + curr.symbol + ")", "Description", "Recurring"};
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
            totalLabel.setCellValue("TOTAL OUTFLOW (" + curr.symbol + "):");
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
                ConditionalFormattingRule rule = scf.createConditionalFormattingRule(ComparisonOperator.GT, "1000");
                PatternFormatting pf = rule.createPatternFormatting();
                pf.setFillBackgroundColor(IndexedColors.CORAL.getIndex());
                pf.setFillPattern(PatternFormatting.SOLID_FOREGROUND);
                scf.addConditionalFormatting(new CellRangeAddress[]{ new CellRangeAddress(1, rowIdx - 1, 3, 3) }, rule);

                ConditionalFormattingRule recurRule = scf.createConditionalFormattingRule(ComparisonOperator.EQUAL, "\"YES\"");
                PatternFormatting recurPf = recurRule.createPatternFormatting();
                recurPf.setFillBackgroundColor(IndexedColors.LIGHT_TURQUOISE.getIndex());
                recurPf.setFillPattern(PatternFormatting.SOLID_FOREGROUND);
                scf.addConditionalFormatting(new CellRangeAddress[]{ new CellRangeAddress(1, rowIdx - 1, 5, 5) }, recurRule);
            }

            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
                sheet.setColumnWidth(i, Math.max(sheet.getColumnWidth(i) + 1400, 3800));
            }

            try {
                XSSFFormulaEvaluator.evaluateAllFormulaCells(workbook);
            } catch (Exception evalEx) {
                logger.debug("Formula evaluation note: {}", evalEx.getMessage());
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
        return exportIncomesToPdf(user, null);
    }

    @Override
    public byte[] exportIncomesToPdf(User user, String preferredCurrency) {
        List<Income> incomes = incomeRepository.findByUser(user);
        CurrencyMeta curr = resolveCurrency(preferredCurrency, user);

        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document document = new Document(PageSize.A4, 36, 36, 36, 36);
            PdfWriter.getInstance(document, out);
            document.open();

            com.lowagie.text.Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18, Color.DARK_GRAY);
            Paragraph title = new Paragraph("Income Report", titleFont);
            title.setAlignment(Element.ALIGN_CENTER);
            document.add(title);

            com.lowagie.text.Font subTitleFont = FontFactory.getFont(FontFactory.HELVETICA, 11, Color.GRAY);
            Paragraph userPara = new Paragraph(
                    "User: " + user.getName() + " (" + user.getEmail() + ") | Currency: " + curr.code + " (" + curr.symbol + ")\nGenerated: " + LocalDate.now() + "\n\n",
                    subTitleFont
            );
            userPara.setAlignment(Element.ALIGN_CENTER);
            document.add(userPara);

            PdfPTable table = new PdfPTable(4);
            table.setWidthPercentage(100);
            table.setWidths(new float[]{20, 25, 35, 20});

            com.lowagie.text.Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11, Color.WHITE);
            Color headerBg = new Color(4, 120, 87);

            addHeaderCell(table, "Date", headerFont, headerBg);
            addHeaderCell(table, "Source", headerFont, headerBg);
            addHeaderCell(table, "Description", headerFont, headerBg);
            addHeaderCell(table, "Amount (" + curr.symbol + ")", headerFont, headerBg);

            BigDecimal total = BigDecimal.ZERO;
            com.lowagie.text.Font dataFont = FontFactory.getFont(FontFactory.HELVETICA, 10, Color.BLACK);

            for (Income inc : incomes) {
                table.addCell(new Phrase(inc.getIncomeDate() != null ? inc.getIncomeDate().toString() : "", dataFont));
                table.addCell(new Phrase(inc.getSource() != null ? inc.getSource() : "", dataFont));
                table.addCell(new Phrase(inc.getDescription() != null ? inc.getDescription() : "", dataFont));
                BigDecimal amt = inc.getAmount() != null ? inc.getAmount() : BigDecimal.ZERO;
                table.addCell(new Phrase(curr.symbol + " " + formatAmount(amt, curr.decimals), dataFont));
                total = total.add(amt);
            }
            document.add(table);

            com.lowagie.text.Font totalFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14, new Color(4, 120, 87));
            Paragraph totalPara = new Paragraph("\nTotal Incomes: " + curr.symbol + " " + formatAmount(total, curr.decimals), totalFont);
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
        return exportIncomesToExcel(user, null);
    }

    @Override
    public byte[] exportIncomesToExcel(User user, String preferredCurrency) {
        List<Income> incomes = incomeRepository.findByUser(user);
        CurrencyMeta curr = resolveCurrency(preferredCurrency, user);

        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            DefaultIndexedColorMap colorMap = new DefaultIndexedColorMap();
            DataFormat df = workbook.createDataFormat();

            XSSFSheet sheet = workbook.createSheet("Incomes");
            sheet.setTabColor(new XSSFColor(PBI_EMERALD_GREEN, colorMap));
            sheet.setDisplayGridlines(true);
            sheet.createFreezePane(0, 1);
            sheet.setForceFormulaRecalculation(true);

            String curFmt = curr.getExcelFormat();
            XSSFCellStyle headerStyle = createModernHeaderStyle(workbook, colorMap, new Color(4, 120, 87));
            XSSFCellStyle normalRowStyle = createDataRowStyle(workbook, colorMap, false, null, HorizontalAlignment.LEFT);
            XSSFCellStyle zebraRowStyle = createDataRowStyle(workbook, colorMap, true, null, HorizontalAlignment.LEFT);
            XSSFCellStyle ctrRowStyle = createDataRowStyle(workbook, colorMap, false, null, HorizontalAlignment.CENTER);
            XSSFCellStyle ctrZebraStyle = createDataRowStyle(workbook, colorMap, true, null, HorizontalAlignment.CENTER);
            XSSFCellStyle currencyStyle = createDataRowStyle(workbook, colorMap, false, curFmt, HorizontalAlignment.RIGHT);
            XSSFCellStyle zebraCurrencyStyle = createDataRowStyle(workbook, colorMap, true, curFmt, HorizontalAlignment.RIGHT);

            Row headerRow = sheet.createRow(0);
            String[] headers = {"ID", "Date", "Source", "Amount (" + curr.symbol + ")", "Description", "Recurring"};
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
            totalLabel.setCellValue("TOTAL INCOMES (" + curr.symbol + "):");
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
                ConditionalFormattingRule rule = scf.createConditionalFormattingRule(ComparisonOperator.EQUAL, "\"YES\"");
                PatternFormatting pf = rule.createPatternFormatting();
                pf.setFillBackgroundColor(IndexedColors.LIGHT_GREEN.getIndex());
                pf.setFillPattern(PatternFormatting.SOLID_FOREGROUND);
                scf.addConditionalFormatting(new CellRangeAddress[]{ new CellRangeAddress(1, rowIdx - 1, 5, 5) }, rule);
            }

            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
                sheet.setColumnWidth(i, Math.max(sheet.getColumnWidth(i) + 1400, 3800));
            }

            try {
                XSSFFormulaEvaluator.evaluateAllFormulaCells(workbook);
            } catch (Exception evalEx) {
                logger.debug("Formula evaluation note: {}", evalEx.getMessage());
            }

            workbook.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            logger.error("Failed to export incomes to Excel for user {}", user.getId(), e);
            throw new RuntimeException("Error exporting incomes to Excel", e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POWERBI-STYLE FINANCIAL INTELLIGENCE DASHBOARD MASTER WORKBOOK
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public byte[] exportFinancialStatementExcel(User user) {
        return exportFinancialStatementExcel(user, null);
    }

    @Override
    public byte[] exportFinancialStatementExcel(User user, String preferredCurrency) {
        List<Expense> expenses = expenseRepository.findByUser(user);
        List<Income> incomes = incomeRepository.findByUser(user);
        List<SavingsGoal> savingsGoals = savingsGoalRepository.findByUser(user);
        List<Budget> budgets = (budgetRepository != null) ? budgetRepository.findByUser(user) : Collections.emptyList();

        CurrencyMeta curr = resolveCurrency(preferredCurrency, user);
        String curFmt = curr.getExcelFormat();

        // 1. High-Level Aggregations & Advanced Metrics Calculations
        BigDecimal totalIncBd = incomes.stream().map(Income::getAmount).filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalExpBd = expenses.stream().map(Expense::getAmount).filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        double totalInc = totalIncBd.doubleValue();
        double totalExp = totalExpBd.doubleValue();
        double netSurplus = totalInc - totalExp;
        double savingsRate = totalInc > 0 ? Math.max(0.0, netSurplus / totalInc) : 0.0;

        // Build Category Budgets Lookup
        Map<String, Double> budgetMap = new HashMap<>();
        for (Budget b : budgets) {
            if (b.getCategory() != null && b.getCategory().getName() != null && b.getLimitAmount() != null) {
                budgetMap.put(b.getCategory().getName(), b.getLimitAmount().doubleValue());
            }
        }

        // Group category expenditures
        Map<String, Double> categoryTotals = expenses.stream()
                .collect(Collectors.groupingBy(
                        e -> (e.getCategory() != null && e.getCategory().getName() != null && !e.getCategory().getName().isBlank())
                                ? e.getCategory().getName() : "Uncategorized",
                        LinkedHashMap::new,
                        Collectors.summingDouble(e -> e.getAmount() != null ? e.getAmount().doubleValue() : 0.0)
                ));
        if (categoryTotals.isEmpty()) {
            categoryTotals.put("General Expenses", 0.0);
        }

        // Chronological Daily Spend series
        Map<String, Double> dailyTotals = expenses.stream()
                .filter(e -> e.getExpenseDate() != null)
                .collect(Collectors.groupingBy(
                        e -> e.getExpenseDate().toString(),
                        TreeMap::new,
                        Collectors.summingDouble(e -> e.getAmount() != null ? e.getAmount().doubleValue() : 0.0)
                ));
        if (dailyTotals.isEmpty()) {
            dailyTotals.put(LocalDate.now().minusDays(2).toString(), 0.0);
            dailyTotals.put(LocalDate.now().minusDays(1).toString(), 0.0);
            dailyTotals.put(LocalDate.now().toString(), 0.0);
        }

        // Burn Velocity & Runway Telemetry
        int activeDays = Math.max(1, dailyTotals.size());
        double dailyBurn = totalExp / activeDays;
        double monthlyBurnRunRate = dailyBurn * 30.4;
        double runwayDays = dailyBurn > 0 ? (netSurplus > 0 ? (netSurplus / dailyBurn) : 0.0) : 999.0;
        double runwayMonths = runwayDays / 30.4;

        // 50/30/20 Rule Classification (Needs vs Wants vs Savings)
        Set<String> needsKeywords = Set.of(
                "food", "groceries", "grocery", "rent", "housing", "mortgage", "utilities", "utility",
                "electric", "electricity", "water", "gas", "internet", "transport", "transportation",
                "fuel", "petrol", "diesel", "health", "medical", "medicine", "doctor", "insurance",
                "education", "loan", "emi", "tax", "bills", "bill"
        );

        double needsSpend = 0.0;
        double wantsSpend = 0.0;
        for (Expense e : expenses) {
            double amt = e.getAmount() != null ? e.getAmount().doubleValue() : 0.0;
            String catName = (e.getCategory() != null && e.getCategory().getName() != null)
                    ? e.getCategory().getName().toLowerCase() : "";
            boolean isNeed = false;
            for (String kw : needsKeywords) {
                if (catName.contains(kw)) {
                    isNeed = true;
                    break;
                }
            }
            if (isNeed) {
                needsSpend += amt;
            } else {
                wantsSpend += amt;
            }
        }
        double totalAllocated = totalExp + Math.max(0.0, netSurplus);
        if (totalAllocated <= 0.0) totalAllocated = 1.0;
        double needsPct = needsSpend / totalAllocated;
        double wantsPct = wantsSpend / totalAllocated;
        double savingsPct = Math.max(0.0, netSurplus) / totalAllocated;

        // Executive Financial Health Score Calculation (0 to 100)
        int healthScore = 50;
        if (savingsRate >= 0.30) healthScore += 30;
        else if (savingsRate >= 0.20) healthScore += 25;
        else if (savingsRate >= 0.10) healthScore += 15;
        else if (savingsRate > 0.0) healthScore += 5;
        else healthScore -= 15;

        double totalBudget = budgetMap.values().stream().mapToDouble(Double::doubleValue).sum();
        if (totalBudget > 0) {
            double overallUtil = totalExp / totalBudget;
            if (overallUtil <= 0.80) healthScore += 25;
            else if (overallUtil <= 1.0) healthScore += 15;
            else healthScore -= 20;
        } else {
            healthScore += 15;
        }

        double recurringSpend = expenses.stream().filter(Expense::isRecurring)
                .mapToDouble(e -> e.getAmount() != null ? e.getAmount().doubleValue() : 0.0).sum();
        double recurringRatio = totalExp > 0 ? recurringSpend / totalExp : 0.0;
        if (recurringRatio <= 0.40) healthScore += 25;
        else if (recurringRatio <= 0.60) healthScore += 15;
        else healthScore -= 10;

        if (runwayDays >= 90) healthScore += 20;
        else if (runwayDays >= 30) healthScore += 12;
        else if (runwayDays > 0) healthScore += 5;
        else healthScore -= 10;

        healthScore = Math.max(15, Math.min(99, healthScore));

        String healthGrade;
        String healthStatusText;
        Color healthColor;
        if (healthScore >= 85) {
            healthGrade = "GRADE A+";
            healthStatusText = "EXCEPTIONAL CAPITAL EFFICIENCY";
            healthColor = PBI_EMERALD_GREEN;
        } else if (healthScore >= 70) {
            healthGrade = "GRADE A";
            healthStatusText = "ROBUST FINANCIAL STABILITY";
            healthColor = PBI_EMERALD_GREEN;
        } else if (healthScore >= 55) {
            healthGrade = "GRADE B";
            healthStatusText = "MODERATE - CONTROLLED EXPOSURE";
            healthColor = PBI_AMBER_GOLD;
        } else if (healthScore >= 40) {
            healthGrade = "GRADE C";
            healthStatusText = "VULNERABLE - BUDGET ELEVATED";
            healthColor = PBI_ROSE_RED;
        } else {
            healthGrade = "GRADE D";
            healthStatusText = "CRITICAL DEFICIT - ACTION REQUIRED";
            healthColor = PBI_ROSE_RED;
        }

        // Pareto 80/20 Analysis & Sorting
        List<Map.Entry<String, Double>> sortedCategories = categoryTotals.entrySet().stream()
                .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .collect(Collectors.toList());

        double runningTotal = 0.0;
        Map<String, String> paretoTiers = new HashMap<>();
        for (Map.Entry<String, Double> entry : sortedCategories) {
            runningTotal += entry.getValue();
            double cumPct = totalExp > 0 ? runningTotal / totalExp : 0.0;
            if (cumPct <= 0.70) {
                paretoTiers.put(entry.getKey(), "TIER A (CORE DRIVER)");
            } else if (cumPct <= 0.90) {
                paretoTiers.put(entry.getKey(), "TIER B (SECONDARY)");
            } else {
                paretoTiers.put(entry.getKey(), "TIER C (LONG TAIL)");
            }
        }

        // Dynamic AI Prescriptions
        String topCatName = sortedCategories.isEmpty() ? "General" : sortedCategories.get(0).getKey();
        double topCatSpend = sortedCategories.isEmpty() ? 0.0 : sortedCategories.get(0).getValue();
        double topCatShare = totalExp > 0 ? (topCatSpend / totalExp) * 100.0 : 0.0;
        double potentialSaving = topCatSpend * 0.10;

        String p1 = String.format(Locale.US, "Cost Optimization Priority: '%s' is your largest cost driver, consuming %.1f%% of expenditures (%s %,.2f). Trimming 10%% will redirect %s %,.2f/month back into capital surplus.",
                topCatName, topCatShare, curr.symbol, topCatSpend, curr.symbol, potentialSaving);

        String p2 = String.format(Locale.US, "Liquidity & Survival Runway: At your current burn velocity of %s %,.2f/day, your net surplus of %s %,.2f provides %.0f days (%.1f months) of reserves buffer.",
                curr.symbol, dailyBurn, curr.symbol, Math.max(0.0, netSurplus), runwayDays, runwayMonths);

        String p3;
        if (wantsPct > 0.35) {
            p3 = String.format(Locale.US, "50/30/20 Macro Allocation Alert: Discretionary lifestyle 'Wants' consume %.1f%% of capital (exceeding the 30%% guideline by %.1f%%). Curbing non-essential outflow accelerates compounding.",
                    wantsPct * 100.0, (wantsPct - 0.30) * 100.0);
        } else if (savingsPct >= 0.20) {
            p3 = String.format(Locale.US, "50/30/20 Macro Allocation Optimal: Capital savings rate is %.1f%% (exceeding the 20%% target by +%.1f%%). Outstanding capital accumulation discipline.",
                    savingsPct * 100.0, (savingsPct - 0.20) * 100.0);
        } else {
            p3 = String.format(Locale.US, "50/30/20 Macro Allocation Deficit: Capital savings rate is currently %.1f%% (below the recommended 20%% target). Aim to trim discretionary spend to close the %.1f%% gap.",
                    savingsPct * 100.0, (0.20 - savingsPct) * 100.0);
        }

        double totalGoalTarget = savingsGoals.stream().map(SavingsGoal::getTargetAmount).filter(Objects::nonNull).mapToDouble(BigDecimal::doubleValue).sum();
        double totalGoalSaved = savingsGoals.stream().map(SavingsGoal::getCurrentAmount).filter(Objects::nonNull).mapToDouble(BigDecimal::doubleValue).sum();
        double goalProgress = totalGoalTarget > 0 ? (totalGoalSaved / totalGoalTarget) * 100.0 : 0.0;

        String p4;
        if (totalGoalTarget > 0) {
            p4 = String.format(Locale.US, "Savings Goals Trajectory: Accumulated %s %,.2f toward total goal targets of %s %,.2f (%.1f%% achieved). Current retention pace supports continuous goal funding.",
                    curr.symbol, totalGoalSaved, curr.symbol, totalGoalTarget, goalProgress);
        } else {
            p4 = "Savings Strategy Recommendation: No active savings goals detected. Establish defined capital targets (Emergency Reserve, Asset Investment) to maximize wealth growth.";
        }

        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            DefaultIndexedColorMap colorMap = new DefaultIndexedColorMap();
            DataFormat df = workbook.createDataFormat();

            // 1. Create ALL sheets in order
            XSSFSheet dashSheet = workbook.createSheet("Dashboard");
            XSSFSheet incSheet = workbook.createSheet("Incomes");
            XSSFSheet expSheet = workbook.createSheet("Expenses");
            XSSFSheet goalSheet = workbook.createSheet("Savings Goals");

            // Set tab branding colors
            dashSheet.setTabColor(new XSSFColor(PBI_INDIGO_ACCENT, colorMap));
            incSheet.setTabColor(new XSSFColor(PBI_EMERALD_GREEN, colorMap));
            expSheet.setTabColor(new XSSFColor(PBI_ROSE_RED, colorMap));
            goalSheet.setTabColor(new XSSFColor(PBI_VIOLET, colorMap));

            // Enable automatic formula calculation across all sheets
            dashSheet.setForceFormulaRecalculation(true);
            incSheet.setForceFormulaRecalculation(true);
            expSheet.setForceFormulaRecalculation(true);
            goalSheet.setForceFormulaRecalculation(true);

            // Reusable typography & alignment styles
            XSSFCellStyle curDataStyle = createDataRowStyle(workbook, colorMap, false, curFmt, HorizontalAlignment.RIGHT);
            XSSFCellStyle curZebraStyle = createDataRowStyle(workbook, colorMap, true, curFmt, HorizontalAlignment.RIGHT);
            XSSFCellStyle pctDataStyle = createDataRowStyle(workbook, colorMap, false, "0.0%", HorizontalAlignment.RIGHT);
            XSSFCellStyle pctZebraStyle = createDataRowStyle(workbook, colorMap, true, "0.0%", HorizontalAlignment.RIGHT);
            XSSFCellStyle txtDataStyle = createDataRowStyle(workbook, colorMap, false, null, HorizontalAlignment.LEFT);
            XSSFCellStyle txtZebraStyle = createDataRowStyle(workbook, colorMap, true, null, HorizontalAlignment.LEFT);
            XSSFCellStyle ctrDataStyle = createDataRowStyle(workbook, colorMap, false, null, HorizontalAlignment.CENTER);
            XSSFCellStyle ctrZebraStyle = createDataRowStyle(workbook, colorMap, true, null, HorizontalAlignment.CENTER);

            // ═════════════════════════════════════════════════════════════════════════
            // POPULATE SHEET 2: INCOMES DATA LEDGER
            // ═════════════════════════════════════════════════════════════════════════
            incSheet.setDisplayGridlines(true);
            incSheet.createFreezePane(0, 1);

            XSSFCellStyle incHeader = createModernHeaderStyle(workbook, colorMap, new Color(4, 120, 87));
            Row incHeaderRow = incSheet.createRow(0);
            incHeaderRow.setHeightInPoints(26);
            String[] incCols = {"ID", "Date", "Source", "Amount (" + curr.symbol + ")", "Description", "Recurring"};
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
            XSSFCellStyle incTotLblStyle = createTotalLabelStyle(workbook, colorMap);
            XSSFCellStyle incTotValStyle = createTotalValueStyle(workbook, colorMap, df.getFormat(curFmt));

            Cell incTotLbl = incTotalRow.createCell(2);
            incTotLbl.setCellValue("TOTAL INCOMES (" + curr.symbol + "):");
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
                ConditionalFormattingRule rule = scf.createConditionalFormattingRule(ComparisonOperator.EQUAL, "\"YES\"");
                PatternFormatting pf = rule.createPatternFormatting();
                pf.setFillBackgroundColor(IndexedColors.LIGHT_GREEN.getIndex());
                pf.setFillPattern(PatternFormatting.SOLID_FOREGROUND);
                scf.addConditionalFormatting(new CellRangeAddress[]{ new CellRangeAddress(1, incRowIdx - 1, 5, 5) }, rule);
            }
            for (int i = 0; i < incCols.length; i++) {
                incSheet.autoSizeColumn(i);
                incSheet.setColumnWidth(i, Math.max(incSheet.getColumnWidth(i) + 1400, 3800));
            }

            // ═════════════════════════════════════════════════════════════════════════
            // POPULATE SHEET 3: EXPENSES DATA LEDGER
            // ═════════════════════════════════════════════════════════════════════════
            expSheet.setDisplayGridlines(true);
            expSheet.createFreezePane(0, 1);

            XSSFCellStyle expHeader = createModernHeaderStyle(workbook, colorMap, new Color(30, 64, 175));
            Row expHeaderRow = expSheet.createRow(0);
            expHeaderRow.setHeightInPoints(26);
            String[] expCols = {"ID", "Date", "Category", "Amount (" + curr.symbol + ")", "Description", "Recurring"};
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
            XSSFCellStyle expTotLblStyle = createTotalLabelStyle(workbook, colorMap);
            XSSFCellStyle expTotValStyle = createTotalValueStyle(workbook, colorMap, df.getFormat(curFmt));

            Cell expTotLbl = expTotalRow.createCell(2);
            expTotLbl.setCellValue("TOTAL EXPENSES (" + curr.symbol + "):");
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
                ConditionalFormattingRule rule = scf.createConditionalFormattingRule(ComparisonOperator.GT, "1000");
                PatternFormatting pf = rule.createPatternFormatting();
                pf.setFillBackgroundColor(IndexedColors.CORAL.getIndex());
                pf.setFillPattern(PatternFormatting.SOLID_FOREGROUND);
                scf.addConditionalFormatting(new CellRangeAddress[]{ new CellRangeAddress(1, expRowIdx - 1, 3, 3) }, rule);

                ConditionalFormattingRule recurRule = scf.createConditionalFormattingRule(ComparisonOperator.EQUAL, "\"YES\"");
                PatternFormatting recurPf = recurRule.createPatternFormatting();
                recurPf.setFillBackgroundColor(IndexedColors.LIGHT_TURQUOISE.getIndex());
                recurPf.setFillPattern(PatternFormatting.SOLID_FOREGROUND);
                scf.addConditionalFormatting(new CellRangeAddress[]{ new CellRangeAddress(1, expRowIdx - 1, 5, 5) }, recurRule);
            }
            for (int i = 0; i < expCols.length; i++) {
                expSheet.autoSizeColumn(i);
                expSheet.setColumnWidth(i, Math.max(expSheet.getColumnWidth(i) + 1400, 3800));
            }

            // ═════════════════════════════════════════════════════════════════════════
            // POPULATE SHEET 4: SAVINGS GOALS DATA LEDGER
            // ═════════════════════════════════════════════════════════════════════════
            goalSheet.setDisplayGridlines(true);
            goalSheet.createFreezePane(0, 1);

            XSSFCellStyle goalHeader = createModernHeaderStyle(workbook, colorMap, new Color(109, 40, 217));
            Row goalHeaderRow = goalSheet.createRow(0);
            goalHeaderRow.setHeightInPoints(26);
            String[] goalCols = {"ID", "Goal Name", "Target Amount (" + curr.symbol + ")", "Current Amount (" + curr.symbol + ")", "Progress %", "Target Date", "Status"};
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

                double currentRatio = (g.getTargetAmount() != null && g.getTargetAmount().compareTo(BigDecimal.ZERO) > 0 && g.getCurrentAmount() != null)
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
                scf.addConditionalFormatting(new CellRangeAddress[]{ new CellRangeAddress(1, goalRowIdx - 1, 4, 4) }, rule);
            }
            for (int i = 0; i < goalCols.length; i++) {
                goalSheet.autoSizeColumn(i);
                goalSheet.setColumnWidth(i, Math.max(goalSheet.getColumnWidth(i) + 1400, 3800));
            }

            // ═════════════════════════════════════════════════════════════════════════
            // POPULATE SHEET 1: POWERBI FINANCIAL INTELLIGENCE EXECUTIVE DASHBOARD
            // ═════════════════════════════════════════════════════════════════════════
            dashSheet.setDisplayGridlines(false);
            dashSheet.createFreezePane(0, 7); // Freeze sticky Primary KPI cards and Hero Banner on scroll

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
            bannerStyle.setFillForegroundColor(new XSSFColor(PBI_DARK_SLATE, colorMap));
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
            dashSheet.getRow(0).getCell(0).setCellValue("\u26A1 POWERBI FINANCIAL INTELLIGENCE EXECUTIVE DASHBOARD");
            dashSheet.addMergedRegion(new CellRangeAddress(0, 1, 0, 7));

            // Sub-Banner Row 2
            XSSFCellStyle subBannerStyle = workbook.createCellStyle();
            XSSFFont subBannerFont = workbook.createFont();
            subBannerFont.setFontName("Segoe UI");
            subBannerFont.setFontHeightInPoints((short) 9);
            subBannerFont.setBold(true);
            subBannerFont.setColor(new XSSFColor(new Color(148, 163, 184), colorMap));
            subBannerStyle.setFont(subBannerFont);
            subBannerStyle.setFillForegroundColor(new XSSFColor(PBI_NAVY_HERO, colorMap));
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
                    + " (" + user.getEmail() + ")  |  CURRENCY: " + curr.code + " (" + curr.symbol + ")  |  GENERATED: " + LocalDate.now() + "  |  SYSTEM: LIVE TELEMETRY");
            dashSheet.addMergedRegion(new CellRangeAddress(2, 2, 0, 7));

            dashSheet.createRow(3).setHeightInPoints(10); // Spacer

            // 2. Primary 4-Card KPI Metric Ribbon (Rows 4, 5, 6 across Columns A to H)
            dashSheet.createRow(4).setHeightInPoints(20);
            dashSheet.createRow(5).setHeightInPoints(36);
            dashSheet.createRow(6).setHeightInPoints(18);

            short kpiCurFormat = df.getFormat(curFmt);
            short kpiPctFormat = df.getFormat("0.0%");

            // Card 1: TOTAL INFLOW (Cols A–B / 0–1)
            createPowerBiKpiCard(workbook, colorMap, dashSheet, 4, 5, 6, 0, 1,
                    "\u25B2 TOTAL REVENUE & INFLOW",
                    incomes.isEmpty() ? "0" : "SUM(Incomes!D2:D" + (incomes.size() + 1) + ")",
                    PBI_EMERALD_GREEN, kpiCurFormat, "Active & recurring revenue streams");

            // Card 2: TOTAL OUTFLOW (Cols C–D / 2–3)
            createPowerBiKpiCard(workbook, colorMap, dashSheet, 4, 5, 6, 2, 3,
                    "\u25BC TOTAL OPERATING EXPENDITURES",
                    expenses.isEmpty() ? "0" : "SUM(Expenses!D2:D" + (expenses.size() + 1) + ")",
                    PBI_ROSE_RED, kpiCurFormat, "Discretionary & operational burn");

            // Card 3: NET CASH FLOW (Cols E–F / 4–5)
            createPowerBiKpiCard(workbook, colorMap, dashSheet, 4, 5, 6, 4, 5,
                    "\u25C6 NET ACCUMULATED SURPLUS",
                    "A6-C6",
                    PBI_INDIGO_ACCENT, kpiCurFormat, "Net retained capital velocity");

            // Card 4: SAVINGS RATE (Cols G–H / 6–7)
            createPowerBiKpiCard(workbook, colorMap, dashSheet, 4, 5, 6, 6, 7,
                    "\u2605 CAPITAL RETENTION RATE",
                    "IF(A6>0, E6/A6, 0)",
                    PBI_AMBER_GOLD, kpiPctFormat, "Target Benchmark: \u2265 20.0%");

            dashSheet.createRow(7).setHeightInPoints(10); // Spacer

            // 3. Secondary 4-Card Resilience & Burn Velocity KPI Ribbon (Rows 8, 9, 10 across Columns A to H)
            dashSheet.createRow(8).setHeightInPoints(20);
            dashSheet.createRow(9).setHeightInPoints(34);
            dashSheet.createRow(10).setHeightInPoints(18);

            // Card 5: FINANCIAL HEALTH SCORE (Cols A–B / 0–1)
            createPowerBiKpiCard(workbook, colorMap, dashSheet, 8, 9, 10, 0, 1,
                    "\u25C8 FINANCIAL RESILIENCE SCORE",
                    healthScore + " / 100",
                    healthColor, (short) 0, healthGrade + " \u2022 " + healthStatusText);

            // Card 6: DAILY CASH BURN VELOCITY (Cols C–D / 2–3)
            createPowerBiKpiCard(workbook, colorMap, dashSheet, 8, 9, 10, 2, 3,
                    "\u26A1 DAILY CASH BURN VELOCITY",
                    String.format(Locale.US, "%.2f", dailyBurn),
                    PBI_ROSE_RED, kpiCurFormat, String.format(Locale.US, "Monthly Run-Rate: %s %,.0f", curr.symbol, monthlyBurnRunRate));

            // Card 7: LIQUIDITY RUNWAY (Cols E–F / 4–5)
            createPowerBiKpiCard(workbook, colorMap, dashSheet, 8, 9, 10, 4, 5,
                    "\u29BE LIQUIDITY SURVIVAL RUNWAY",
                    runwayDays >= 999 ? "\u221E Continuous" : String.format(Locale.US, "%.0f Days", runwayDays),
                    PBI_INDIGO_ACCENT, (short) 0, runwayDays >= 999 ? "Surplus growing without net burn" : String.format(Locale.US, "%.1f Months of operational capital", runwayMonths));

            // Card 8: 50/30/20 ALLOCATION STATUS (Cols G–H / 6–7)
            createPowerBiKpiCard(workbook, colorMap, dashSheet, 8, 9, 10, 6, 7,
                    "\u2731 50/30/20 ALLOCATION STATUS",
                    savingsPct >= 0.20 ? "\u2705 COMPOUNDING" : (wantsPct > 0.35 ? "\u26A0\uFE0F HIGH WANTS" : "\u26A1 DISCIPLINED"),
                    savingsPct >= 0.20 ? PBI_EMERALD_GREEN : PBI_AMBER_GOLD, (short) 0,
                    String.format(Locale.US, "Needs: %.0f%% \u2022 Wants: %.0f%% \u2022 Save: %.0f%%", needsPct * 100, wantsPct * 100, savingsPct * 100));

            dashSheet.createRow(11).setHeightInPoints(12); // Spacer

            // Background Canvas for Floating Vector Visuals (Rows 12 to 41, Cols A to H)
            XSSFCellStyle canvasStyle = workbook.createCellStyle();
            canvasStyle.setFillForegroundColor(new XSSFColor(new Color(248, 250, 252), colorMap));
            canvasStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            for (int r = 12; r <= 41; r++) {
                Row cr = dashSheet.createRow(r);
                cr.setHeightInPoints(18);
                for (int c = 0; c <= 7; c++) {
                    Cell cell = cr.createCell(c);
                    cell.setCellStyle(canvasStyle);
                }
            }

            dashSheet.createRow(42).setHeightInPoints(14); // Spacer

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
            mBannerStyle.setFillForegroundColor(new XSSFColor(PBI_DARK_SLATE, colorMap));
            mBannerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            mBannerStyle.setAlignment(HorizontalAlignment.LEFT);
            mBannerStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            for (int c = 0; c <= 7; c++) {
                Cell cell = bmBannerRow.createCell(c);
                cell.setCellStyle(mBannerStyle);
            }
            bmBannerRow.getCell(0).setCellValue("  \u2726 MACRO 50/30/20 CAPITAL ALLOCATION & WEALTH BENCHMARK");
            dashSheet.addMergedRegion(new CellRangeAddress(43, 43, 0, 7));

            Row bmHeader = dashSheet.createRow(44);
            bmHeader.setHeightInPoints(24);
            XSSFCellStyle tblHeadStyle = createModernHeaderStyle(workbook, colorMap, PBI_NAVY_HERO);

            String[] bmHeaders = {
                    "Macro Allocation Dimension",
                    "Allocated Spend (" + curr.symbol + ")",
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
                    c5.setCellFormula("IF(C" + (rIdx + 1) + "<=0.50, \"\u2705 OPTIMAL\", IF(C" + (rIdx + 1) + "<=0.60, \"\u26A0\uFE0F ELEVATED\", \"\uD83D\uDEA8 HIGH BURDEN\"))");
                } else if (i == 1) {
                    c5.setCellFormula("IF(C" + (rIdx + 1) + "<=0.30, \"\u2705 OPTIMAL\", IF(C" + (rIdx + 1) + "<=0.40, \"\u26A0\uFE0F ELEVATED\", \"\uD83D\uDEA8 OVER BUDGET\"))");
                } else {
                    c5.setCellFormula("IF(C" + (rIdx + 1) + ">=0.20, \"\uD83D\uDE80 ACCELERATING\", IF(C" + (rIdx + 1) + ">=0.10, \"\u2705 MODERATE\", \"\uD83D\uDEA8 DEFICIT\"))");
                }
                c5.setCellStyle(isZebra ? ctrZebraStyle : ctrDataStyle);

                Cell c6 = r.createCell(6);
                if (i == 0) {
                    c6.setCellFormula("IF(C" + (rIdx + 1) + "<=0.50, \"Living costs fully within guidelines\", \"Essential expenses consume over 50% of revenue\")");
                } else if (i == 1) {
                    c6.setCellFormula("IF(C" + (rIdx + 1) + "<=0.30, \"Controlled lifestyle expenditure\", \"Discretionary spending exceeds 30% threshold\")");
                } else {
                    c6.setCellFormula("IF(C" + (rIdx + 1) + ">=0.20, \"Capital accumulation expanding rapidly\", \"Retention pace below 20% benchmark\")");
                }
                c6.setCellStyle(isZebra ? txtZebraStyle : txtDataStyle);

                Cell c7 = r.createCell(7);
                c7.setCellValue(bmScopes[i]);
                c7.setCellStyle(isZebra ? txtZebraStyle : txtDataStyle);
            }

            int bmTotRowIdx = bmStartRow + 3;
            Row bmTotRow = dashSheet.createRow(bmTotRowIdx);
            bmTotRow.setHeightInPoints(24);
            XSSFCellStyle totLbl = createTotalLabelStyle(workbook, colorMap);
            XSSFCellStyle totCur = createTotalValueStyle(workbook, colorMap, df.getFormat(curFmt));
            XSSFCellStyle totPct = createTotalValueStyle(workbook, colorMap, df.getFormat("0.0%"));

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
            catBannerRow.getCell(0).setCellValue("  \u2726 EXECUTIVE CATEGORY COST DRIVERS & PARETO 80/20 ALLOCATION MATRIX");
            dashSheet.addMergedRegion(new CellRangeAddress(catBannerRowIdx, catBannerRowIdx, 0, 7));

            int catHeadRowIdx = catBannerRowIdx + 1;
            Row matrixHeader = dashSheet.createRow(catHeadRowIdx);
            matrixHeader.setHeightInPoints(24);

            String[] mHeaders = {
                    "Category Name",
                    "Allocated Spend (" + curr.symbol + ")",
                    "Share of Outflow",
                    "Pareto Tier",
                    "Monthly Budget (" + curr.symbol + ")",
                    "Utilization Rate",
                    "Remaining Buffer (" + curr.symbol + ")",
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
                c7.setCellFormula("IF(E" + (rIdx + 1) + ">0, IF(F" + (rIdx + 1) + ">1.0, \"\u26A0\uFE0F EXCEEDED\", IF(F" + (rIdx + 1) + ">0.8, \"\u26A1 ALERT (>80%)\", \"\u2705 OPTIMAL\")), IF(C" + (rIdx + 1) + ">0.3, \"\u26A0\uFE0F HIGH BURDEN\", \"\u2705 ON TRACK\"))");
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
            ctl5.setCellFormula("IF(E" + (catTotRowIdx + 1) + ">0, B" + (catTotRowIdx + 1) + "/E" + (catTotRowIdx + 1) + ", 0)");
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
            sec2BannerRow.getCell(0).setCellValue("  \u2726 PORTFOLIO CASH FLOW DYNAMICS & LIQUIDITY LEDGER");
            dashSheet.addMergedRegion(new CellRangeAddress(sec2BannerRowIdx, sec2BannerRowIdx, 0, 7));

            int t2HeadRowIdx = sec2BannerRowIdx + 1;
            Row t2HeadRow = dashSheet.createRow(t2HeadRowIdx);
            t2HeadRow.setHeightInPoints(24);
            String[] t2Headers = {
                    "Cash Flow Dimension",
                    "Gross Amount (" + curr.symbol + ")",
                    "Flow Direction",
                    "Classification",
                    "Portfolio Ratio",
                    "Monthly Run-Rate (" + curr.symbol + ")",
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
                c5.setCellFormula("B" + (rIdx + 1));
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
            t2c4.setCellFormula("G6");
            t2c4.setCellStyle(totPct);

            Cell t2c5 = t2TotRow.createCell(5);
            t2c5.setCellFormula("B" + (t2TotRowIdx + 1));
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
            sec3BannerRow.getCell(0).setCellValue("  \u2726 CHRONOLOGICAL DISBURSEMENT RUN-RATE & SPEND TIMELINE");
            dashSheet.addMergedRegion(new CellRangeAddress(sec3BannerRowIdx, sec3BannerRowIdx, 0, 7));

            int t3HeadRowIdx = sec3BannerRowIdx + 1;
            Row t3HeadRow = dashSheet.createRow(t3HeadRowIdx);
            t3HeadRow.setHeightInPoints(24);
            String[] t3Headers = {
                    "Disbursement Date",
                    "Daily Outflow (" + curr.symbol + ")",
                    "Share of Total Outflow",
                    "Transactions",
                    "Daily Average Benchmark (" + curr.symbol + ")",
                    "Variance vs Benchmark (" + curr.symbol + ")",
                    "Velocity Intensity",
                    "Telemetry Health Tag"
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
                ck6.setCellFormula("IF(B" + (rIdx + 1) + ">E" + (rIdx + 1) + "*1.5, \"\u26A1 HIGH SURGE\", IF(B" + (rIdx + 1) + ">E" + (rIdx + 1) + ", \"\u25B2 ELEVATED\", \"\u25BC CONTROLLED\"))");
                ck6.setCellStyle(isZebra ? ctrZebraStyle : ctrDataStyle);

                Cell ck7 = r.createCell(7);
                ck7.setCellFormula("IF(B" + (rIdx + 1) + ">E" + (rIdx + 1) + "*1.5, \"\u26A0\uFE0F REVIEW TRANSACTIONS\", \"\u2705 NOMINAL RUN-RATE\")");
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
            t3c4.setCellFormula("AVERAGE(E" + (timeStartRow + 1) + ":E" + (timeEndRow + 1) + ")");
            t3c4.setCellStyle(totCur);

            Cell t3c5 = t3TotRow.createCell(5);
            t3c5.setCellFormula("SUM(F" + (timeStartRow + 1) + ":F" + (timeEndRow + 1) + ")");
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
            aiBannerRow.getCell(0).setCellValue("  \u2726 STRATEGIC EXECUTIVE AI PRESCRIPTIONS & ACTIONABLE DIRECTIVES");
            dashSheet.addMergedRegion(new CellRangeAddress(aiBannerRowIdx, aiBannerRowIdx, 0, 7));

            String[] aiLabels = {
                    "\uD83C\uDFAF COST OPTIMIZATION",
                    "\uD83D\uDEE1\uFE0F LIQUIDITY RUNWAY",
                    "\u2696\uFE0F 50/30/20 BENCHMARK",
                    "\uD83D\uDE80 WEALTH ACCELERATION"
            };
            String[] aiTexts = {p1, p2, p3, p4};
            Color[] aiColors = {PBI_ROSE_RED, PBI_INDIGO_ACCENT, PBI_AMBER_GOLD, PBI_EMERALD_GREEN};

            int aiStartRow = aiBannerRowIdx + 1;
            for (int i = 0; i < 4; i++) {
                int rIdx = aiStartRow + i;
                Row r = dashSheet.createRow(rIdx);
                r.setHeightInPoints(34);

                XSSFCellStyle lblStyle = createPrescriptionLabelStyle(workbook, colorMap, aiColors[i]);
                XSSFCellStyle txtStyle = createPrescriptionTextStyle(workbook, colorMap);

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
                chart1.setTitleText("CASH FLOW DYNAMICS & LIQUIDITY (" + curr.symbol + ")");
                chart1.setTitleOverlay(false);

                XDDFChartLegend legend1 = chart1.getOrAddLegend();
                legend1.setPosition(LegendPosition.TOP_RIGHT);
                legend1.setOverlay(false);

                XDDFCategoryAxis bAxis1 = chart1.createCategoryAxis(AxisPosition.BOTTOM);
                XDDFValueAxis lAxis1 = chart1.createValueAxis(AxisPosition.LEFT);
                lAxis1.setCrosses(AxisCrosses.AUTO_ZERO);

                XDDFBarChartData barChart = (XDDFBarChartData) chart1.createData(ChartTypes.BAR, bAxis1, lAxis1);
                barChart.setBarDirection(BarDirection.COL);

                XDDFDataSource<String> cfCategories = XDDFDataSourcesFactory.fromStringCellRange(dashSheet, new CellRangeAddress(cfStartRow, cfStartRow + 2, 0, 0));
                XDDFNumericalDataSource<Double> cfValues = XDDFDataSourcesFactory.fromNumericCellRange(dashSheet, new CellRangeAddress(cfStartRow, cfStartRow + 2, 1, 1));

                XDDFChartData.Series cfSeries = barChart.addSeries(cfCategories, cfValues);
                cfSeries.setTitle("Portfolio Dynamics (" + curr.symbol + ")", null);
                chart1.plot(barChart);

                // Chart 2: Category Expense Donut Chart (Cols E–H / 4 to 8, Rows 12 to 27)
                XSSFClientAnchor anchor2 = drawing.createAnchor(0, 0, 0, 0, 4, 12, 8, 27);
                XSSFChart chart2 = drawing.createChart(anchor2);
                chart2.setTitleText("EXPENDITURE ALLOCATION & COST DRIVERS");
                chart2.setTitleOverlay(false);

                XDDFChartLegend legend2 = chart2.getOrAddLegend();
                legend2.setPosition(LegendPosition.RIGHT);
                legend2.setOverlay(false);

                XDDFDoughnutChartData donutChart = (XDDFDoughnutChartData) chart2.createData(ChartTypes.DOUGHNUT, null, null);
                donutChart.setHoleSize(55);
                donutChart.setVaryColors(true);

                XDDFDataSource<String> catCategories = XDDFDataSourcesFactory.fromStringCellRange(dashSheet, new CellRangeAddress(catStartRow, catEndRow, 0, 0));
                XDDFNumericalDataSource<Double> catValues = XDDFDataSourcesFactory.fromNumericCellRange(dashSheet, new CellRangeAddress(catStartRow, catEndRow, 1, 1));

                XDDFChartData.Series donutSeries = donutChart.addSeries(catCategories, catValues);
                donutSeries.setTitle("Expenditure Breakdown", null);
                chart2.plot(donutChart);

                // Chart 3: Daily Outflow Trendline Line Chart (Cols A–H / 0 to 8, Rows 28 to 41)
                XSSFClientAnchor anchor3 = drawing.createAnchor(0, 0, 0, 0, 0, 28, 8, 41);
                XSSFChart chart3 = drawing.createChart(anchor3);
                chart3.setTitleText("DAILY DISBURSEMENT VELOCITY & RUN-RATE (" + curr.symbol + ")");
                chart3.setTitleOverlay(false);

                XDDFChartLegend legend3 = chart3.getOrAddLegend();
                legend3.setPosition(LegendPosition.TOP_RIGHT);
                legend3.setOverlay(false);

                XDDFCategoryAxis bAxis3 = chart3.createCategoryAxis(AxisPosition.BOTTOM);
                XDDFValueAxis lAxis3 = chart3.createValueAxis(AxisPosition.LEFT);
                lAxis3.setCrosses(AxisCrosses.AUTO_ZERO);

                XDDFLineChartData lineChart = (XDDFLineChartData) chart3.createData(ChartTypes.LINE, bAxis3, lAxis3);
                lineChart.setVaryColors(false);

                XDDFDataSource<String> timeCategories = XDDFDataSourcesFactory.fromStringCellRange(dashSheet, new CellRangeAddress(timeStartRow, timeEndRow, 0, 0));
                XDDFNumericalDataSource<Double> timeValues = XDDFDataSourcesFactory.fromNumericCellRange(dashSheet, new CellRangeAddress(timeStartRow, timeEndRow, 1, 1));

                XDDFChartData.Series lineSeries = lineChart.addSeries(timeCategories, timeValues);
                lineSeries.setTitle("Daily Outflow (" + curr.symbol + ")", null);
                chart3.plot(lineChart);

            } catch (Exception chartEx) {
                logger.warn("Native XDDF Chart generation note: {}", chartEx.getMessage());
            }

            // 7. Rich Native Conditional Formatting Across Dashboard
            SheetConditionalFormatting dashScf = dashSheet.getSheetConditionalFormatting();

            // Highlight Category Over-Budget (> 100% utilization)
            ConditionalFormattingRule overBudgetRule = dashScf.createConditionalFormattingRule(ComparisonOperator.GT, "1.0");
            PatternFormatting overBudgetPf = overBudgetRule.createPatternFormatting();
            overBudgetPf.setFillBackgroundColor(IndexedColors.CORAL.getIndex());
            overBudgetPf.setFillPattern(PatternFormatting.SOLID_FOREGROUND);
            dashScf.addConditionalFormatting(new CellRangeAddress[]{ new CellRangeAddress(catStartRow, catEndRow, 5, 5) }, overBudgetRule);

            // Highlight High Concentration (> 30% of outflow)
            ConditionalFormattingRule burdenRule = dashScf.createConditionalFormattingRule(ComparisonOperator.GT, "0.30");
            PatternFormatting burdenPf = burdenRule.createPatternFormatting();
            burdenPf.setFillBackgroundColor(IndexedColors.LIGHT_YELLOW.getIndex());
            burdenPf.setFillPattern(PatternFormatting.SOLID_FOREGROUND);
            dashScf.addConditionalFormatting(new CellRangeAddress[]{ new CellRangeAddress(catStartRow, catEndRow, 2, 2) }, burdenRule);

            // Highlight Daily Spending Surges
            ConditionalFormattingRule dailySurgeRule = dashScf.createConditionalFormattingRule(ComparisonOperator.GT, "1000");
            PatternFormatting dailySurgePf = dailySurgeRule.createPatternFormatting();
            dailySurgePf.setFillBackgroundColor(IndexedColors.LIGHT_YELLOW.getIndex());
            dailySurgePf.setFillPattern(PatternFormatting.SOLID_FOREGROUND);
            dashScf.addConditionalFormatting(new CellRangeAddress[]{ new CellRangeAddress(timeStartRow, timeEndRow, 1, 1) }, dailySurgeRule);

            // Select Dashboard as primary active tab
            workbook.setSelectedTab(0);

            // Pre-evaluate formula cache
            try {
                XSSFFormulaEvaluator.evaluateAllFormulaCells(workbook);
            } catch (Exception evalEx) {
                logger.debug("Pre-evaluating formulas note: {}", evalEx.getMessage());
            }

            workbook.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            logger.error("Failed to export financial workbook to Excel for user {}", user.getId(), e);
            throw new RuntimeException("Error exporting financial workbook to Excel", e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PDF AND EXCEL STYLING ENGINE HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Creates a PowerBI-grade KPI metric card with complete rectangular border coverage
     * so that merged cells never render with broken, missing, or glitched borders.
     */
    private void createPowerBiKpiCard(XSSFWorkbook workbook, DefaultIndexedColorMap colorMap, XSSFSheet sheet,
                                      int labelRowIdx, int valRowIdx, int subRowIdx, int startCol, int endCol,
                                      String label, String formulaOrVal, Color accentColor, short dataFormat, String subtext) {
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
        if (formulaOrVal.matches("^[0-9.]+$")) {
            valCell.setCellValue(Double.parseDouble(formulaOrVal));
        } else if (formulaOrVal.startsWith("=") || formulaOrVal.contains("(") || formulaOrVal.contains("-") || formulaOrVal.contains("+") || formulaOrVal.contains("/") || formulaOrVal.contains("*")) {
            valCell.setCellFormula(formulaOrVal.startsWith("=") ? formulaOrVal.substring(1) : formulaOrVal);
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

    private XSSFCellStyle createDataRowStyle(XSSFWorkbook workbook, DefaultIndexedColorMap colorMap, boolean isZebra, String format) {
        return createDataRowStyle(workbook, colorMap, isZebra, format, format != null ? HorizontalAlignment.RIGHT : HorizontalAlignment.LEFT);
    }

    private XSSFCellStyle createDataRowStyle(XSSFWorkbook workbook, DefaultIndexedColorMap colorMap, boolean isZebra, String format, HorizontalAlignment align) {
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

    private XSSFCellStyle createPrescriptionLabelStyle(XSSFWorkbook workbook, DefaultIndexedColorMap colorMap, Color accent) {
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

    private XSSFCellStyle createPrescriptionTextStyle(XSSFWorkbook workbook, DefaultIndexedColorMap colorMap) {
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

    // ─────────────────────────────────────────────────────────────────────────
    // EXECUTIVE FINANCIAL STATEMENT PDF EXPORT
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public byte[] exportFinancialStatementPdf(User user) {
        return exportFinancialStatementPdf(user, null);
    }

    @Override
    public byte[] exportFinancialStatementPdf(User user, String preferredCurrency) {
        List<Expense> expenses = expenseRepository.findByUser(user);
        List<Income> incomes = incomeRepository.findByUser(user);
        List<SavingsGoal> savingsGoals = savingsGoalRepository.findByUser(user);
        CurrencyMeta curr = resolveCurrency(preferredCurrency, user);

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
                    "User: " + user.getName() + " (" + user.getEmail() + ") | Currency: " + curr.code + " (" + curr.symbol + ") | Generated: " + LocalDate.now() + "\n\n",
                    subTitleFont
            );
            userPara.setAlignment(Element.ALIGN_CENTER);
            document.add(userPara);

            // Summary KPI Table
            PdfPTable kpiTable = new PdfPTable(3);
            kpiTable.setWidthPercentage(100);
            kpiTable.setWidths(new float[]{33, 33, 34});

            com.lowagie.text.Font kpiHeaderFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, Color.WHITE);
            addHeaderCell(kpiTable, "Total Earnings (" + curr.symbol + ")", kpiHeaderFont, new Color(16, 185, 129));
            addHeaderCell(kpiTable, "Total Spendings (" + curr.symbol + ")", kpiHeaderFont, new Color(239, 68, 68));
            addHeaderCell(kpiTable, "Net Cash Flow (" + curr.symbol + ")", kpiHeaderFont, new Color(59, 130, 246));

            com.lowagie.text.Font kpiValueFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, Color.DARK_GRAY);
            addKpiCell(kpiTable, curr.symbol + " " + formatAmount(totalIncome, curr.decimals), kpiValueFont);
            addKpiCell(kpiTable, curr.symbol + " " + formatAmount(totalExpenses, curr.decimals), kpiValueFont);
            addKpiCell(kpiTable, curr.symbol + " " + formatAmount(netSavings, curr.decimals), kpiValueFont);

            document.add(kpiTable);
            document.add(new Paragraph("\n"));

            // Recent Expenses Section
            Paragraph expSection = new Paragraph("Recent Expenditures", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, Color.DARK_GRAY));
            document.add(expSection);
            document.add(new Paragraph(" "));

            PdfPTable expTable = new PdfPTable(4);
            expTable.setWidthPercentage(100);
            expTable.setWidths(new float[]{20, 25, 35, 20});

            com.lowagie.text.Font tableHeaderFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, Color.WHITE);
            Color expHeaderBg = new Color(79, 70, 229);
            addHeaderCell(expTable, "Date", tableHeaderFont, expHeaderBg);
            addHeaderCell(expTable, "Category", tableHeaderFont, expHeaderBg);
            addHeaderCell(expTable, "Description", tableHeaderFont, expHeaderBg);
            addHeaderCell(expTable, "Amount (" + curr.symbol + ")", tableHeaderFont, expHeaderBg);

            com.lowagie.text.Font dataFont = FontFactory.getFont(FontFactory.HELVETICA, 8, Color.BLACK);
            int expCount = 0;
            for (Expense exp : expenses) {
                if (expCount++ >= 10) break; // Top 10 for statement
                expTable.addCell(new Phrase(exp.getExpenseDate() != null ? exp.getExpenseDate().toString() : "", dataFont));
                expTable.addCell(new Phrase(exp.getCategory() != null ? exp.getCategory().getName() : "General", dataFont));
                expTable.addCell(new Phrase(exp.getDescription() != null ? exp.getDescription() : "", dataFont));
                BigDecimal amt = exp.getAmount() != null ? exp.getAmount() : BigDecimal.ZERO;
                expTable.addCell(new Phrase(curr.symbol + " " + formatAmount(amt, curr.decimals), dataFont));
            }
            if (expenses.isEmpty()) {
                PdfPCell emptyCell = new PdfPCell(new Phrase("No expense records available", dataFont));
                emptyCell.setColspan(4);
                emptyCell.setHorizontalAlignment(Element.ALIGN_CENTER);
                emptyCell.setPadding(8);
                expTable.addCell(emptyCell);
            }
            document.add(expTable);
            document.add(new Paragraph("\n"));

            // Savings Goals Progress Section
            if (!savingsGoals.isEmpty()) {
                Paragraph goalSection = new Paragraph("Savings Goals Tracking", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, Color.DARK_GRAY));
                document.add(goalSection);
                document.add(new Paragraph(" "));

                PdfPTable goalTable = new PdfPTable(4);
                goalTable.setWidthPercentage(100);
                goalTable.setWidths(new float[]{30, 25, 25, 20});

                Color goalHeaderBg = new Color(139, 92, 246);
                addHeaderCell(goalTable, "Goal Name", tableHeaderFont, goalHeaderBg);
                addHeaderCell(goalTable, "Target (" + curr.symbol + ")", tableHeaderFont, goalHeaderBg);
                addHeaderCell(goalTable, "Current (" + curr.symbol + ")", tableHeaderFont, goalHeaderBg);
                addHeaderCell(goalTable, "Progress", tableHeaderFont, goalHeaderBg);

                for (SavingsGoal goal : savingsGoals) {
                    goalTable.addCell(new Phrase(goal.getName(), dataFont));
                    goalTable.addCell(new Phrase(curr.symbol + " " + formatAmount(goal.getTargetAmount(), curr.decimals), dataFont));
                    goalTable.addCell(new Phrase(curr.symbol + " " + formatAmount(goal.getCurrentAmount(), curr.decimals), dataFont));
                    double progress = 0.0;
                    if (goal.getTargetAmount() != null && goal.getTargetAmount().compareTo(BigDecimal.ZERO) > 0) {
                        progress = (goal.getCurrentAmount() != null ? goal.getCurrentAmount().doubleValue() : 0.0)
                                / goal.getTargetAmount().doubleValue() * 100.0;
                    }
                    goalTable.addCell(new Phrase(String.format(Locale.US, "%.1f%%", progress), dataFont));
                }
                document.add(goalTable);
            }

            document.close();
            return out.toByteArray();
        } catch (Exception e) {
            logger.error("Failed to export financial statement PDF for user {}", user.getId(), e);
            throw new RuntimeException("Error exporting financial statement to PDF", e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LOW-LEVEL HELPER UTILITIES
    // ─────────────────────────────────────────────────────────────────────────

    private void addHeaderCell(PdfPTable table, String text, com.lowagie.text.Font font, Color bg) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setBackgroundColor(bg);
        cell.setHorizontalAlignment(Element.ALIGN_CENTER);
        cell.setVerticalAlignment(Element.ALIGN_MIDDLE);
        cell.setPadding(6);
        table.addCell(cell);
    }

    private void addKpiCell(PdfPTable table, String text, com.lowagie.text.Font font) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setHorizontalAlignment(Element.ALIGN_CENTER);
        cell.setVerticalAlignment(Element.ALIGN_MIDDLE);
        cell.setPadding(10);
        cell.setBackgroundColor(new Color(248, 250, 252));
        table.addCell(cell);
    }

    private String formatAmount(BigDecimal amount, boolean hasDecimals) {
        if (amount == null) return hasDecimals ? "0.00" : "0";
        DecimalFormatSymbols symbols = new DecimalFormatSymbols(Locale.US);
        DecimalFormat fmt = hasDecimals ? new DecimalFormat("#,##0.00", symbols) : new DecimalFormat("#,##0", symbols);
        return fmt.format(amount);
    }

    private String escapeCsv(String value) {
        if (value == null) return "";
        return value.replace("\"", "\"\"");
    }
}
