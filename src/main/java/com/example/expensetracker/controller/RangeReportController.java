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
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.openpdf.text.Document;
import org.openpdf.text.Element;
import org.openpdf.text.FontFactory;
import org.openpdf.text.PageSize;
import org.openpdf.text.Paragraph;
import org.openpdf.text.Phrase;
import org.openpdf.text.pdf.PdfPCell;
import org.openpdf.text.pdf.PdfPTable;
import org.openpdf.text.pdf.PdfWriter;
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
@RestController
@RequestMapping("/api/reports")
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

    public RangeReportController(ExpenseRepository expenses,
                                  IncomeRepository incomes,
                                  SavingsGoalRepository savingsGoals,
                                  RecurringExpenseRepository recurringExpenses,
                                  BudgetRepository budgets,
                                  UserService users,
                                  UserSecurity security) {
        this.expenses = expenses;
        this.incomes = incomes;
        this.savingsGoals = savingsGoals;
        this.recurringExpenses = recurringExpenses;
        this.budgets = budgets;
        this.users = users;
        this.security = security;
    }

    @GetMapping("/user/{userId}/export/range/excel")
    public ResponseEntity<byte[]> excel(@PathVariable Long userId,
                                        @RequestParam(required = false) String from,
                                        @RequestParam(required = false) String to,
                                        @RequestParam(defaultValue = "INR") String currency) {
        security.validateUserAccess(userId);
        User user = user(userId);
        Range range = Range.of(from, to);
        Data data = data(user, range);
        return ResponseEntity.ok()
                .contentType(XLSX)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment()
                                .filename("ExpenseTracker_Executive_Dashboard.xlsx")
                                .build().toString())
                .body(excel(data, range, currency));
    }

    @GetMapping("/user/{userId}/export/range/pdf")
    public ResponseEntity<byte[]> pdf(@PathVariable Long userId,
                                      @RequestParam(required = false) String from,
                                      @RequestParam(required = false) String to,
                                      @RequestParam(defaultValue = "INR") String currency) {
        security.validateUserAccess(userId);
        User user = user(userId);
        Range range = Range.of(from, to);
        Data data = data(user, range);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment()
                                .filename("ExpenseTracker_Executive_Report.pdf")
                                .build().toString())
                .body(pdf(data, range, currency, user.getName()));
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
                .collect(Collectors.toList());

        List<Income> i = incomes.findByUser(user).stream()
                .filter(x -> range.contains(x.getIncomeDate()))
                .sorted(Comparator.comparing(Income::getIncomeDate,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .collect(Collectors.toList());

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
            XSSFCellStyle hero = style(wb, "0F172A", "FFFFFF", true, 16);
            XSSFCellStyle header = style(wb, "334155", "FFFFFF", true, 10);
            XSSFCellStyle body = style(wb, "F8FAFC", "0F172A", false, 10);
            XSSFCellStyle good = style(wb, "ECFDF5", "047857", true, 10);
            XSSFCellStyle bad = style(wb, "FEF2F2", "B91C1C", true, 10);
            XSSFCellStyle money = style(wb, "F8FAFC", "0F172A", false, 10);
            money.setDataFormat(wb.createDataFormat().getFormat(
                    "\"" + symbol + " \"#,##0.00;(\"" + symbol + " \"#,##0.00);\"-\""));

            Sheet dashboard = wb.createSheet("Executive Dashboard");
            dashboard.setDisplayGridlines(false);
            dashboard.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(0, 1, 0, 7));
            put(dashboard, 0, 0, "EXPENSETRACKER | EXECUTIVE FINANCIAL DASHBOARD", hero);
            put(dashboard, 2, 0, "Reporting period", header);
            put(dashboard, 2, 1, range.label(), body);
            put(dashboard, 4, 0, "TOTAL SPEND", header);
            put(dashboard, 5, 0, spend, money);
            put(dashboard, 4, 2, "TOTAL INCOME", header);
            put(dashboard, 5, 2, income, money);
            put(dashboard, 4, 4, "NET CASH FLOW", header);
            put(dashboard, 5, 4, net, net.signum() >= 0 ? good : bad);
            put(dashboard, 4, 6, "TRANSACTIONS", header);
            put(dashboard, 5, 6, d.expenses.size() + d.incomes.size(), body);
            put(dashboard, 7, 0, "FINANCIAL COVERAGE", header);
            put(dashboard, 8, 0, "Expenses", body);
            put(dashboard, 8, 1, d.expenses.size(), body);
            put(dashboard, 9, 0, "Incomes", body);
            put(dashboard, 9, 1, d.incomes.size(), body);
            put(dashboard, 10, 0, "Savings goals", body);
            put(dashboard, 10, 1, d.savingsGoals.size(), body);
            put(dashboard, 11, 0, "Subscriptions", body);
            put(dashboard, 11, 1, d.subscriptions.size(), body);
            put(dashboard, 12, 0, "Budgets", body);
            put(dashboard, 12, 1, d.budgets.size(), body);
            List<String> insights = insights(d, spend, income, symbol);
            put(dashboard, 7, 3, "KEY INSIGHTS", header);
            for (int n = 0; n < insights.size(); n++) {
                put(dashboard, 8 + n, 3, insights.get(n), body);
            }
            for (int c = 0; c < 8; c++) dashboard.setColumnWidth(c, 20 * 256);

            Sheet incomeSheet = wb.createSheet("Income Ledger");
            incomeSheet.setDisplayGridlines(false);
            String[] ih = {"Date", "Source", "Description", "Amount", "Frequency"};
            for (int c = 0; c < ih.length; c++) put(incomeSheet, 0, c, ih[c], header);
            int row = 1;
            for (Income x : d.incomes) {
                put(incomeSheet, row, 0, safeDate(x.getIncomeDate()), body);
                put(incomeSheet, row, 1, safe(x.getSource()), body);
                put(incomeSheet, row, 2, safe(x.getDescription()), body);
                put(incomeSheet, row, 3, nz(x.getAmount()), money);
                put(incomeSheet, row, 4, safe(x.getFrequency()), body);
                row++;
            }
            widths(incomeSheet, new int[]{16, 24, 48, 18, 16});

            Sheet expenseSheet = wb.createSheet("Expense Ledger");
            expenseSheet.setDisplayGridlines(false);
            String[] eh = {"Date", "Category", "Description", "Amount", "Recurring"};
            for (int c = 0; c < eh.length; c++) put(expenseSheet, 0, c, eh[c], header);
            row = 1;
            for (Expense x : d.expenses) {
                put(expenseSheet, row, 0, safeDate(x.getExpenseDate()), body);
                put(expenseSheet, row, 1, x.getCategory() == null ? "Uncategorized" : x.getCategory().getName(), body);
                put(expenseSheet, row, 2, safe(x.getDescription()), body);
                put(expenseSheet, row, 3, nz(x.getAmount()), money);
                put(expenseSheet, row, 4, x.isRecurring() ? "Yes" : "No", body);
                row++;
            }
            widths(expenseSheet, new int[]{16, 24, 48, 18, 14});

            Sheet savingsSheet = wb.createSheet("Savings Goals");
            savingsSheet.setDisplayGridlines(false);
            String[] sh = {"Goal", "Target", "Saved", "Progress", "Target Date", "Status", "Recurring", "Next Due"};
            for (int c = 0; c < sh.length; c++) put(savingsSheet, 0, c, sh[c], header);
            row = 1;
            for (SavingsGoal x : d.savingsGoals) {
                BigDecimal target = nz(x.getTargetAmount());
                BigDecimal saved = nz(x.getCurrentAmount());
                double pct = target.signum() > 0 ? saved.divide(target, 4, RoundingMode.HALF_UP).doubleValue() : 0d;
                put(savingsSheet, row, 0, safe(x.getName()), body);
                put(savingsSheet, row, 1, target, money);
                put(savingsSheet, row, 2, saved, money);
                put(savingsSheet, row, 3, pct, body);
                put(savingsSheet, row, 4, safeDate(x.getTargetDate()), body);
                put(savingsSheet, row, 5, safe(x.getStatus()), body);
                put(savingsSheet, row, 6, x.getIsRecurring() ? "Yes" : "No", body);
                put(savingsSheet, row, 7, safeDate(x.getNextDueDate()), body);
                row++;
            }
            widths(savingsSheet, new int[]{28, 18, 18, 14, 16, 16, 12, 16});

            Sheet subscriptionSheet = wb.createSheet("Subscriptions");
            subscriptionSheet.setDisplayGridlines(false);
            String[] rh = {"Subscription", "Amount", "Frequency", "Next Due", "Category"};
            for (int c = 0; c < rh.length; c++) put(subscriptionSheet, 0, c, rh[c], header);
            row = 1;
            for (RecurringExpense x : d.subscriptions) {
                put(subscriptionSheet, row, 0, safe(x.getDescription()), body);
                put(subscriptionSheet, row, 1, nz(x.getAmount()), money);
                put(subscriptionSheet, row, 2, safe(x.getFrequency()), body);
                put(subscriptionSheet, row, 3, safeDate(x.getNextDueDate()), body);
                put(subscriptionSheet, row, 4, x.getCategory() == null ? "Uncategorized" : x.getCategory().getName(), body);
                row++;
            }
            widths(subscriptionSheet, new int[]{32, 18, 16, 16, 24});

            Sheet budgetSheet = wb.createSheet("Budgets");
            budgetSheet.setDisplayGridlines(false);
            String[] bh = {"Category", "Limit", "Period", "Start Date", "End Date", "Interval Days"};
            for (int c = 0; c < bh.length; c++) put(budgetSheet, 0, c, bh[c], header);
            row = 1;
            for (Budget x : d.budgets) {
                put(budgetSheet, row, 0, x.getCategory() == null ? "Uncategorized" : x.getCategory().getName(), body);
                put(budgetSheet, row, 1, nz(x.getLimitAmount()), money);
                put(budgetSheet, row, 2, safe(x.getPeriod()), body);
                put(budgetSheet, row, 3, safeDate(x.getStartDate()), body);
                put(budgetSheet, row, 4, safeDate(x.getEndDate()), body);
                put(budgetSheet, row, 5, x.getIntervalDays() == null ? "" : x.getIntervalDays(), body);
                row++;
            }
            widths(budgetSheet, new int[]{24, 18, 16, 16, 16, 16});

            Sheet cash = wb.createSheet("Cash Flow");
            cash.setDisplayGridlines(false);
            String[] fh = {"Month", "Income", "Spend", "Net"};
            for (int c = 0; c < fh.length; c++) put(cash, 0, c, fh[c], header);
            Map<String, BigDecimal> im = d.incomes.stream()
                    .filter(x -> x.getIncomeDate() != null)
                    .collect(Collectors.groupingBy(x -> x.getIncomeDate().withDayOfMonth(1).toString(),
                            Collectors.mapping(x -> nz(x.getAmount()), Collectors.reducing(BigDecimal.ZERO, BigDecimal::add))));
            Map<String, BigDecimal> em = d.expenses.stream()
                    .filter(x -> x.getExpenseDate() != null)
                    .collect(Collectors.groupingBy(x -> x.getExpenseDate().withDayOfMonth(1).toString(),
                            Collectors.mapping(x -> nz(x.getAmount()), Collectors.reducing(BigDecimal.ZERO, BigDecimal::add))));
            row = 1;
            Set<String> months = new TreeSet<>();
            months.addAll(im.keySet());
            months.addAll(em.keySet());
            for (String m : months) {
                BigDecimal i = im.getOrDefault(m, BigDecimal.ZERO);
                BigDecimal e = em.getOrDefault(m, BigDecimal.ZERO);
                put(cash, row, 0, m, body);
                put(cash, row, 1, i, money);
                put(cash, row, 2, e, money);
                put(cash, row, 3, i.subtract(e), i.compareTo(e) >= 0 ? good : bad);
                row++;
            }
            widths(cash, new int[]{20, 20, 20, 20});

            wb.write(out);
            return out.toByteArray();
        } catch (Exception ex) {
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
            var title = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 21, new Color(15, 23, 42));
            var subtitle = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 13, new Color(79, 70, 229));
            var muted = FontFactory.getFont(FontFactory.HELVETICA, 8.5f, new Color(100, 116, 139));
            var bold = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, new Color(15, 23, 42));

            doc.add(new Paragraph("EXPENSETRACKER", title));
            doc.add(new Paragraph("Executive Financial Intelligence Report", subtitle));
            doc.add(new Paragraph("Prepared for " + safe(name) + " | " + range.label() + " | " + currency, muted));
            doc.add(new Paragraph(" "));

            PdfPTable k = new PdfPTable(4);
            k.setWidthPercentage(100);
            kpi(k, "TOTAL SPEND", s + " " + spend, new Color(239, 68, 68));
            kpi(k, "TOTAL INCOME", s + " " + income, new Color(16, 185, 129));
            kpi(k, "NET CASH FLOW", s + " " + net, net.signum() >= 0 ? new Color(16, 185, 129) : new Color(239, 68, 68));
            kpi(k, "TRANSACTIONS", String.valueOf(d.expenses.size() + d.incomes.size()), new Color(79, 70, 229));
            doc.add(k);

            doc.add(new Paragraph("Coverage", bold));
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

            doc.add(new Paragraph("Key insights", bold));
            for (String insight : insights(d, spend, income, s)) {
                doc.add(new Paragraph("- " + insight, muted));
            }

            addIncomePdf(doc, d.incomes, s, muted, bold);
            addExpensePdf(doc, d.expenses, s, muted, bold);
            addSavingsPdf(doc, d.savingsGoals, s, muted, bold);
            addSubscriptionPdf(doc, d.subscriptions, s, muted, bold);
            addBudgetPdf(doc, d.budgets, s, muted, bold);

            doc.add(new Paragraph("Generated from live persisted ledger data at export time.", muted));
            doc.close();
            return out.toByteArray();
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to create executive PDF report", ex);
        }
    }

    private static void addIncomePdf(Document doc, List<Income> incomes, String s, org.openpdf.text.Font muted, org.openpdf.text.Font bold) throws Exception {
        doc.add(new Paragraph("Income ledger", bold));
        PdfPTable t = new PdfPTable(4);
        t.setWidthPercentage(100);
        head(t, "Date"); head(t, "Source"); head(t, "Description"); head(t, "Amount");
        for (Income x : incomes) {
            cell(t, safeDate(x.getIncomeDate()), muted);
            cell(t, safe(x.getSource()), muted);
            cell(t, safe(x.getDescription()), muted);
            cell(t, s + " " + nz(x.getAmount()), muted);
        }
        doc.add(t);
    }

    private static void addExpensePdf(Document doc, List<Expense> expenses, String s, org.openpdf.text.Font muted, org.openpdf.text.Font bold) throws Exception {
        doc.add(new Paragraph("Expense ledger", bold));
        PdfPTable t = new PdfPTable(4);
        t.setWidthPercentage(100);
        head(t, "Date"); head(t, "Category"); head(t, "Description"); head(t, "Amount");
        for (Expense x : expenses) {
            cell(t, safeDate(x.getExpenseDate()), muted);
            cell(t, x.getCategory() == null ? "Uncategorized" : x.getCategory().getName(), muted);
            cell(t, safe(x.getDescription()), muted);
            cell(t, s + " " + nz(x.getAmount()), muted);
        }
        doc.add(t);
    }

    private static void addSavingsPdf(Document doc, List<SavingsGoal> goals, String s, org.openpdf.text.Font muted, org.openpdf.text.Font bold) throws Exception {
        doc.add(new Paragraph("Savings goals", bold));
        PdfPTable t = new PdfPTable(5);
        t.setWidthPercentage(100);
        head(t, "Goal"); head(t, "Target"); head(t, "Saved"); head(t, "Progress"); head(t, "Status");
        for (SavingsGoal x : goals) {
            BigDecimal target = nz(x.getTargetAmount());
            BigDecimal saved = nz(x.getCurrentAmount());
            double pct = target.signum() > 0 ? saved.divide(target, 4, RoundingMode.HALF_UP).doubleValue() * 100 : 0d;
            cell(t, safe(x.getName()), muted);
            cell(t, s + " " + target, muted);
            cell(t, s + " " + saved, muted);
            cell(t, String.format(Locale.US, "%.1f%%", pct), muted);
            cell(t, safe(x.getStatus()), muted);
        }
        doc.add(t);
    }

    private static void addSubscriptionPdf(Document doc, List<RecurringExpense> subscriptions, String s, org.openpdf.text.Font muted, org.openpdf.text.Font bold) throws Exception {
        doc.add(new Paragraph("Subscriptions", bold));
        PdfPTable t = new PdfPTable(5);
        t.setWidthPercentage(100);
        head(t, "Subscription"); head(t, "Amount"); head(t, "Frequency"); head(t, "Next Due"); head(t, "Category");
        for (RecurringExpense x : subscriptions) {
            cell(t, safe(x.getDescription()), muted);
            cell(t, s + " " + nz(x.getAmount()), muted);
            cell(t, safe(x.getFrequency()), muted);
            cell(t, safeDate(x.getNextDueDate()), muted);
            cell(t, x.getCategory() == null ? "Uncategorized" : x.getCategory().getName(), muted);
        }
        doc.add(t);
    }

    private static void addBudgetPdf(Document doc, List<Budget> budgets, String s, org.openpdf.text.Font muted, org.openpdf.text.Font bold) throws Exception {
        doc.add(new Paragraph("Budgets", bold));
        PdfPTable t = new PdfPTable(4);
        t.setWidthPercentage(100);
        head(t, "Category"); head(t, "Limit"); head(t, "Period"); head(t, "Date Window");
        for (Budget x : budgets) {
            cell(t, x.getCategory() == null ? "Uncategorized" : x.getCategory().getName(), muted);
            cell(t, s + " " + nz(x.getLimitAmount()), muted);
            cell(t, safe(x.getPeriod()), muted);
            cell(t, safeDate(x.getStartDate()) + " → " + safeDate(x.getEndDate()), muted);
        }
        doc.add(t);
    }

    private static List<String> insights(Data d, BigDecimal spend, BigDecimal income, String symbol) {
        String top = d.expenses.stream()
                .collect(Collectors.groupingBy(
                        x -> x.getCategory() == null ? "Uncategorized" : x.getCategory().getName(),
                        Collectors.mapping(x -> nz(x.getAmount()), Collectors.reducing(BigDecimal.ZERO, BigDecimal::add))))
                .entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse("No expense data");
        BigDecimal avg = d.expenses.isEmpty()
                ? BigDecimal.ZERO
                : spend.divide(BigDecimal.valueOf(d.expenses.size()), 2, RoundingMode.HALF_UP);
        return List.of(
                "Largest expense category: " + top + ".",
                "Average expense per transaction: " + symbol + " " + avg + ".",
                income.compareTo(spend) >= 0
                        ? "Cash flow is positive for the selected period."
                        : "Spending exceeded recorded income in the selected period.",
                d.savingsGoals.isEmpty()
                        ? "No savings goals are configured."
                        : d.savingsGoals.size() + " savings goal(s) are included in the export.",
                d.subscriptions.isEmpty()
                        ? "No active subscriptions are configured."
                        : d.subscriptions.size() + " active subscription(s) are included in the export."
        );
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
        if (c == null || c.isBlank()) return "₹";
        return switch (c.toUpperCase(Locale.ROOT)) {
            case "USD" -> "$";
            case "EUR" -> "€";
            case "GBP" -> "£";
            case "JPY" -> "¥";
            case "AED" -> "AED";
            case "INR" -> "₹";
            default -> c.toUpperCase(Locale.ROOT);
        };
    }

    private static XSSFCellStyle style(XSSFWorkbook workbook, String bg, String fg, boolean bold, int size) {
        XSSFCellStyle style = workbook.createCellStyle();
        style.setFillForegroundColor(new org.apache.poi.xssf.usermodel.XSSFColor(Color.decode("#" + bg), null));
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        org.apache.poi.xssf.usermodel.XSSFFont font = workbook.createFont();
        font.setColor(new org.apache.poi.xssf.usermodel.XSSFColor(Color.decode("#" + fg), null));
        font.setBold(bold);
        font.setFontHeightInPoints((short) size);
        font.setFontName("Aptos");
        style.setFont(font);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        return style;
    }

    private static void put(Sheet sheet, int row, int column, Object value, CellStyle style) {
        Row targetRow = sheet.getRow(row);
        if (targetRow == null) targetRow = sheet.createRow(row);
        Cell cell = targetRow.createCell(column);
        if (value instanceof BigDecimal decimal) {
            cell.setCellValue(decimal.doubleValue());
        } else if (value instanceof Number number) {
            cell.setCellValue(number.doubleValue());
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
        cell.setPadding(8);
        cell.setBorderColor(new Color(226, 232, 240));
        cell.addElement(new Paragraph(label, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 7.5f, accent)));
        cell.addElement(new Paragraph(value, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11, new Color(15, 23, 42))));
        table.addCell(cell);
    }

    private static void head(PdfPTable table, String text) {
        PdfPCell cell = new PdfPCell(new Phrase(text,
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 7.5f, Color.WHITE)));
        cell.setBackgroundColor(new Color(30, 41, 59));
        cell.setPadding(6);
        table.addCell(cell);
    }

    private static void cell(PdfPTable table, String text, org.openpdf.text.Font font) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setPadding(5);
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
            LocalDate start = from == null || from.isBlank() ? null : LocalDate.parse(from);
            LocalDate end = to == null || to.isBlank() ? null : LocalDate.parse(to);
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
