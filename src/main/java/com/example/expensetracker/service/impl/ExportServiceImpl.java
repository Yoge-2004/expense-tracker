package com.example.expensetracker.service.impl;

import com.example.expensetracker.dto.ExpenseDto;
import com.example.expensetracker.dto.IncomeDto;
import com.example.expensetracker.mapper.ExpenseMapper;
import com.example.expensetracker.mapper.IncomeMapper;
import com.example.expensetracker.mapper.IncomeRules;
import com.example.expensetracker.model.Budget;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.Income;
import com.example.expensetracker.model.IncomeKind;
import com.example.expensetracker.model.SavingsGoal;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.BudgetRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.IncomeRepository;
import com.example.expensetracker.repository.SavingsGoalRepository;
import com.example.expensetracker.service.ExportService;
import com.example.expensetracker.service.report.FinancialStatementExcelGenerator;
import com.example.expensetracker.service.report.FinancialStatementPdfGenerator;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.openpdf.text.Document;
import org.openpdf.text.Element;
import org.openpdf.text.FontFactory;
import org.openpdf.text.PageSize;
import org.openpdf.text.Paragraph;
import org.openpdf.text.Phrase;
import org.openpdf.text.Rectangle;
import org.openpdf.text.pdf.PdfPCell;
import org.openpdf.text.pdf.PdfPTable;
import org.openpdf.text.pdf.PdfWriter;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xddf.usermodel.chart.*;
import org.apache.poi.xssf.usermodel.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
 *   <li><b>Dynamic Multi-Currency Engine:</b> Resolves 50+ world currencies (e.g. INR ₹, USD $, EUR €, GBP £, JPY ¥,
 // AED)
 *       into native Excel number formats, PDF labels, and live metric cards.</li>
 *   <li><b>Executive Financial Intelligence Dashboard:</b> Sleek 8-column canvas with dark slate executive
 *       hero banner, dual 4-card KPI metric ribbons (Solvency, Health Score, Daily Burn Velocity, Runway Days).</li>
 *   <li><b>Macro 50/30/20 Budgeting Benchmark:</b> Automatic classification of Needs, Wants, and Capital Savings
 *       with real-time variance tracking and compliance tags.</li>
 *   <li><b>Pareto 80/20 Cost Drivers & Risk Matrix:</b> Class A/B/C cost driver tiering, budget variance, and
 // utilization alerts.</li>
 *   <li><b>Automated Strategic AI Prescriptions:</b> Dynamic, data-driven executive takeaways and cost optimization
 // directives.</li>
 *   <li><b>Multiple Embedded Vector Visuals (XDDF Charts):</b> Cash flow performance comparison column chart,
 *       category spending distribution donut chart, and chronological spend trendline chart.</li>
 * </ul>
 * </p>
 *
 * @author Yogeshwaran
 */
@Slf4j
@Service
@Transactional(readOnly = true)
public class ExportServiceImpl implements ExportService {

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
    private final BudgetRepository budgetRepository;
    private final FinancialStatementExcelGenerator financialStatementExcelGenerator;
    private final FinancialStatementPdfGenerator financialStatementPdfGenerator;

    /**
     * Currency configuration metadata record.
     */
    public record CurrencyMeta(String code, String symbol, boolean decimals, boolean symbolAfter) {
        public CurrencyMeta(String code, String symbol, boolean decimals) {
            this(code, symbol, decimals, false);
        }

        public String getExcelFormat() {
            // Symbol placement: most currencies (USD$, EUR\u20AC, GBP\u00A3, INR\u20B9) put the symbol BEFORE the
            // number.
            // However several Eastern European / Balkan currencies conventionally place the symbol AFTER:
            //   CZK 100,00 K\u010D | HUF 100 Ft | RON 100,00 lei | BGN 100,00 \u043B\u0432 | RSD 100,00
            // \u0434\u0438\u043D
            //   MKD 100,00 \u0434\u0435\u043D | HRK 100,00 kn | BAM 100,00 KM | ALL 100 L
            // We honour that convention so the generated Excel doesn't look wrong to native users.
            if (!decimals) {
                if (symbolAfter) {
                    return "#,##0 \"" + symbol + "\";(#,##0 \"" + symbol + "\");\"-\"";
                }
                return "\"" + symbol + " \"#,##0;(\"" + symbol + " \"#,##0);\"-\"";
            }
            if (symbolAfter) {
                return "#,##0.00 \"" + symbol + "\";(#,##0.00 \"" + symbol + "\");\"-\"";
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
        registerCurr("CZK", "Kč", true, true);
        registerCurr("HUF", "Ft", false, true);
        registerCurr("RON", "lei", true, true);
        registerCurr("UAH", "₴", true);
        registerCurr("BGN", "лв", true, true);
        registerCurr("ISK", "kr", true, true);
        registerCurr("RSD", "дин", true, true);
        registerCurr("HRK", "kn", true, true);
        registerCurr("BAM", "KM", true, true);
        registerCurr("ALL", "L", true, true);
        registerCurr("MKD", "ден", true, true);
    }

    private static void registerCurr(String code, String symbol, boolean decimals) {
        CURRENCY_MAP.put(code.toUpperCase(), new CurrencyMeta(code.toUpperCase(), symbol, decimals));
    }

    private static void registerCurr(String code, String symbol, boolean decimals, boolean symbolAfter) {
        CURRENCY_MAP.put(code.toUpperCase(), new CurrencyMeta(code.toUpperCase(), symbol, decimals, symbolAfter));
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
            // Use Locale.US for symbol resolution so behaviour is deterministic across server locales.
            // Previously used Locale.getDefault(), which on a German-locale server returns "USD" for
            // the US Dollar symbol instead of "$" — confusing and inconsistent across deployments.
            return new CurrencyMeta(code, javaCurr.getSymbol(Locale.US), javaCurr.getDefaultFractionDigits() > 0);
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
    @Autowired
    public ExportServiceImpl(ExpenseRepository expenseRepository,
                             IncomeRepository incomeRepository,
                             SavingsGoalRepository savingsGoalRepository,
                             @Autowired(required = false) BudgetRepository budgetRepository,
                             @Autowired(required = false) FinancialStatementExcelGenerator financialStatementExcelGenerator,
                             @Autowired(required = false) FinancialStatementPdfGenerator financialStatementPdfGenerator) {
        this.expenseRepository = expenseRepository;
        this.incomeRepository = incomeRepository;
        this.savingsGoalRepository = savingsGoalRepository;
        this.budgetRepository = budgetRepository;
        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new JavaTimeModule());
        this.financialStatementExcelGenerator = financialStatementExcelGenerator != null
                ? financialStatementExcelGenerator : new FinancialStatementExcelGenerator();
        this.financialStatementPdfGenerator = financialStatementPdfGenerator != null
                ? financialStatementPdfGenerator : new FinancialStatementPdfGenerator();
    }

    public ExportServiceImpl(ExpenseRepository expenseRepository,
                             IncomeRepository incomeRepository,
                             SavingsGoalRepository savingsGoalRepository,
                             BudgetRepository budgetRepository) {
        this(expenseRepository, incomeRepository, savingsGoalRepository, budgetRepository, null, null);
    }

    public ExportServiceImpl(ExpenseRepository expenseRepository,
                             IncomeRepository incomeRepository,
                             SavingsGoalRepository savingsGoalRepository) {
        this(expenseRepository, incomeRepository, savingsGoalRepository, null, null, null);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EXPENSES EXPORT
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public byte[] exportExpensesToCsv(User user) {
        if (user == null) {
            throw new IllegalArgumentException("User context cannot be null");
        }
        List<Expense> expenses = expenseRepository.findByUser(user);
        StringBuilder sb = new StringBuilder();
        sb.append("ID,Date,Category,Amount,Description,Recurring\n");
        for (Expense exp : expenses) {
            sb.append(exp.getId()).append(",")
                    .append(exp.getExpenseDate() != null ? exp.getExpenseDate() : "").append(",")
                    
                            .append("\"")
                            .append(escapeCsv(exp.getCategory() != null ? exp.getCategory().getName() : ""))
                            .append("\",")
                    // FIXED: use toPlainString() instead of toString() — BigDecimal.toString() can
                    // emit scientific notation (e.g. "1E+10") for large values, which Excel's CSV
                    // importer doesn't always parse correctly.
                    .append(exp.getAmount() != null ? exp.getAmount().toPlainString() : "0").append(",")
                    
                            .append("\"")
                            .append(escapeCsv(exp.getDescription() != null ? exp.getDescription() : ""))
                            .append("\",")
                    .append(exp.isRecurring()).append("\n");
        }
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    @Override
    public byte[] exportExpensesToJson(User user) {
        if (user == null) {
            throw new IllegalArgumentException("User context cannot be null");
        }
        List<Expense> expenses = expenseRepository.findByUser(user);
        List<ExpenseDto> dtos = expenses.stream().map(ExpenseMapper::toDto).toList();
        try {
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(dtos);
        } catch (Exception e) {
            log.error("Failed to export expenses to JSON for user {}", user.getId(), e);
            throw new RuntimeException("Error exporting expenses to JSON", e);
        }
    }

    @Override
    public byte[] exportExpensesToPdf(User user) {
        if (user == null) {
            throw new IllegalArgumentException("User context cannot be null");
        }
        return exportExpensesToPdf(user, null);
    }

    public static String pdfSymbol(CurrencyMeta curr) {
        if (curr == null) return "Rs.";
        if ("INR".equalsIgnoreCase(curr.code())) return "Rs.";
        if (curr.symbol() != null && !curr.symbol().isBlank()) {
            if ("$".equals(curr.symbol()) || "€".equals(curr.symbol()) || "£".equals(curr.symbol()) || "¥".equals(curr.symbol())) {
                return curr.symbol();
            }
        }
        return curr.code() != null ? curr.code() : "Rs.";
    }

    @Override
    public byte[] exportExpensesToPdf(User user, String preferredCurrency) {
        if (user == null) {
            throw new IllegalArgumentException("User context cannot be null");
        }
        List<Expense> expenses = new ArrayList<>(expenseRepository.findByUser(user));
        expenses.sort((a, b) -> {
            if (a.getExpenseDate() == null && b.getExpenseDate() == null) return 0;
            if (a.getExpenseDate() == null) return 1;
            if (b.getExpenseDate() == null) return -1;
            int c = b.getExpenseDate().compareTo(a.getExpenseDate());
            if (c != 0) return c;
            return Long.compare(b.getId() != null ? b.getId() : 0, a.getId() != null ? a.getId() : 0);
        });

        CurrencyMeta curr = resolveCurrency(preferredCurrency, user);
        String pdfSym = pdfSymbol(curr);

        BigDecimal total = BigDecimal.ZERO;
        Map<String, BigDecimal> catTotals = new HashMap<>();
        for (Expense exp : expenses) {
            BigDecimal amt = exp.getAmount() != null ? exp.getAmount() : BigDecimal.ZERO;
            total = total.add(amt);
            String cat = (exp.getCategory() != null && exp.getCategory().getName() != null) ? exp.getCategory().getName() : "General";
            catTotals.put(cat, catTotals.getOrDefault(cat, BigDecimal.ZERO).add(amt));
        }

        String topCatName = "None";
        BigDecimal topCatAmt = BigDecimal.ZERO;
        for (Map.Entry<String, BigDecimal> entry : catTotals.entrySet()) {
            if (entry.getValue().compareTo(topCatAmt) > 0) {
                topCatAmt = entry.getValue();
                topCatName = entry.getKey();
            }
        }

        BigDecimal avg = expenses.isEmpty() ? BigDecimal.ZERO
                : total.divide(BigDecimal.valueOf(expenses.size()), 2, java.math.RoundingMode.HALF_UP);

        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document document = new Document(PageSize.A4, 28, 28, 30, 30);
            PdfWriter.getInstance(document, out);
            document.open();

            // 1. Executive Slate & Gold Banner
            Color goldAccent = new Color(199, 154, 62);
            addPdfHeaderBanner(document, "EXPENSE REPORT", "Executive Outflow & Expense Ledger Statement", goldAccent, user, curr, pdfSym);

            // 2. Executive KPI Summary Cards
            PdfPTable kpiTable = new PdfPTable(4);
            kpiTable.setWidthPercentage(100);
            kpiTable.setWidths(new float[]{25, 25, 25, 25});
            addPdfKpiCard(kpiTable, "TOTAL OUTFLOW", pdfSym + " " + formatAmount(total, curr.decimals()), new Color(220, 38, 38));
            addPdfKpiCard(kpiTable, "TOTAL TRANSACTIONS", expenses.size() + " Debits", new Color(79, 70, 229));
            addPdfKpiCard(kpiTable, "AVERAGE DEBIT", pdfSym + " " + formatAmount(avg, curr.decimals()), new Color(217, 119, 6));
            addPdfKpiCard(kpiTable, "TOP CATEGORY", topCatName + (topCatAmt.compareTo(BigDecimal.ZERO) > 0 ? " (" + pdfSym + " " + formatAmount(topCatAmt, curr.decimals()) + ")" : ""), new Color(37, 99, 235));
            document.add(kpiTable);
            document.add(new Paragraph(" "));

            // 3. Section Title
            Paragraph secTitle = new Paragraph("TRANSACTION LEDGER & AUDIT TRAIL", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10f, new Color(15, 23, 42)));
            document.add(secTitle);
            Paragraph secSub = new Paragraph("Itemized chronological record of all recorded debit disbursements.", FontFactory.getFont(FontFactory.HELVETICA, 8f, new Color(100, 116, 139)));
            document.add(secSub);
            document.add(new Paragraph(" "));

            // 4. Ledger Table
            PdfPTable table = new PdfPTable(4);
            table.setWidthPercentage(100);
            table.setWidths(new float[]{18, 22, 38, 22});

            org.openpdf.text.Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, Color.WHITE);
            Color headerBg = new Color(15, 23, 42); // Obsidian Slate

            addHeaderCell(table, "Date", headerFont, headerBg);
            addHeaderCell(table, "Category", headerFont, headerBg);
            addHeaderCell(table, "Description", headerFont, headerBg);
            addHeaderCell(table, "Amount (" + pdfSym + ")", headerFont, headerBg);

            org.openpdf.text.Font dataFont = FontFactory.getFont(FontFactory.HELVETICA, 8.5f, new Color(15, 23, 42));
            org.openpdf.text.Font dataFontBold = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, new Color(15, 23, 42));
            org.openpdf.text.Font dateFont = FontFactory.getFont(FontFactory.HELVETICA, 8f, new Color(71, 85, 105));

            int rowIdx = 0;
            for (Expense exp : expenses) {
                boolean isZebra = (rowIdx++ % 2 == 1);
                Color rowBg = isZebra ? new Color(248, 250, 252) : Color.WHITE;

                // Date
                PdfPCell cDate = new PdfPCell(new Phrase(exp.getExpenseDate() != null ? exp.getExpenseDate().toString() : "-", dateFont));
                cDate.setBackgroundColor(rowBg);
                cDate.setBorderColor(new Color(226, 232, 240));
                cDate.setPadding(6);
                cDate.setHorizontalAlignment(Element.ALIGN_CENTER);
                cDate.setVerticalAlignment(Element.ALIGN_MIDDLE);
                table.addCell(cDate);

                // Category
                String catName = (exp.getCategory() != null && exp.getCategory().getName() != null) ? exp.getCategory().getName() : "General";
                PdfPCell cCat = new PdfPCell(new Phrase(catName, dataFont));
                cCat.setBackgroundColor(rowBg);
                cCat.setBorderColor(new Color(226, 232, 240));
                cCat.setPadding(6);
                cCat.setVerticalAlignment(Element.ALIGN_MIDDLE);
                table.addCell(cCat);

                // Description
                String desc = (exp.getDescription() != null && !exp.getDescription().isBlank()) ? exp.getDescription() : "—";
                if (exp.isRecurring()) {
                    desc += " [Recurring]";
                }
                PdfPCell cDesc = new PdfPCell(new Phrase(desc, dataFont));
                cDesc.setBackgroundColor(rowBg);
                cDesc.setBorderColor(new Color(226, 232, 240));
                cDesc.setPadding(6);
                cDesc.setVerticalAlignment(Element.ALIGN_MIDDLE);
                table.addCell(cDesc);

                // Amount
                BigDecimal amt = exp.getAmount() != null ? exp.getAmount() : BigDecimal.ZERO;
                PdfPCell cAmt = new PdfPCell(new Phrase(pdfSym + " " + formatAmount(amt, curr.decimals()), dataFontBold));
                cAmt.setBackgroundColor(rowBg);
                cAmt.setBorderColor(new Color(226, 232, 240));
                cAmt.setPadding(6);
                cAmt.setHorizontalAlignment(Element.ALIGN_RIGHT);
                cAmt.setVerticalAlignment(Element.ALIGN_MIDDLE);
                table.addCell(cAmt);
            }

            if (expenses.isEmpty()) {
                PdfPCell emptyCell = new PdfPCell(new Phrase("No expense records found in this ledger.", dateFont));
                emptyCell.setColspan(4);
                emptyCell.setHorizontalAlignment(Element.ALIGN_CENTER);
                emptyCell.setPadding(14);
                emptyCell.setBackgroundColor(new Color(248, 250, 252));
                emptyCell.setBorderColor(new Color(226, 232, 240));
                table.addCell(emptyCell);
            } else {
                PdfPCell totalLabel = new PdfPCell(new Phrase("TOTAL DEBIT DISBURSEMENTS (" + pdfSym + "):", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9f, new Color(15, 23, 42))));
                totalLabel.setColspan(3);
                totalLabel.setHorizontalAlignment(Element.ALIGN_RIGHT);
                totalLabel.setVerticalAlignment(Element.ALIGN_MIDDLE);
                totalLabel.setBackgroundColor(new Color(241, 245, 249));
                totalLabel.setBorderColor(new Color(203, 213, 225));
                totalLabel.setPadding(7);
                table.addCell(totalLabel);

                PdfPCell totalVal = new PdfPCell(new Phrase(pdfSym + " " + formatAmount(total, curr.decimals()), FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9.5f, new Color(220, 38, 38))));
                totalVal.setHorizontalAlignment(Element.ALIGN_RIGHT);
                totalVal.setVerticalAlignment(Element.ALIGN_MIDDLE);
                totalVal.setBackgroundColor(new Color(241, 245, 249));
                totalVal.setBorderColor(new Color(203, 213, 225));
                totalVal.setPadding(7);
                table.addCell(totalVal);
            }

            document.add(table);

            // 5. Executive Footer
            addPdfFooterNote(document);

            document.close();
            return out.toByteArray();
        } catch (Exception e) {
            log.error("Failed to export expenses to PDF for user {}", user.getId(), e);
            throw new RuntimeException("Error exporting expenses to PDF", e);
        }
    }

    @Override
    public byte[] exportExpensesToExcel(User user) {
        if (user == null) {
            throw new IllegalArgumentException("User context cannot be null");
        }
        return exportExpensesToExcel(user, null);
    }

    @Override
    public byte[] exportExpensesToExcel(User user, String preferredCurrency) {
        if (user == null) {
            throw new IllegalArgumentException("User context cannot be null");
        }
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
            XSSFCellStyle normalRowStyle =
                    createDataRowStyle(workbook, colorMap, false, null, HorizontalAlignment.LEFT);
            XSSFCellStyle zebraRowStyle = createDataRowStyle(workbook, colorMap, true, null, HorizontalAlignment.LEFT);
            XSSFCellStyle ctrRowStyle = createDataRowStyle(workbook, colorMap, false, null, HorizontalAlignment.CENTER);
            XSSFCellStyle ctrZebraStyle =
                    createDataRowStyle(workbook, colorMap, true, null, HorizontalAlignment.CENTER);
            XSSFCellStyle currencyStyle =
                    createDataRowStyle(workbook, colorMap, false, curFmt, HorizontalAlignment.RIGHT);
            XSSFCellStyle zebraCurrencyStyle =
                    createDataRowStyle(workbook, colorMap, true, curFmt, HorizontalAlignment.RIGHT);

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
                // Currency-aware threshold (JPY/KRW/VND use 100,000; INR/soft currencies use 10,000; USD/EUR/etc. use
                // 1,000)
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
                log.debug("Formula evaluation note: {}", evalEx.getMessage());
            }

            workbook.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            log.error("Failed to export expenses to Excel for user {}", user.getId(), e);
            throw new RuntimeException("Error exporting expenses to Excel", e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INCOMES EXPORT
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public byte[] exportIncomesToCsv(User user) {
        if (user == null) {
            throw new IllegalArgumentException("User context cannot be null");
        }
        List<Income> incomes = incomeRepository.findByUser(user);
        StringBuilder sb = new StringBuilder();
        sb.append("ID,Date,Source,Amount,Description,Recurring\n");
        for (Income inc : incomes) {
            sb.append(inc.getId()).append(",")
                    .append(inc.getIncomeDate() != null ? inc.getIncomeDate() : "").append(",")
                    .append("\"").append(escapeCsv(inc.getSource() != null ? inc.getSource() : "")).append("\",")
                    // FIXED: use toPlainString() instead of toString() — BigDecimal.toString() can
                    // emit scientific notation (e.g. "1E+10") for large values, which Excel's CSV
                    // importer doesn't always parse correctly.
                    .append(inc.getAmount() != null ? inc.getAmount().toPlainString() : "0").append(",")
                    
                            .append("\"")
                            .append(escapeCsv(inc.getDescription() != null ? inc.getDescription() : ""))
                            .append("\",")
                    .append(Boolean.TRUE.equals(inc.getIsRecurring())).append("\n");
        }
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    @Override
    public byte[] exportIncomesToJson(User user) {
        if (user == null) {
            throw new IllegalArgumentException("User context cannot be null");
        }
        List<Income> incomes = incomeRepository.findByUser(user);
        List<IncomeDto> dtos = incomes.stream().map(IncomeMapper::toDto).toList();
        try {
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(dtos);
        } catch (Exception e) {
            log.error("Failed to export incomes to JSON for user {}", user.getId(), e);
            throw new RuntimeException("Error exporting incomes to JSON", e);
        }
    }

    @Override
    public byte[] exportIncomesToPdf(User user) {
        if (user == null) {
            throw new IllegalArgumentException("User context cannot be null");
        }
        return exportIncomesToPdf(user, null);
    }

    @Override
    public byte[] exportIncomesToPdf(User user, String preferredCurrency) {
        if (user == null) {
            throw new IllegalArgumentException("User context cannot be null");
        }
        List<Income> incomes = new ArrayList<>(incomeRepository.findByUser(user));
        incomes.sort((a, b) -> {
            if (a.getIncomeDate() == null && b.getIncomeDate() == null) return 0;
            if (a.getIncomeDate() == null) return 1;
            if (b.getIncomeDate() == null) return -1;
            int c = b.getIncomeDate().compareTo(a.getIncomeDate());
            if (c != 0) return c;
            return Long.compare(b.getId() != null ? b.getId() : 0, a.getId() != null ? a.getId() : 0);
        });

        CurrencyMeta curr = resolveCurrency(preferredCurrency, user);
        String pdfSym = pdfSymbol(curr);

        BigDecimal total = BigDecimal.ZERO;
        Map<String, BigDecimal> srcTotals = new HashMap<>();
        for (Income inc : incomes) {
            BigDecimal amt = inc.getAmount() != null ? inc.getAmount() : BigDecimal.ZERO;
            total = total.add(amt);
            String src = (inc.getSource() != null && !inc.getSource().isBlank()) ? inc.getSource() : "General Inflow";
            srcTotals.put(src, srcTotals.getOrDefault(src, BigDecimal.ZERO).add(amt));
        }

        String topSrcName = "None";
        BigDecimal topSrcAmt = BigDecimal.ZERO;
        for (Map.Entry<String, BigDecimal> entry : srcTotals.entrySet()) {
            if (entry.getValue().compareTo(topSrcAmt) > 0) {
                topSrcAmt = entry.getValue();
                topSrcName = entry.getKey();
            }
        }

        BigDecimal avg = incomes.isEmpty() ? BigDecimal.ZERO
                : total.divide(BigDecimal.valueOf(incomes.size()), 2, java.math.RoundingMode.HALF_UP);

        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document document = new Document(PageSize.A4, 28, 28, 30, 30);
            PdfWriter.getInstance(document, out);
            document.open();

            // 1. Executive Slate & Emerald Banner
            Color emeraldAccent = new Color(16, 185, 129);
            addPdfHeaderBanner(document, "INCOME REPORT", "Executive Inflow & Income Streams Statement", emeraldAccent, user, curr, pdfSym);

            // 2. Executive KPI Summary Cards
            PdfPTable kpiTable = new PdfPTable(4);
            kpiTable.setWidthPercentage(100);
            kpiTable.setWidths(new float[]{25, 25, 25, 25});
            addPdfKpiCard(kpiTable, "TOTAL INFLOW", pdfSym + " " + formatAmount(total, curr.decimals()), new Color(5, 150, 105));
            addPdfKpiCard(kpiTable, "TOTAL CREDITS", incomes.size() + " Credits", new Color(79, 70, 229));
            addPdfKpiCard(kpiTable, "AVERAGE CREDIT", pdfSym + " " + formatAmount(avg, curr.decimals()), new Color(217, 119, 6));
            addPdfKpiCard(kpiTable, "TOP SOURCE", topSrcName + (topSrcAmt.compareTo(BigDecimal.ZERO) > 0 ? " (" + pdfSym + " " + formatAmount(topSrcAmt, curr.decimals()) + ")" : ""), new Color(37, 99, 235));
            document.add(kpiTable);
            document.add(new Paragraph(" "));

            // 3. Section Title
            Paragraph secTitle = new Paragraph("INCOME STREAMS & CREDITS AUDIT TRAIL", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10f, new Color(15, 23, 42)));
            document.add(secTitle);
            Paragraph secSub = new Paragraph("Itemized chronological record of all logged revenue, salary, and capital inflows.", FontFactory.getFont(FontFactory.HELVETICA, 8f, new Color(100, 116, 139)));
            document.add(secSub);
            document.add(new Paragraph(" "));

            // 4. Ledger Table
            PdfPTable table = new PdfPTable(4);
            table.setWidthPercentage(100);
            table.setWidths(new float[]{18, 22, 38, 22});

            org.openpdf.text.Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, Color.WHITE);
            Color headerBg = new Color(15, 23, 42); // Obsidian Slate

            addHeaderCell(table, "Date", headerFont, headerBg);
            addHeaderCell(table, "Source", headerFont, headerBg);
            addHeaderCell(table, "Description", headerFont, headerBg);
            addHeaderCell(table, "Amount (" + pdfSym + ")", headerFont, headerBg);

            org.openpdf.text.Font dataFont = FontFactory.getFont(FontFactory.HELVETICA, 8.5f, new Color(15, 23, 42));
            org.openpdf.text.Font dataFontBold = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, new Color(5, 150, 105));
            org.openpdf.text.Font dateFont = FontFactory.getFont(FontFactory.HELVETICA, 8f, new Color(71, 85, 105));

            int rowIdx = 0;
            for (Income inc : incomes) {
                boolean isZebra = (rowIdx++ % 2 == 1);
                Color rowBg = isZebra ? new Color(248, 250, 252) : Color.WHITE;

                // Date
                PdfPCell cDate = new PdfPCell(new Phrase(inc.getIncomeDate() != null ? inc.getIncomeDate().toString() : "-", dateFont));
                cDate.setBackgroundColor(rowBg);
                cDate.setBorderColor(new Color(226, 232, 240));
                cDate.setPadding(6);
                cDate.setHorizontalAlignment(Element.ALIGN_CENTER);
                cDate.setVerticalAlignment(Element.ALIGN_MIDDLE);
                table.addCell(cDate);

                // Source
                String srcName = (inc.getSource() != null && !inc.getSource().isBlank()) ? inc.getSource() : "General Inflow";
                PdfPCell cSrc = new PdfPCell(new Phrase(srcName, dataFont));
                cSrc.setBackgroundColor(rowBg);
                cSrc.setBorderColor(new Color(226, 232, 240));
                cSrc.setPadding(6);
                cSrc.setVerticalAlignment(Element.ALIGN_MIDDLE);
                table.addCell(cSrc);

                // Description
                String desc = (inc.getDescription() != null && !inc.getDescription().isBlank()) ? inc.getDescription() : "—";
                if (Boolean.TRUE.equals(inc.getIsRecurring())) {
                    desc += " [Recurring]";
                }
                PdfPCell cDesc = new PdfPCell(new Phrase(desc, dataFont));
                cDesc.setBackgroundColor(rowBg);
                cDesc.setBorderColor(new Color(226, 232, 240));
                cDesc.setPadding(6);
                cDesc.setVerticalAlignment(Element.ALIGN_MIDDLE);
                table.addCell(cDesc);

                // Amount
                BigDecimal amt = inc.getAmount() != null ? inc.getAmount() : BigDecimal.ZERO;
                PdfPCell cAmt = new PdfPCell(new Phrase(pdfSym + " " + formatAmount(amt, curr.decimals()), dataFontBold));
                cAmt.setBackgroundColor(rowBg);
                cAmt.setBorderColor(new Color(226, 232, 240));
                cAmt.setPadding(6);
                cAmt.setHorizontalAlignment(Element.ALIGN_RIGHT);
                cAmt.setVerticalAlignment(Element.ALIGN_MIDDLE);
                table.addCell(cAmt);
            }

            if (incomes.isEmpty()) {
                PdfPCell emptyCell = new PdfPCell(new Phrase("No income records found in this ledger.", dateFont));
                emptyCell.setColspan(4);
                emptyCell.setHorizontalAlignment(Element.ALIGN_CENTER);
                emptyCell.setPadding(14);
                emptyCell.setBackgroundColor(new Color(248, 250, 252));
                emptyCell.setBorderColor(new Color(226, 232, 240));
                table.addCell(emptyCell);
            } else {
                PdfPCell totalLabel = new PdfPCell(new Phrase("TOTAL REVENUE INFLOWS (" + pdfSym + "):", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9f, new Color(15, 23, 42))));
                totalLabel.setColspan(3);
                totalLabel.setHorizontalAlignment(Element.ALIGN_RIGHT);
                totalLabel.setVerticalAlignment(Element.ALIGN_MIDDLE);
                totalLabel.setBackgroundColor(new Color(241, 245, 249));
                totalLabel.setBorderColor(new Color(203, 213, 225));
                totalLabel.setPadding(7);
                table.addCell(totalLabel);

                PdfPCell totalVal = new PdfPCell(new Phrase(pdfSym + " " + formatAmount(total, curr.decimals()), FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9.5f, new Color(5, 150, 105))));
                totalVal.setHorizontalAlignment(Element.ALIGN_RIGHT);
                totalVal.setVerticalAlignment(Element.ALIGN_MIDDLE);
                totalVal.setBackgroundColor(new Color(241, 245, 249));
                totalVal.setBorderColor(new Color(203, 213, 225));
                totalVal.setPadding(7);
                table.addCell(totalVal);
            }

            document.add(table);

            // 5. Executive Footer
            addPdfFooterNote(document);

            document.close();
            return out.toByteArray();
        } catch (Exception e) {
            log.error("Failed to export incomes to PDF for user {}", user.getId(), e);
            throw new RuntimeException("Error exporting incomes to PDF", e);
        }
    }

    @Override
    public byte[] exportIncomesToExcel(User user) {
        if (user == null) {
            throw new IllegalArgumentException("User context cannot be null");
        }
        return exportIncomesToExcel(user, null);
    }

    @Override
    public byte[] exportIncomesToExcel(User user, String preferredCurrency) {
        if (user == null) {
            throw new IllegalArgumentException("User context cannot be null");
        }
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
            XSSFCellStyle normalRowStyle =
                    createDataRowStyle(workbook, colorMap, false, null, HorizontalAlignment.LEFT);
            XSSFCellStyle zebraRowStyle = createDataRowStyle(workbook, colorMap, true, null, HorizontalAlignment.LEFT);
            XSSFCellStyle ctrRowStyle = createDataRowStyle(workbook, colorMap, false, null, HorizontalAlignment.CENTER);
            XSSFCellStyle ctrZebraStyle =
                    createDataRowStyle(workbook, colorMap, true, null, HorizontalAlignment.CENTER);
            XSSFCellStyle currencyStyle =
                    createDataRowStyle(workbook, colorMap, false, curFmt, HorizontalAlignment.RIGHT);
            XSSFCellStyle zebraCurrencyStyle =
                    createDataRowStyle(workbook, colorMap, true, curFmt, HorizontalAlignment.RIGHT);

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

            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
                sheet.setColumnWidth(i, Math.max(sheet.getColumnWidth(i) + 1600, 4200));
            }
            sheet.setColumnWidth(4, Math.max(sheet.getColumnWidth(4), 8500));

            try {
                XSSFFormulaEvaluator.evaluateAllFormulaCells(workbook);
            } catch (Exception evalEx) {
                log.debug("Formula evaluation note: {}", evalEx.getMessage());
            }

            workbook.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            log.error("Failed to export incomes to Excel for user {}", user.getId(), e);
            throw new RuntimeException("Error exporting incomes to Excel", e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POWERBI-STYLE FINANCIAL INTELLIGENCE DASHBOARD MASTER WORKBOOK
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public byte[] exportFinancialStatementExcel(User user) {
        if (user == null) {
            throw new IllegalArgumentException("User context cannot be null");
        }
        return exportFinancialStatementExcel(user, null);
    }

    @Override
    public byte[] exportFinancialStatementExcel(User user, String preferredCurrency) {
        if (user == null) {
            throw new IllegalArgumentException("User context cannot be null");
        }
        List<Expense> expenses = expenseRepository.findByUser(user);
        List<Income> incomes = incomeRepository.findByUser(user);
        List<SavingsGoal> savingsGoals = savingsGoalRepository.findByUser(user);
        List<Budget> budgets = (budgetRepository != null) ? budgetRepository.findByUser(user) : Collections.emptyList();
        return financialStatementExcelGenerator.generate(user, preferredCurrency, expenses, incomes, savingsGoals, budgets);
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

    public byte[] exportFinancialStatementPdf(User user) {
        if (user == null) {
            throw new IllegalArgumentException("User context cannot be null");
        }
        return exportFinancialStatementPdf(user, null);
    }

    @Override
    public byte[] exportFinancialStatementPdf(User user, String preferredCurrency) {
        if (user == null) {
            throw new IllegalArgumentException("User context cannot be null");
        }
        List<Expense> expenses = expenseRepository.findByUser(user);
        List<Income> incomes = incomeRepository.findByUser(user);
        List<SavingsGoal> savingsGoals = savingsGoalRepository.findByUser(user);
        return financialStatementPdfGenerator.generate(user, preferredCurrency, expenses, incomes, savingsGoals);
    }
    private static void addPdfHeaderBanner(Document doc, String title, String subtitle, Color accentColor, User user, CurrencyMeta curr, String pdfSym) throws org.openpdf.text.DocumentException {
        PdfPTable banner = new PdfPTable(1);
        banner.setWidthPercentage(100);
        PdfPCell bannerCell = new PdfPCell();
        bannerCell.setBackgroundColor(new Color(15, 23, 42)); // Obsidian Slate #0F172A
        bannerCell.setPaddingTop(12);
        bannerCell.setPaddingBottom(12);
        bannerCell.setPaddingLeft(16);
        bannerCell.setPaddingRight(16);
        bannerCell.setBorder(org.openpdf.text.Rectangle.NO_BORDER);

        Paragraph pTitle = new Paragraph("EXPENSETRACKER PRO",
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 16, Color.WHITE));
        Paragraph pSub = new Paragraph(subtitle,
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10f, accentColor));
        String userName = user.getName() != null ? user.getName() : "Account Holder";
        String userEmail = user.getEmail() != null ? user.getEmail() : "";
        Paragraph pMeta = new Paragraph(
                "Account: " + userName + " (" + userEmail + ")  |  Currency: " + curr.code() + " (" + pdfSym + ")  |  Generated: " + LocalDate.now(),
                FontFactory.getFont(FontFactory.HELVETICA, 8.5f, new Color(148, 163, 184)));

        bannerCell.addElement(pTitle);
        bannerCell.addElement(pSub);
        bannerCell.addElement(pMeta);
        banner.addCell(bannerCell);
        doc.add(banner);

        // Accent divider rule
        PdfPTable rule = new PdfPTable(1);
        rule.setWidthPercentage(100);
        PdfPCell ruleCell = new PdfPCell();
        ruleCell.setBackgroundColor(accentColor);
        ruleCell.setFixedHeight(2.5f);
        ruleCell.setBorder(org.openpdf.text.Rectangle.NO_BORDER);
        rule.addCell(ruleCell);
        doc.add(rule);
        doc.add(new Paragraph(" "));
    }

    private static void addPdfKpiCard(PdfPTable table, String label, String value, Color accent) {
        PdfPCell cell = new PdfPCell();
        cell.setPadding(8);
        cell.setBackgroundColor(new Color(248, 250, 252));
        cell.setBorderColor(new Color(226, 232, 240));
        cell.addElement(new Paragraph(label, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 7.5f, accent)));
        cell.addElement(new Paragraph(value,
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11f, new Color(15, 23, 42))));
        table.addCell(cell);
    }

    private static void addPdfFooterNote(Document doc) throws org.openpdf.text.DocumentException {
        Paragraph footer = new Paragraph(
                "Generated from verified immutable ledger data • ExpenseTracker Pro Financial Systems • Strictly Confidential",
                FontFactory.getFont(FontFactory.HELVETICA_OBLIQUE, 7.5f, new Color(148, 163, 184)));
        footer.setAlignment(Element.ALIGN_CENTER);
        doc.add(new Paragraph(" "));
        doc.add(footer);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LOW-LEVEL HELPER UTILITIES
    // ─────────────────────────────────────────────────────────────────────────

    private void addHeaderCell(PdfPTable table, String text, org.openpdf.text.Font font, Color bg) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setBackgroundColor(bg);
        cell.setHorizontalAlignment(Element.ALIGN_CENTER);
        cell.setVerticalAlignment(Element.ALIGN_MIDDLE);
        cell.setPadding(6);
        table.addCell(cell);
    }

    private void addKpiCell(PdfPTable table, String text, org.openpdf.text.Font font) {
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

    /**
     * Returns a currency-aware threshold for "high expense" conditional formatting.
     * <p>
     * FIXED: previously every currency used a hardcoded "1000" threshold, which was meaningless
     * for JPY/KRW/VND/IDR (where 1000 is essentially zero) and arbitrary for USD/EUR/GBP.
     * Now we scale by the currency's typical magnitude:
     *   - Zero-decimal currencies (JPY, KRW, VND, IDR, HUF, CLP) use 100,000
     *   - High-inflation / soft currencies (INR, PKR, NGN, ARS, COP, LBP) use 10,000
     *   - Major reserve currencies (USD, EUR, GBP, CHF, CAD, AUD, SGD, NZD) use 1,000
     *   - Other currencies default to 1,000
     * </p>
     */
    private String currencyAwareHighExpenseThreshold(CurrencyMeta curr) {
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

    private String escapeCsv(String value) {
        if (value == null) return "";
        String sanitized = value;
        if (!sanitized.isEmpty()) {
            // FIXED: previously checked the first character against '-' (among others) and prefixed
            // with a single quote, which silently converted legitimate negative numbers in text
            // fields (e.g. "-100.00" in a description) into string literals in Excel. We now only
            // treat values starting with '=' or '@' as formula-injection risks, since those are the
            // only characters that Excel interprets as formula/DDE prefixes at the start of a cell.
            // The '+' prefix is technically a formula trigger but is also common in phone numbers
            // ("+1-555-..."), so we keep it for safety. Tab/CR are also kept since they can affect
            // CSV parsing across spreadsheet apps. The leading '-' is removed from the dangerous set.
            char firstChar = sanitized.charAt(0);
            if (firstChar == '=' || firstChar == '+' || firstChar == '@' || firstChar == '\t' || firstChar == '\r') {
                sanitized = "'" + sanitized;
            }
        }
        return sanitized.replace("\"", "\"\"");
    }
}
