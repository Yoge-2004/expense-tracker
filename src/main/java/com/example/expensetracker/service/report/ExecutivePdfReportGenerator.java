package com.example.expensetracker.service.report;

import com.example.expensetracker.model.*;
import com.example.expensetracker.mapper.IncomeRules;
import lombok.extern.slf4j.Slf4j;
import org.openpdf.text.Document;
import org.openpdf.text.DocumentException;
import org.openpdf.text.Element;
import org.openpdf.text.Font;
import org.openpdf.text.FontFactory;
import org.openpdf.text.PageSize;
import org.openpdf.text.Paragraph;
import org.openpdf.text.Phrase;
import org.openpdf.text.Rectangle;
import org.openpdf.text.pdf.PdfPCell;
import org.openpdf.text.pdf.PdfPTable;
import org.openpdf.text.pdf.PdfPageEventHelper;
import org.openpdf.text.pdf.PdfWriter;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Dedicated generator for OpenPDF executive financial statements with typography and audit ledgers.
 */
@Slf4j
@Component
public class ExecutivePdfReportGenerator {

    public byte[] generate(ExecutiveReportData d, ExecutiveReportDateRange range, String currency, String name) {
        String cleanCurr = cleanCurrency(currency);
        String s = symbol(cleanCurr);
        BigDecimal spend = d.spend();
        BigDecimal income = d.income();
        BigDecimal net = income.subtract(spend);
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document doc = new Document(PageSize.A4, 28, 28, 36, 36);
            PdfWriter writer = PdfWriter.getInstance(doc, out);
            writer.setPageEvent(new ExecutiveReportPageEvent());
            doc.open();

            // 1. Executive Slate & Gold Header Banner
            PdfPTable banner = new PdfPTable(1);
            banner.setWidthPercentage(100);
            PdfPCell bannerCell = new PdfPCell();
            bannerCell.setBackgroundColor(new Color(15, 23, 42)); // Obsidian Slate #0F172A
            bannerCell.setPaddingTop(12);
            bannerCell.setPaddingBottom(12);
            bannerCell.setPaddingLeft(16);
            bannerCell.setPaddingRight(16);
            bannerCell.setBorder(Rectangle.NO_BORDER);

            Paragraph pTitle = new Paragraph("EXPENSETRACKER PRO",
                    FontFactory.getFont(FontFactory.HELVETICA_BOLD, 16, Color.WHITE));
            Paragraph pSub = new Paragraph("Executive Financial Intelligence Statement",
                    FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10f, new Color(199, 154, 62))); // Luxury Gold #C79A3E
            Paragraph pMeta = new Paragraph("Prepared for: " + safe(name) + "  |  Audit Period: " + range.label() + "  |  Currency: " + cleanCurr + " (" + s + ")",
                    FontFactory.getFont(FontFactory.HELVETICA, 8f, new Color(148, 163, 184)));

            bannerCell.addElement(pTitle);
            bannerCell.addElement(pSub);
            bannerCell.addElement(pMeta);
            banner.addCell(bannerCell);
            doc.add(banner);

            // Gold divider rule
            PdfPTable goldRule = new PdfPTable(1);
            goldRule.setWidthPercentage(100);
            PdfPCell ruleCell = new PdfPCell();
            ruleCell.setBackgroundColor(new Color(199, 154, 62));
            ruleCell.setFixedHeight(2.5f);
            ruleCell.setBorder(Rectangle.NO_BORDER);
            goldRule.addCell(ruleCell);
            doc.add(goldRule);
            doc.add(new Paragraph(" "));

