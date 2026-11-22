package com.example.expensetracker.domain.report.service;

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

import com.example.expensetracker.domain.budget.model.Budget;
import com.example.expensetracker.domain.budget.repository.BudgetRepository;
import com.example.expensetracker.domain.expense.dto.ExpenseDto;
import com.example.expensetracker.domain.expense.mapper.ExpenseMapper;
import com.example.expensetracker.domain.expense.model.Category;
import com.example.expensetracker.domain.expense.model.Expense;
import com.example.expensetracker.domain.expense.repository.ExpenseRepository;
import com.example.expensetracker.domain.goal.model.SavingsGoal;
import com.example.expensetracker.domain.goal.repository.SavingsGoalRepository;
import com.example.expensetracker.domain.income.dto.IncomeDto;
import com.example.expensetracker.domain.income.mapper.IncomeMapper;
import com.example.expensetracker.domain.income.model.Income;
import com.example.expensetracker.domain.income.repository.IncomeRepository;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.infrastructure.exception.ExportException;



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

    private final ExpenseRepository expenseRepository;
    private final IncomeRepository incomeRepository;
    private final SavingsGoalRepository savingsGoalRepository;
    private final ObjectMapper objectMapper;
    private final BudgetRepository budgetRepository;
    private final FinancialStatementExcelGenerator financialStatementExcelGenerator;
    private final FinancialStatementPdfGenerator financialStatementPdfGenerator;
    private final ExpensePdfReportGenerator expensePdfReportGenerator;
    private final ExpenseExcelReportGenerator expenseExcelReportGenerator;
    private final IncomePdfReportGenerator incomePdfReportGenerator;
    private final IncomeExcelReportGenerator incomeExcelReportGenerator;

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
        if (preferredCurrency != null && !preferredCurrency.isBlank()) {
            code = preferredCurrency.trim().toUpperCase();
        } else if (user != null && user.getCurrency() != null && !user.getCurrency().isBlank()) {
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
        } catch (Exception _) {
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
                             @Autowired(required = false) FinancialStatementPdfGenerator financialStatementPdfGenerator,
                             @Autowired(required = false) ExpensePdfReportGenerator expensePdfReportGenerator,
                             @Autowired(required = false) ExpenseExcelReportGenerator expenseExcelReportGenerator,
                             @Autowired(required = false) IncomePdfReportGenerator incomePdfReportGenerator,
                             @Autowired(required = false) IncomeExcelReportGenerator incomeExcelReportGenerator) {
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
        this.expensePdfReportGenerator = expensePdfReportGenerator != null
                ? expensePdfReportGenerator : new ExpensePdfReportGenerator();
        this.expenseExcelReportGenerator = expenseExcelReportGenerator != null
                ? expenseExcelReportGenerator : new ExpenseExcelReportGenerator();
        this.incomePdfReportGenerator = incomePdfReportGenerator != null
                ? incomePdfReportGenerator : new IncomePdfReportGenerator();
        this.incomeExcelReportGenerator = incomeExcelReportGenerator != null
                ? incomeExcelReportGenerator : new IncomeExcelReportGenerator();
    }

    public ExportServiceImpl(ExpenseRepository expenseRepository,
                             IncomeRepository incomeRepository,
                             SavingsGoalRepository savingsGoalRepository,
                             BudgetRepository budgetRepository) {
        this(expenseRepository, incomeRepository, savingsGoalRepository, budgetRepository, null, null, null, null, null, null);
    }

    public ExportServiceImpl(ExpenseRepository expenseRepository,
                             IncomeRepository incomeRepository,
                             SavingsGoalRepository savingsGoalRepository) {
        this(expenseRepository, incomeRepository, savingsGoalRepository, null, null, null, null, null, null, null);
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
            throw new ExportException("Error exporting expenses to JSON", e);
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
        List<Expense> expenses = expenseRepository.findByUser(user);
        return expensePdfReportGenerator.generate(user, preferredCurrency, expenses);
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
        return expenseExcelReportGenerator.generate(user, preferredCurrency, expenses);
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
            throw new ExportException("Error exporting incomes to JSON", e);
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
        List<Income> incomes = incomeRepository.findByUser(user);
        return incomePdfReportGenerator.generate(user, preferredCurrency, incomes);
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
        return incomeExcelReportGenerator.generate(user, preferredCurrency, incomes);
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

    @Override
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
