package com.example.expensetracker.domain.report.service;

import lombok.extern.slf4j.Slf4j;
import org.openpdf.text.*;
import org.openpdf.text.pdf.*;
import org.springframework.stereotype.Component;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.LocalDate;
import java.util.*;
import java.util.List;

import com.example.expensetracker.domain.expense.model.Expense;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.infrastructure.exception.ExportException;

/**
 * Dedicated OpenPDF report generator producing executive expense ledger PDF statements.
 * Satisfies Single Responsibility Principle (SRP) by isolating document rendering from export coordination.
 *
 * @author Yogeshwaran
 */
@Slf4j
@Component
public class ExpensePdfReportGenerator {

    public byte[] generate(User user, String preferredCurrency, List<Expense> rawExpenses) {
        CurrencyFormats.Metadata curr = CurrencyFormats.resolve(preferredCurrency, user);
        String pdfSym = CurrencyFormats.pdfSymbol(curr);
        return generate(user, preferredCurrency, rawExpenses, curr, pdfSym);
    }

    public byte[] generate(User user, String preferredCurrency, List<Expense> rawExpenses,
                           CurrencyFormats.Metadata curr, String pdfSym) {
        List<Expense> expenses = new ArrayList<>(rawExpenses);
        expenses.sort((a, b) -> {
            if (a.getExpenseDate() == null && b.getExpenseDate() == null) return 0;
            if (a.getExpenseDate() == null) return 1;
            if (b.getExpenseDate() == null) return -1;
            int c = b.getExpenseDate().compareTo(a.getExpenseDate());
            if (c != 0) return c;
            return Long.compare(b.getId() != null ? b.getId() : 0, a.getId() != null ? a.getId() : 0);
        });

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
                : total.divide(BigDecimal.valueOf(expenses.size()), 2, RoundingMode.HALF_UP);

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

            Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, Color.WHITE);
            Color headerBg = new Color(15, 23, 42); // Obsidian Slate

            addHeaderCell(table, "Date", headerFont, headerBg);
            addHeaderCell(table, "Category", headerFont, headerBg);
            addHeaderCell(table, "Description", headerFont, headerBg);
            addHeaderCell(table, "Amount (" + pdfSym + ")", headerFont, headerBg);

            Font dataFont = FontFactory.getFont(FontFactory.HELVETICA, 8.5f, new Color(15, 23, 42));
            Font dataFontBold = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, new Color(15, 23, 42));
            Font dateFont = FontFactory.getFont(FontFactory.HELVETICA, 8f, new Color(71, 85, 105));

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
            throw new ExportException("Error exporting expenses to PDF", e);
        }
    }

    private void addPdfHeaderBanner(Document doc, String title, String subtitle, Color accentColor, User user,
                                    CurrencyFormats.Metadata curr, String pdfSym) throws DocumentException {
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

        PdfPTable rule = new PdfPTable(1);
        rule.setWidthPercentage(100);
        PdfPCell ruleCell = new PdfPCell();
        ruleCell.setBackgroundColor(accentColor);
        ruleCell.setFixedHeight(2.5f);
        ruleCell.setBorder(Rectangle.NO_BORDER);
        rule.addCell(ruleCell);
        doc.add(rule);
        doc.add(new Paragraph(" "));
    }

    private void addPdfKpiCard(PdfPTable table, String label, String value, Color accent) {
        PdfPCell cell = new PdfPCell();
        cell.setPadding(8);
        cell.setBackgroundColor(new Color(248, 250, 252));
        cell.setBorderColor(new Color(226, 232, 240));
        cell.addElement(new Paragraph(label, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 7.5f, accent)));
        cell.addElement(new Paragraph(value,
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11f, new Color(15, 23, 42))));
        table.addCell(cell);
    }

    private void addPdfFooterNote(Document doc) throws DocumentException {
        Paragraph footer = new Paragraph(
                "Generated from verified immutable ledger data • ExpenseTracker Pro Financial Systems • Strictly Confidential",
                FontFactory.getFont(FontFactory.HELVETICA_OBLIQUE, 7.5f, new Color(148, 163, 184)));
        footer.setAlignment(Element.ALIGN_CENTER);
        doc.add(new Paragraph(" "));
        doc.add(footer);
    }

    private void addHeaderCell(PdfPTable table, String text, Font font, Color bg) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setBackgroundColor(bg);
        cell.setHorizontalAlignment(Element.ALIGN_CENTER);
        cell.setVerticalAlignment(Element.ALIGN_MIDDLE);
        cell.setPadding(6);
        table.addCell(cell);
    }

    private String formatAmount(BigDecimal amount, boolean hasDecimals) {
        if (amount == null) return hasDecimals ? "0.00" : "0";
        DecimalFormatSymbols symbols = new DecimalFormatSymbols(Locale.US);
        DecimalFormat fmt = hasDecimals ? new DecimalFormat("#,##0.00", symbols) : new DecimalFormat("#,##0", symbols);
        return fmt.format(amount);
    }
}