            var muted = FontFactory.getFont(FontFactory.HELVETICA, 8.5f, new Color(100, 116, 139));
            var bold = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9.5f, new Color(15, 23, 42));

            // 2. Executive 4-Card KPI Ribbon
            PdfPTable k = new PdfPTable(4);
            k.setWidthPercentage(100);
            k.setWidths(new float[]{25, 25, 25, 25});
            kpi(k, "TOTAL SPEND", s + " " + fmt(spend), "Discretionary & operating outflow", new Color(220, 38, 38));
            kpi(k, "TOTAL REVENUE", s + " " + fmt(income), "Reconciled incoming streams", new Color(5, 150, 105));
            kpi(k, "NET CASH FLOW", s + " " + fmt(net),
                    net.signum() >= 0 ? "Net liquidity surplus retained" : "Net operating deficit",
                    net.signum() >= 0 ? new Color(5, 150, 105) : new Color(220, 38, 38));
            kpi(k, "TRANSACTIONS", (d.expenses.size() + d.incomes.size()) + " Entries", "Dual-ledger verified records", new Color(79, 70, 229));
            doc.add(k);
            doc.add(new Paragraph(" "));

            // 3. Portfolio Configuration & Coverage Ribbon
            Paragraph covTitle = new Paragraph("PORTFOLIO CONFIGURATION & COVERAGE", bold);
            covTitle.setSpacingAfter(4f);
            doc.add(covTitle);

            PdfPTable coverage = new PdfPTable(5);
            coverage.setWidthPercentage(100);
            coverage.setWidths(new float[]{20, 20, 20, 20, 20});
            head(coverage, "Expenses", Element.ALIGN_CENTER);
            head(coverage, "Income", Element.ALIGN_CENTER);
            head(coverage, "Savings Goals", Element.ALIGN_CENTER);
            head(coverage, "Subscriptions", Element.ALIGN_CENTER);
            head(coverage, "Budgets", Element.ALIGN_CENTER);
            cell(coverage, String.valueOf(d.expenses.size()), bold, false, Element.ALIGN_CENTER);
            cell(coverage, String.valueOf(d.incomes.size()), bold, false, Element.ALIGN_CENTER);
            cell(coverage, String.valueOf(d.savingsGoals.size()), bold, false, Element.ALIGN_CENTER);
            cell(coverage, String.valueOf(d.subscriptions.size()), bold, false, Element.ALIGN_CENTER);
            cell(coverage, String.valueOf(d.budgets.size()), bold, false, Element.ALIGN_CENTER);
            doc.add(coverage);
            doc.add(new Paragraph(" "));

            // 4. Strategic Telemetry & Audit Callout Box
            PdfPTable insightBox = new PdfPTable(1);
            insightBox.setWidthPercentage(100);
            PdfPCell ibCell = new PdfPCell();
            ibCell.setBackgroundColor(new Color(248, 250, 252));
            ibCell.setBorderColor(new Color(226, 232, 240));
            ibCell.setBorderWidth(1f);
            ibCell.setBorderWidthLeft(3.5f);
            ibCell.setBorderColorLeft(new Color(199, 154, 62)); // Gold left accent
            ibCell.setPaddingTop(9);
            ibCell.setPaddingBottom(9);
            ibCell.setPaddingLeft(12);
            ibCell.setPaddingRight(12);

            Paragraph ibTitle = new Paragraph("EXECUTIVE TELEMETRY & STRATEGIC AUDIT",
                    FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9.5f, new Color(15, 23, 42)));
            ibTitle.setSpacingAfter(5f);
            ibCell.addElement(ibTitle);

            for (String insight : d.insights(spend, income, s)) {
                Paragraph p = new Paragraph("◆  " + insight, FontFactory.getFont(FontFactory.HELVETICA, 8.5f, new Color(51, 65, 85)));
                p.setSpacingAfter(3f);
                ibCell.addElement(p);
            }
            insightBox.addCell(ibCell);
            doc.add(insightBox);
            doc.add(new Paragraph(" "));

            // 5. Itemized Ledgers
            addIncomePdf(doc, d.incomes, s, muted, bold);
            doc.add(new Paragraph(" "));
            addExpensePdf(doc, d.expenses, s, muted, bold);
            doc.add(new Paragraph(" "));
            addSavingsPdf(doc, d.savingsGoals, s, muted, bold);
            doc.add(new Paragraph(" "));
            addSubscriptionPdf(doc, d.subscriptions, s, muted, bold);
            doc.add(new Paragraph(" "));
            addBudgetPdf(doc, d.budgets, s, muted, bold);

            doc.close();
            return out.toByteArray();
        } catch (Exception ex) {
            log.error("Failed to generate executive PDF report: {}", ex.getMessage(), ex);
            throw new org.springframework.web.server.ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to create executive PDF report", ex);
        }
    }

    private static void addIncomePdf(Document doc, List<Income> incomes, String s,
                                     Font muted, Font bold) throws DocumentException {
        Paragraph title = new Paragraph("INCOME LEDGER · " + incomes.size() + " REVENUE STREAMS", bold);
        title.setSpacingBefore(8f);
        title.setSpacingAfter(4f);
        doc.add(title);

        PdfPTable t = new PdfPTable(4);
        t.setWidthPercentage(100);
        t.setWidths(new float[]{16, 26, 38, 20});
        t.setHeaderRows(1);

        head(t, "Date", Element.ALIGN_CENTER);
        head(t, "Source", Element.ALIGN_LEFT);
        head(t, "Description", Element.ALIGN_LEFT);
        head(t, "Amount (" + s + ")", Element.ALIGN_RIGHT);

        Font dateFont = FontFactory.getFont(FontFactory.HELVETICA, 8f, new Color(71, 85, 105));
        Font sourceFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, new Color(15, 23, 42));
        Font amtFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, new Color(5, 150, 105)); // Emerald

        BigDecimal totalIncome = BigDecimal.ZERO;
        for (int i = 0; i < incomes.size(); i++) {
            Income x = incomes.get(i);
            boolean z = (i % 2 == 1);
            BigDecimal amt = nz(x.getAmount());
            totalIncome = totalIncome.add(amt);

            cell(t, safeDate(x.getIncomeDate()), dateFont, z, Element.ALIGN_CENTER);
            cell(t, safe(x.getSource()), sourceFont, z, Element.ALIGN_LEFT);
            cell(t, safe(x.getDescription()), muted, z, Element.ALIGN_LEFT);
            cell(t, s + " " + fmt(amt), amtFont, z, Element.ALIGN_RIGHT);
        }

        if (incomes.isEmpty()) {
            PdfPCell empty = new PdfPCell(new Phrase("No income streams recorded in this audit period.", dateFont));
            empty.setColspan(4);
            empty.setHorizontalAlignment(Element.ALIGN_CENTER);
            empty.setPadding(10);
            empty.setBackgroundColor(new Color(248, 250, 252));
            empty.setBorderColor(new Color(226, 232, 240));
            t.addCell(empty);
        } else {
            PdfPCell totLbl = new PdfPCell(new Phrase("TOTAL VERIFIED INFLOW (" + s + "):", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, new Color(15, 23, 42))));
            totLbl.setColspan(3);
            totLbl.setHorizontalAlignment(Element.ALIGN_RIGHT);
            totLbl.setVerticalAlignment(Element.ALIGN_MIDDLE);
            totLbl.setBackgroundColor(new Color(241, 245, 249));
            totLbl.setBorderColor(new Color(203, 213, 225));
            totLbl.setPadding(6);
            t.addCell(totLbl);

            PdfPCell totVal = new PdfPCell(new Phrase(s + " " + fmt(totalIncome), FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9f, new Color(5, 150, 105))));
            totVal.setHorizontalAlignment(Element.ALIGN_RIGHT);
            totVal.setVerticalAlignment(Element.ALIGN_MIDDLE);
            totVal.setBackgroundColor(new Color(241, 245, 249));
            totVal.setBorderColor(new Color(203, 213, 225));
            totVal.setPadding(6);
            t.addCell(totVal);
        }
        doc.add(t);
    }

    private static void addExpensePdf(Document doc, List<Expense> expenses, String s,
                                      Font muted, Font bold) throws DocumentException {
        Paragraph title = new Paragraph("EXPENSE LEDGER · " + expenses.size() + " DISBURSEMENTS", bold);
        title.setSpacingBefore(8f);
        title.setSpacingAfter(4f);
        doc.add(title);

        PdfPTable t = new PdfPTable(4);
        t.setWidthPercentage(100);
        t.setWidths(new float[]{16, 22, 42, 20});
        t.setHeaderRows(1);

        head(t, "Date", Element.ALIGN_CENTER);
        head(t, "Category", Element.ALIGN_LEFT);
        head(t, "Description", Element.ALIGN_LEFT);
        head(t, "Amount (" + s + ")", Element.ALIGN_RIGHT);

        Font dateFont = FontFactory.getFont(FontFactory.HELVETICA, 8f, new Color(71, 85, 105));
        Font catFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, new Color(15, 23, 42));
        Font amtFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, new Color(220, 38, 38)); // Crimson

        BigDecimal totalSpend = BigDecimal.ZERO;
        for (int i = 0; i < expenses.size(); i++) {
            Expense x = expenses.get(i);
            boolean z = (i % 2 == 1);
            BigDecimal amt = nz(x.getAmount());
            totalSpend = totalSpend.add(amt);

            cell(t, safeDate(x.getExpenseDate()), dateFont, z, Element.ALIGN_CENTER);
            cell(t, categoryName(x.getCategory()), catFont, z, Element.ALIGN_LEFT);
            cell(t, safe(x.getDescription()), muted, z, Element.ALIGN_LEFT);
            cell(t, s + " " + fmt(amt), amtFont, z, Element.ALIGN_RIGHT);
        }

        if (expenses.isEmpty()) {
            PdfPCell empty = new PdfPCell(new Phrase("No expense disbursements recorded in this audit period.", dateFont));
            empty.setColspan(4);
            empty.setHorizontalAlignment(Element.ALIGN_CENTER);
            empty.setPadding(10);
            empty.setBackgroundColor(new Color(248, 250, 252));
            empty.setBorderColor(new Color(226, 232, 240));
            t.addCell(empty);
        } else {
            PdfPCell totLbl = new PdfPCell(new Phrase("TOTAL VERIFIED OUTFLOW (" + s + "):", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, new Color(15, 23, 42))));
            totLbl.setColspan(3);
            totLbl.setHorizontalAlignment(Element.ALIGN_RIGHT);
            totLbl.setVerticalAlignment(Element.ALIGN_MIDDLE);
            totLbl.setBackgroundColor(new Color(241, 245, 249));
            totLbl.setBorderColor(new Color(203, 213, 225));
            totLbl.setPadding(6);
            t.addCell(totLbl);

            PdfPCell totVal = new PdfPCell(new Phrase(s + " " + fmt(totalSpend), FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9f, new Color(220, 38, 38))));
            totVal.setHorizontalAlignment(Element.ALIGN_RIGHT);
            totVal.setVerticalAlignment(Element.ALIGN_MIDDLE);
            totVal.setBackgroundColor(new Color(241, 245, 249));
            totVal.setBorderColor(new Color(203, 213, 225));
            totVal.setPadding(6);
            t.addCell(totVal);
        }
        doc.add(t);
    }

    private static void addSavingsPdf(Document doc, List<SavingsGoal> goals, String s,
                                      Font muted, Font bold) throws DocumentException {
        if (goals.isEmpty()) return;
        Paragraph title = new Paragraph("SAVINGS GOALS & MILESTONES · " + goals.size() + " TARGETS", bold);
        title.setSpacingBefore(8f);
        title.setSpacingAfter(4f);
        doc.add(title);

        PdfPTable t = new PdfPTable(5);
        t.setWidthPercentage(100);
        t.setWidths(new float[]{28, 18, 18, 18, 18});
        t.setHeaderRows(1);

        head(t, "Goal", Element.ALIGN_LEFT);
        head(t, "Target (" + s + ")", Element.ALIGN_RIGHT);
        head(t, "Saved (" + s + ")", Element.ALIGN_RIGHT);
        head(t, "Progress", Element.ALIGN_CENTER);
        head(t, "Status", Element.ALIGN_CENTER);

        Font nameFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, new Color(15, 23, 42));
        Font numFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, new Color(124, 58, 237)); // Purple

        for (int i = 0; i < goals.size(); i++) {
            SavingsGoal x = goals.get(i);
            BigDecimal target = nz(x.getTargetAmount());
            BigDecimal saved = nz(x.getCurrentAmount());
            double pct = target.signum() > 0 ? saved.divide(target, 4, RoundingMode.HALF_UP).doubleValue() * 100 : 0d;
            boolean z = (i % 2 == 1);

            cell(t, safe(x.getName()), nameFont, z, Element.ALIGN_LEFT);
            cell(t, s + " " + fmt(target), muted, z, Element.ALIGN_RIGHT);
            cell(t, s + " " + fmt(saved), numFont, z, Element.ALIGN_RIGHT);
            cell(t, String.format(Locale.US, "%.1f%%", pct), numFont, z, Element.ALIGN_CENTER);
            cell(t, safe(x.getStatus()), muted, z, Element.ALIGN_CENTER);
        }
        doc.add(t);
    }

    private static void addSubscriptionPdf(Document doc, List<RecurringExpense> subscriptions, String s,
                                           Font muted, Font bold) throws DocumentException {
        if (subscriptions.isEmpty()) return;
        Paragraph title = new Paragraph("RECURRING SUBSCRIPTIONS · " + subscriptions.size() + " COMMITMENTS", bold);
        title.setSpacingBefore(8f);
        title.setSpacingAfter(4f);
        doc.add(title);

        PdfPTable t = new PdfPTable(5);
        t.setWidthPercentage(100);
        t.setWidths(new float[]{32, 20, 16, 16, 16});
        t.setHeaderRows(1);

        head(t, "Subscription", Element.ALIGN_LEFT);
        head(t, "Amount (" + s + ")", Element.ALIGN_RIGHT);
        head(t, "Frequency", Element.ALIGN_CENTER);
        head(t, "Next Due", Element.ALIGN_CENTER);
        head(t, "Category", Element.ALIGN_LEFT);

        Font nameFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, new Color(15, 23, 42));
        Font numFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, new Color(217, 119, 6)); // Amber

        for (int i = 0; i < subscriptions.size(); i++) {
            RecurringExpense x = subscriptions.get(i);
            boolean z = (i % 2 == 1);
            cell(t, safe(x.getDescription()), nameFont, z, Element.ALIGN_LEFT);
            cell(t, s + " " + fmt(nz(x.getAmount())), numFont, z, Element.ALIGN_RIGHT);
            cell(t, safe(x.getFrequency()), muted, z, Element.ALIGN_CENTER);
            cell(t, safeDate(x.getNextDueDate()), muted, z, Element.ALIGN_CENTER);
            cell(t, categoryName(x.getCategory()), muted, z, Element.ALIGN_LEFT);
        }
        doc.add(t);
    }

    private static void addBudgetPdf(Document doc, List<Budget> budgets, String s,
                                      Font muted, Font bold) throws DocumentException {
        if (budgets.isEmpty()) return;
        Paragraph title = new Paragraph("CATEGORY BUDGET ALLOCATIONS · " + budgets.size() + " ENVELOPES", bold);
        title.setSpacingBefore(8f);
        title.setSpacingAfter(4f);
        doc.add(title);

        PdfPTable t = new PdfPTable(4);
        t.setWidthPercentage(100);
        t.setWidths(new float[]{28, 22, 20, 30});
        t.setHeaderRows(1);

        head(t, "Category", Element.ALIGN_LEFT);
        head(t, "Limit (" + s + ")", Element.ALIGN_RIGHT);
        head(t, "Period", Element.ALIGN_CENTER);
        head(t, "Date Window", Element.ALIGN_CENTER);

        Font catFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, new Color(15, 23, 42));
        Font numFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, new Color(37, 99, 235));

        for (int i = 0; i < budgets.size(); i++) {
            Budget x = budgets.get(i);
            boolean z = (i % 2 == 1);
            cell(t, categoryName(x.getCategory()), catFont, z, Element.ALIGN_LEFT);
            cell(t, s + " " + fmt(nz(x.getLimitAmount())), numFont, z, Element.ALIGN_RIGHT);
            cell(t, safe(x.getPeriod()), muted, z, Element.ALIGN_CENTER);
            cell(t, safeDate(x.getStartDate()) + " → " + safeDate(x.getEndDate()), muted, z, Element.ALIGN_CENTER);
        }
        doc.add(t);
    }


    private static class ExecutiveReportPageEvent extends PdfPageEventHelper {
        private final Font footerFont = FontFactory.getFont(FontFactory.HELVETICA, 7.5f, new Color(148, 163, 184));
        private final Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 7.5f, new Color(100, 116, 139));

        @Override
        public void onEndPage(PdfWriter writer, Document document) {
            // Running top header for pages > 1
            if (writer.getPageNumber() > 1) {
                PdfPTable headTbl = new PdfPTable(2);
                headTbl.setTotalWidth(document.right() - document.left());
                headTbl.setWidthPercentage(100);

                PdfPCell lCell = new PdfPCell(new Phrase("EXPENSETRACKER PRO  |  EXECUTIVE STATEMENT", headerFont));
                lCell.setBorder(Rectangle.BOTTOM);
                lCell.setBorderColor(new Color(226, 232, 240));
                lCell.setBorderWidth(0.5f);
                lCell.setPaddingBottom(4);
                headTbl.addCell(lCell);

                PdfPCell rCell = new PdfPCell(new Phrase("CONFIDENTIAL AUDIT LEDGER", headerFont));
                rCell.setBorder(Rectangle.BOTTOM);
                rCell.setBorderColor(new Color(226, 232, 240));
                rCell.setBorderWidth(0.5f);
                rCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
                rCell.setPaddingBottom(4);
                headTbl.addCell(rCell);

                headTbl.writeSelectedRows(0, -1, document.left(), document.top() + 18, writer.getDirectContent());
            }

            // Running bottom footer on all pages
            PdfPTable footTbl = new PdfPTable(2);
            footTbl.setTotalWidth(document.right() - document.left());
            footTbl.setWidthPercentage(100);

            PdfPCell fLeft = new PdfPCell(new Phrase("ExpenseTracker Executive Financial Statement  ·  Strictly Confidential  ·  Generated: " + LocalDate.now(), footerFont));
            fLeft.setBorder(Rectangle.TOP);
            fLeft.setBorderColor(new Color(226, 232, 240));
            fLeft.setBorderWidth(0.5f);
            fLeft.setPaddingTop(5);
            footTbl.addCell(fLeft);

            PdfPCell fRight = new PdfPCell(new Phrase("Page " + writer.getPageNumber(), footerFont));
            fRight.setBorder(Rectangle.TOP);
            fRight.setBorderColor(new Color(226, 232, 240));
            fRight.setBorderWidth(0.5f);
            fRight.setHorizontalAlignment(Element.ALIGN_RIGHT);
            fRight.setPaddingTop(5);
            footTbl.addCell(fRight);

            footTbl.writeSelectedRows(0, -1, document.left(), document.bottom() - 10, writer.getDirectContent());
        }
    }


    private static String cleanCurrency(String c) {
        if (c == null || c.isBlank()) return "INR";
        if (c.contains(",")) c = c.split(",")[0];
        return c.trim();
    }

    private static String fmt(BigDecimal value) {
        if (value == null) return "0.00";
        return String.format(Locale.US, "%,.2f", value);
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }

    private static String categoryName(com.example.expensetracker.model.Category cat) {
        if (cat == null) {
            return "Uncategorized";
        }
        try {
            String name = cat.getName();
            return (name != null && !name.isBlank()) ? name : "Uncategorized";
        } catch (Exception ex) {
            return "Uncategorized";
        }
    }

    private static String safeDate(LocalDate value) {
        return value == null ? "" : value.toString();
    }

    private static BigDecimal nz(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private static String symbol(String c) {
        c = cleanCurrency(c);
        String upper = c.toUpperCase(Locale.ROOT);
        return switch (upper) {
            case "INR" -> "Rs.";
            case "USD" -> "$";
            case "EUR" -> "€";
            case "GBP" -> "£";
            case "JPY" -> "¥";
            case "AED" -> "AED";
            default -> {
                try {
                    String sym = Currency.getInstance(upper).getSymbol(Locale.ROOT);
                    if (sym != null && !sym.isBlank() && !sym.equals(upper)) {
                        if ("$".equals(sym) || "€".equals(sym) || "£".equals(sym) || "¥".equals(sym)) {
                            yield sym;
                        }
                    }
                    yield upper;
                } catch (Exception ignored) {
                    yield upper;
                }
            }
        };
    }

    private static void kpi(PdfPTable table, String label, String value, String subtitle, Color accent) {
        PdfPCell cell = new PdfPCell();
        cell.setPadding(8);
        cell.setBackgroundColor(new Color(248, 250, 252));
        cell.setBorderColor(new Color(226, 232, 240));
        cell.setBorderWidth(1f);

        Paragraph pLabel = new Paragraph(label, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 7.5f, accent));
        pLabel.setSpacingAfter(3f);
        cell.addElement(pLabel);

        Paragraph pVal = new Paragraph(value,
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12f, new Color(15, 23, 42)));
        pVal.setSpacingAfter(2f);
        cell.addElement(pVal);

        Paragraph pSub = new Paragraph(subtitle,
                FontFactory.getFont(FontFactory.HELVETICA, 7f, new Color(100, 116, 139)));
        cell.addElement(pSub);

        table.addCell(cell);
    }

    private static void head(PdfPTable table, String text) {
        head(table, text, Element.ALIGN_LEFT);
    }

    private static void head(PdfPTable table, String text, int align) {
        PdfPCell cell = new PdfPCell(new Phrase(text,
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, Color.WHITE)));
        cell.setBackgroundColor(new Color(15, 23, 42)); // Slate Obsidian #0F172A
        cell.setBorderColor(new Color(199, 154, 62)); // Gold border #C79A3E
        cell.setPadding(6);
        cell.setHorizontalAlignment(align);
        cell.setVerticalAlignment(Element.ALIGN_MIDDLE);
        table.addCell(cell);
    }

    private static void cell(PdfPTable table, String text, Font font) {
        cell(table, text, font, false, Element.ALIGN_LEFT);
    }

    private static void cell(PdfPTable table, String text, Font font, boolean zebra) {
        cell(table, text, font, zebra, Element.ALIGN_LEFT);
    }

    private static void cell(PdfPTable table, String text, Font font, boolean zebra, int align) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setPadding(5);
        cell.setBackgroundColor(zebra ? new Color(248, 250, 252) : Color.WHITE);
        cell.setBorderColor(new Color(226, 232, 240));
        cell.setHorizontalAlignment(align);
        cell.setVerticalAlignment(Element.ALIGN_MIDDLE);
        table.addCell(cell);
    }

}
