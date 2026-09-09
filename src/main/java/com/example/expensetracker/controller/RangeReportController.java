package com.example.expensetracker.controller;

import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.Income;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.IncomeRepository;
import com.example.expensetracker.security.UserSecurity;
import com.example.expensetracker.service.UserService;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.usermodel.Workbook;
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
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * Range-aware executive exports. These endpoints always query persistence at export time,
 * rather than trusting the dashboard's cached/filtered client collection.
 */
@RestController
@RequestMapping("/api/reports")
public class RangeReportController {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final MediaType XLSX = MediaType.parseMediaType(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    private final ExpenseRepository expenseRepository;
    private final IncomeRepository incomeRepository;
    private final UserService userService;
    private final UserSecurity userSecurity;

    public RangeReportController(
            ExpenseRepository expenseRepository,
            IncomeRepository incomeRepository,
            UserService userService,
            UserSecurity userSecurity) {
        this.expenseRepository = expenseRepository;
        this.incomeRepository = incomeRepository;
        this.userService = userService;
        this.userSecurity = userSecurity;
    }

    @GetMapping("/user/{userId}/export/range/excel")
    public ResponseEntity<byte[]> exportExcel(
            @PathVariable Long userId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false, defaultValue = "INR") String currency) {
        userSecurity.validateUserAccess(userId);
        User user = getUser(userId);
        Range range = Range.of(from, to);
        Dataset data = load(user, range);
        byte[] bytes = buildExcel(data, range, currency);
        return ResponseEntity.ok()
                .contentType(XLSX)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename("ExpenseTracker_Executive_Dashboard.xlsx").build().toString())
                .body(bytes);
    }

    @GetMapping("/user/{userId}/export/range/pdf")
    public ResponseEntity<byte[]> exportPdf(
            @PathVariable Long userId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false, defaultValue = "INR") String currency) {
        userSecurity.validateUserAccess(userId);
        User user = getUser(userId);
        Range range = Range.of(from, to);
        Dataset data = load(user, range);
        byte[] bytes = buildPdf(data, range, currency, user.getName());
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename("ExpenseTracker_Executive_Report.pdf").build().toString())
                .body(bytes);
    }

    private User getUser(Long userId) {
        return userService.findById(userId).orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    private Dataset load(User user, Range range) {
        List<Expense> expenses = expenseRepository.findByUser(user).stream()
                .filter(e -> range.contains(e.getExpenseDate()))
                .sorted(Comparator.comparing(Expense::getExpenseDate, Comparator.nullsLast(Comparator.reverseOrder())))
                .collect(Collectors.toList());
        List<Income> incomes = incomeRepository.findByUser(user).stream()
                .filter(i -> range.contains(i.getIncomeDate()))
                .sorted(Comparator.comparing(Income::getIncomeDate, Comparator.nullsLast(Comparator.reverseOrder())))
                .collect(Collectors.toList());
        return new Dataset(expenses, incomes);
    }

    private byte[] buildExcel(Dataset data, Range range, String currency) {
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            String symbol = currencySymbol(currency);
            BigDecimal expenseTotal = data.expenseTotal();
            BigDecimal incomeTotal = data.incomeTotal();
            BigDecimal net = incomeTotal.subtract(expenseTotal);
            BigDecimal average = data.expenses.isEmpty() ? BigDecimal.ZERO
                    : expenseTotal.divide(BigDecimal.valueOf(data.expenses.size()), 2, java.math.RoundingMode.HALF_UP);

            CellStyle hero = style(wb, "0F172A", "FFFFFF", true, 16);
            CellStyle section = style(wb, "1E293B", "FFFFFF", true, 11);
            CellStyle header = style(wb, "334155", "FFFFFF", true, 10);
            CellStyle normal = style(wb, "F8FAFC", "0F172A", false, 10);
            CellStyle money = style(wb, "F8FAFC", "0F172A", false, 10);
            money.setDataFormat(wb.createDataFormat().getFormat("\"" + symbol + " \"#,##0.00;(\"" + symbol + " \"#,##0.00);\"-\""));
            CellStyle positive = style(wb, "ECFDF5", "047857", true, 10);
            CellStyle negative = style(wb, "FEF2F2", "B91C1C", true, 10);

            var dash = wb.createSheet("Executive Dashboard");
            dash.setDisplayGridlines(false);
            dash.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(0, 1, 0, 7));
            set(dash, 0, 0, "EXPENSETRACKER | EXECUTIVE FINANCIAL DASHBOARD", hero);
            set(dash, 2, 0, "Reporting period", section);
            set(dash, 2, 1, range.label(), normal);
            set(dash, 4, 0, "TOTAL SPEND", header); set(dash, 5, 0, expenseTotal, money);
            set(dash, 4, 2, "TOTAL INCOME", header); set(dash, 5, 2, incomeTotal, money);
            set(dash, 4, 4, "NET CASH FLOW", header); set(dash, 5, 4, net, net.signum() >= 0 ? positive : negative);
            set(dash, 4, 6, "TRANSACTIONS", header); set(dash, 5, 6, data.expenses.size(), normal);
            set(dash, 7, 0, "KEY INSIGHTS", section);
            List<String> insights = insights(data, expenseTotal, incomeTotal, average, symbol);
            for (int i = 0; i < insights.size(); i++) set(dash, 8 + i, 0, insights.get(i), normal);
            for (int i = 0; i < 8; i++) dash.setColumnWidth(i, 20 * 256);

            var cat = wb.createSheet("Category Analysis");
            cat.setDisplayGridlines(false);
            set(cat, 0, 0, "CATEGORY PERFORMANCE", hero);
            String[] catHeaders = {"Category", "Spend", "% of Spend", "Transactions", "Average"};
            for (int c = 0; c < catHeaders.length; c++) set(cat, 2, c, catHeaders[c], header);
            Map<String, List<Expense>> groups = data.expenses.stream().collect(Collectors.groupingBy(
                    e -> e.getCategory() == null ? "Uncategorized" : e.getCategory().getName(),
                    LinkedHashMap::new, Collectors.toList()));
            int r = 3;
            for (var entry : groups.entrySet().stream().sorted((a,b) -> b.getValue().stream().map(Expense::getAmount).filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add).compareTo(a.getValue().stream().map(Expense::getAmount).filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add))).collect(Collectors.toList())) {
                BigDecimal total = entry.getValue().stream().map(Expense::getAmount).filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
                BigDecimal pct = expenseTotal.signum() == 0 ? BigDecimal.ZERO : total.multiply(BigDecimal.valueOf(100)).divide(expenseTotal, 1, java.math.RoundingMode.HALF_UP);
                BigDecimal avg = entry.getValue().isEmpty() ? BigDecimal.ZERO : total.divide(BigDecimal.valueOf(entry.getValue().size()), 2, java.math.RoundingMode.HALF_UP);
                set(cat, r, 0, entry.getKey(), normal); set(cat, r, 1, total, money); set(cat, r, 2, pct.doubleValue() / 100d, normal); set(cat, r, 3, entry.getValue().size(), normal); set(cat, r, 4, avg, money); r++;
            }
            for (int i = 0; i < 5; i++) cat.setColumnWidth(i, new int[]{28,18,16,16,18}[i] * 256);

            var tx = wb.createSheet("Transactions");
            tx.setDisplayGridlines(false);
            String[] txHeaders = {"Date", "Category", "Description", "Amount", "Recurring"};
            for (int c = 0; c < txHeaders.length; c++) set(tx, 0, c, txHeaders[c], header);
            r = 1;
            for (Expense e : data.expenses) {
                set(tx, r, 0, e.getExpenseDate() == null ? "" : e.getExpenseDate().format(DATE), normal);
                set(tx, r, 1, e.getCategory() == null ? "Uncategorized" : e.getCategory().getName(), normal);
                set(tx, r, 2, e.getDescription() == null ? "" : e.getDescription(), normal);
                set(tx, r, 3, e.getAmount() == null ? BigDecimal.ZERO : e.getAmount(), money);
                set(tx, r, 4, e.isRecurring() ? "Yes" : "No", normal); r++;
            }
            for (int i = 0; i < 5; i++) tx.setColumnWidth(i, new int[]{16,24,48,18,14}[i] * 256);

            var trend = wb.createSheet("Cash Flow");
            trend.setDisplayGridlines(false);
            String[] trendHeaders = {"Month", "Income", "Spend", "Net"};
            for (int c = 0; c < trendHeaders.length; c++) set(trend, 0, c, trendHeaders[c], header);
            Map<String, BigDecimal> inc = data.incomes.stream().filter(i -> i.getIncomeDate() != null).collect(Collectors.groupingBy(i -> i.getIncomeDate().withDayOfMonth(1).toString(), Collectors.mapping(i -> nz(i.getAmount()), Collectors.reducing(BigDecimal.ZERO, BigDecimal::add))));
            Map<String, BigDecimal> exp = data.expenses.stream().filter(e -> e.getExpenseDate() != null).collect(Collectors.groupingBy(e -> e.getExpenseDate().withDayOfMonth(1).toString(), Collectors.mapping(e -> nz(e.getAmount()), Collectors.reducing(BigDecimal.ZERO, BigDecimal::add))));
            r = 1;
            for (String month : java.util.stream.Stream.concat(inc.keySet().stream(), exp.keySet().stream()).distinct().sorted().collect(Collectors.toList())) {
                BigDecimal i = inc.getOrDefault(month, BigDecimal.ZERO), e = exp.getOrDefault(month, BigDecimal.ZERO);
                set(trend, r, 0, month, normal); set(trend, r, 1, i, money); set(trend, r, 2, e, money); set(trend, r, 3, i.subtract(e), i.compareTo(e) >= 0 ? positive : negative); r++;
            }
            for (int i = 0; i < 4; i++) trend.setColumnWidth(i, 20 * 256);
            return wb.write(out) == null ? out.toByteArray() : out.toByteArray();
        } catch (Exception e) {
            throw new IllegalStateException("Unable to create executive Excel report", e);
        }
    }

    private byte[] buildPdf(Dataset data, Range range, String currency, String userName) {
        String symbol = currencySymbol(currency);
        BigDecimal spend = data.expenseTotal(), income = data.incomeTotal(), net = income.subtract(spend);
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document doc = new Document(PageSize.A4, 34, 34, 38, 38);
            PdfWriter.getInstance(doc, out);
            doc.open();
            org.openpdf.text.Font title = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 22, new Color(15,23,42));
            org.openpdf.text.Font muted = FontFactory.getFont(FontFactory.HELVETICA, 9, new Color(100,116,139));
            org.openpdf.text.Font bold = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, new Color(15,23,42));
            doc.add(new Paragraph("EXPENSETRACKER", title));
            doc.add(new Paragraph("Executive Financial Intelligence Report", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14, new Color(79,70,229))));
            doc.add(new Paragraph("Prepared for " + userName + "  |  " + range.label() + "  |  " + currency, muted));
            doc.add(new Paragraph("\n"));

            PdfPTable kpis = new PdfPTable(4); kpis.setWidthPercentage(100);
            addKpi(kpis, "TOTAL SPEND", symbol + " " + spend, new Color(239,68,68));
            addKpi(kpis, "TOTAL INCOME", symbol + " " + income, new Color(16,185,129));
            addKpi(kpis, "NET CASH FLOW", symbol + " " + net, net.signum() >= 0 ? new Color(16,185,129) : new Color(239,68,68));
            addKpi(kpis, "TRANSACTIONS", String.valueOf(data.expenses.size()), new Color(79,70,229));
            doc.add(kpis);
            doc.add(new Paragraph("\nKey insights", bold));
            for (String insight : insights(data, spend, income, data.expenses.isEmpty() ? BigDecimal.ZERO : spend.divide(BigDecimal.valueOf(data.expenses.size()), 2, java.math.RoundingMode.HALF_UP), symbol)) {
                doc.add(new Paragraph("- " + insight, FontFactory.getFont(FontFactory.HELVETICA, 9, new Color(51,65,85))));
            }
            doc.add(new Paragraph("\nCategory breakdown", bold));
            Map<String, BigDecimal> categories = data.expenses.stream().collect(Collectors.groupingBy(e -> e.getCategory() == null ? "Uncategorized" : e.getCategory().getName(), Collectors.mapping(e -> nz(e.getAmount()), Collectors.reducing(BigDecimal.ZERO, BigDecimal::add))));
            PdfPTable cat = new PdfPTable(3); cat.setWidthPercentage(100);
            headerCell(cat, "Category"); headerCell(cat, "Spend"); headerCell(cat, "%");
            for (var entry : categories.entrySet().stream().sorted((a,b) -> b.getValue().compareTo(a.getValue())).collect(Collectors.toList())) {
                cat.addCell(new Phrase(entry.getKey(), muted));
                cat.addCell(new Phrase(symbol + " " + entry.getValue(), muted));
                BigDecimal pct = spend.signum() == 0 ? BigDecimal.ZERO : entry.getValue().multiply(BigDecimal.valueOf(100)).divide(spend, 1, java.math.RoundingMode.HALF_UP);
                cat.addCell(new Phrase(pct + "%", muted));
            }
            doc.add(cat);
            doc.add(new Paragraph("\nTransaction ledger", bold));
            PdfPTable table = new PdfPTable(4); table.setWidthPercentage(100); table.setWidths(new float[]{18,24,38,20});
            headerCell(table, "Date"); headerCell(table, "Category"); headerCell(table, "Description"); headerCell(table, "Amount");
            for (Expense e : data.expenses) {
                table.addCell(new Phrase(e.getExpenseDate() == null ? "" : e.getExpenseDate().toString(), muted));
                table.addCell(new Phrase(e.getCategory() == null ? "Uncategorized" : e.getCategory().getName(), muted));
                table.addCell(new Phrase(e.getDescription() == null ? "" : e.getDescription(), muted));
                table.addCell(new Phrase(symbol + " " + nz(e.getAmount()), muted));
            }
            doc.add(table);
            doc.add(new Paragraph("\nGenerated from live persisted ledger data at export time.", muted));
            doc.close();
            return out.toByteArray();
        } catch (Exception e) {
            throw new IllegalStateException("Unable to create executive PDF report", e);
        }
    }

    private static List<String> insights(Dataset data, BigDecimal spend, BigDecimal income, BigDecimal average, String symbol) {
        String topCategory = data.expenses.stream().collect(Collectors.groupingBy(e -> e.getCategory() == null ? "Uncategorized" : e.getCategory().getName(), Collectors.mapping(e -> nz(e.getAmount()), Collectors.reducing(BigDecimal.ZERO, BigDecimal::add)))).entrySet().stream().max(Map.Entry.comparingByValue()).map(Map.Entry::getKey).orElse("No category data");
        BigDecimal net = income.subtract(spend);
        return List.of(
                "Largest cost centre: " + topCategory + ".",
                "Average expense per transaction: " + symbol + " " + average + ".",
                net.signum() >= 0 ? "Cash flow is positive for this reporting period." : "Cash flow is negative; spending exceeded recorded income.",
                data.expenses.isEmpty() ? "No expenses were recorded in the selected period." : "Review recurring and top-category spend before the next cycle."
        );
    }

    private static CellStyle style(Workbook wb, String bg, String fg, boolean bold, int size) {
        CellStyle s = wb.createCellStyle();
        s.setFillForegroundColor(new org.apache.poi.xssf.usermodel.XSSFColor(java.awt.Color.decode("#" + bg), null));
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        s.setAlignment(HorizontalAlignment.LEFT); s.setVerticalAlignment(VerticalAlignment.CENTER);
        s.setBorderBottom(BorderStyle.THIN); s.setBorderColor(org.apache.poi.ss.usermodel.BorderSide.BOTTOM, new org.apache.poi.xssf.usermodel.XSSFColor(java.awt.Color.decode("#CBD5E1"), null));
        Font f = wb.createFont(); f.setColor(new org.apache.poi.xssf.usermodel.XSSFColor(java.awt.Color.decode("#" + fg), null)); f.setBold(bold); f.setFontHeightInPoints((short) size); f.setFontName("Aptos"); s.setFont(f);
        return s;
    }

    private static void set(org.apache.poi.ss.usermodel.Sheet sheet, int row, int col, Object value, CellStyle style) {
        Cell cell = sheet.getRow(row) == null ? sheet.createRow(row).createCell(col) : sheet.getRow(row).createCell(col);
        if (value instanceof BigDecimal b) cell.setCellValue(b.doubleValue());
        else if (value instanceof Number n) cell.setCellValue(n.doubleValue());
        else cell.setCellValue(String.valueOf(value));
        cell.setCellStyle(style);
    }

    private static void addKpi(PdfPTable table, String label, String value, Color accent) {
        PdfPCell cell = new PdfPCell(); cell.setPadding(10); cell.setBorderColor(new Color(226,232,240));
        cell.addElement(new Paragraph(label, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, accent)));
        cell.addElement(new Paragraph(value, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, new Color(15,23,42)))); table.addCell(cell);
    }

    private static void headerCell(PdfPTable table, String text) {
        PdfPCell cell = new PdfPCell(new Phrase(text, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, Color.WHITE)));
        cell.setBackgroundColor(new Color(30,41,59)); cell.setPadding(7); table.addCell(cell);
    }

    private static BigDecimal nz(BigDecimal value) { return value == null ? BigDecimal.ZERO : value; }

    private static String currencySymbol(String code) {
        if (code == null) return "₹";
        return switch (code.toUpperCase()) { case "USD" -> "$"; case "EUR" -> "€"; case "GBP" -> "£"; case "JPY" -> "¥"; case "AED" -> "AED"; default -> "INR".equalsIgnoreCase(code) ? "₹" : code.toUpperCase(); };
    }

    private record Dataset(List<Expense> expenses, List<Income> incomes) {
        BigDecimal expenseTotal() { return expenses.stream().map(e -> nz(e.getAmount())).reduce(BigDecimal.ZERO, BigDecimal::add); }
        BigDecimal incomeTotal() { return incomes.stream().map(i -> nz(i.getAmount())).reduce(BigDecimal.ZERO, BigDecimal::add); }
    }

    private record Range(LocalDate from, LocalDate to) {
        static Range of(String from, String to) {
            LocalDate f = (from == null || from.isBlank()) ? null : LocalDate.parse(from);
            LocalDate t = (to == null || to.isBlank()) ? null : LocalDate.parse(to);
            if (f != null && t != null && t.isBefore(f)) throw new IllegalArgumentException("The report end date must be on or after the start date.");
            return new Range(f, t);
        }
        boolean contains(LocalDate date) { return date != null && (from == null || !date.isBefore(from)) && (to == null || !date.isAfter(to)); }
        String label() { if (from == null && to == null) return "All time"; if (from == null) return "Through " + to; if (to == null) return "From " + from; return from + " to " + to; }
    }
}
