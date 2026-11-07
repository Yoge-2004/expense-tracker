package com.example.expensetracker.service.report;

import com.example.expensetracker.mapper.IncomeRules;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.Income;
import com.example.expensetracker.model.IncomeKind;
import com.example.expensetracker.model.SavingsGoal;
import com.example.expensetracker.model.User;
import com.example.expensetracker.service.impl.ExportServiceImpl;
import com.example.expensetracker.service.impl.ExportServiceImpl.CurrencyMeta;
import lombok.extern.slf4j.Slf4j;
import org.openpdf.text.Document;
import org.openpdf.text.Element;
import org.openpdf.text.FontFactory;
import org.openpdf.text.PageSize;
import org.openpdf.text.Paragraph;
import org.openpdf.text.Phrase;
import org.openpdf.text.pdf.PdfPCell;
import org.openpdf.text.pdf.PdfPTable;
import org.openpdf.text.pdf.PdfWriter;
import org.springframework.stereotype.Component;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;

/**
 * Dedicated report generator producing executive financial statement PDF documents.
 *
 * @author Yogeshwaran
 */
@Slf4j
@Component
public class FinancialStatementPdfGenerator {

    public byte[] generate(User user, String preferredCurrency,
                           List<Expense> expenses, List<Income> incomes,
                           List<SavingsGoal> savingsGoals) {
        CurrencyMeta curr = ExportServiceImpl.resolveCurrency(preferredCurrency, user);
        String pdfSym = ExportServiceImpl.pdfSymbol(curr);

        // Money handed back (reimbursements) is not income: it reduces what was spent.
        BigDecimal totalIncome = incomes.stream()
                .filter(i -> IncomeRules.effectiveKind(i) != IncomeKind.REIMBURSEMENT)
                .map(Income::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal reimbursed = incomes.stream()
                .filter(i -> IncomeRules.effectiveKind(i) == IncomeKind.REIMBURSEMENT)
                .map(Income::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalExpenses = expenses.stream()
                .map(Expense::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .subtract(reimbursed).max(BigDecimal.ZERO);
        BigDecimal netSavings = totalIncome.subtract(totalExpenses);

        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document document = new Document(PageSize.A4, 36, 36, 36, 36);
            PdfWriter.getInstance(document, out);
            document.open();

            org.openpdf.text.Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 20, Color.DARK_GRAY);
            Paragraph title = new Paragraph("EXECUTIVE FINANCIAL STATEMENT", titleFont);
            title.setAlignment(Element.ALIGN_CENTER);
            document.add(title);

            org.openpdf.text.Font subTitleFont = FontFactory.getFont(FontFactory.HELVETICA, 10, Color.GRAY);
            Paragraph userPara = new Paragraph(
                    "User: " + user.getName() + " (" + user.getEmail() + ") | Currency: "
                            + curr.code() + " (" + pdfSym + ") | Generated: " + LocalDate.now() + "\n\n",
                    subTitleFont
            );
            userPara.setAlignment(Element.ALIGN_CENTER);
            document.add(userPara);

            // Summary KPI Table
            PdfPTable kpiTable = new PdfPTable(3);
            kpiTable.setWidthPercentage(100);
            kpiTable.setWidths(new float[]{33, 33, 34});

            org.openpdf.text.Font kpiHeaderFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, Color.WHITE);
            addHeaderCell(kpiTable, "Total Earnings (" + pdfSym + ")", kpiHeaderFont, new Color(16, 185, 129));
            addHeaderCell(kpiTable, "Total Spendings (" + pdfSym + ")", kpiHeaderFont, new Color(239, 68, 68));
            addHeaderCell(kpiTable, "Net Cash Flow (" + pdfSym + ")", kpiHeaderFont, new Color(59, 130, 246));

            org.openpdf.text.Font kpiValueFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, Color.DARK_GRAY);
            addKpiCell(kpiTable, pdfSym + " " + formatAmount(totalIncome, curr.decimals()), kpiValueFont);
            addKpiCell(kpiTable, pdfSym + " " + formatAmount(totalExpenses, curr.decimals()), kpiValueFont);
            addKpiCell(kpiTable, pdfSym + " " + formatAmount(netSavings, curr.decimals()), kpiValueFont);

            document.add(kpiTable);
            document.add(new Paragraph("\n"));

            // Recent Expenses Section
            Paragraph expSection =
                    new Paragraph("Recent Expenditures",
                            FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, Color.DARK_GRAY));
            document.add(expSection);
            document.add(new Paragraph(" "));

            PdfPTable expTable = new PdfPTable(4);
            expTable.setWidthPercentage(100);
            expTable.setWidths(new float[]{20, 25, 35, 20});

            org.openpdf.text.Font tableHeaderFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, Color.WHITE);
            Color expHeaderBg = new Color(79, 70, 229);
            addHeaderCell(expTable, "Date", tableHeaderFont, expHeaderBg);
            addHeaderCell(expTable, "Category", tableHeaderFont, expHeaderBg);
            addHeaderCell(expTable, "Description", tableHeaderFont, expHeaderBg);
            addHeaderCell(expTable, "Amount (" + pdfSym + ")", tableHeaderFont, expHeaderBg);

            org.openpdf.text.Font dataFont = FontFactory.getFont(FontFactory.HELVETICA, 8, Color.BLACK);
            int expCount = 0;
            for (Expense exp : expenses) {
                if (expCount++ >= 10) break; // Top 10 for statement
                expTable.addCell(
                        new Phrase(exp.getExpenseDate() != null ? exp.getExpenseDate().toString() : "", dataFont));
                expTable.addCell(
                        new Phrase(exp.getCategory() != null ? exp.getCategory().getName() : "General", dataFont));
                expTable.addCell(new Phrase(exp.getDescription() != null ? exp.getDescription() : "", dataFont));
                BigDecimal amt = exp.getAmount() != null ? exp.getAmount() : BigDecimal.ZERO;
                expTable.addCell(new Phrase(pdfSym + " " + formatAmount(amt, curr.decimals()), dataFont));
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
                Paragraph goalSection =
                        new Paragraph("Savings Goals Tracking",
                                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, Color.DARK_GRAY));
                document.add(goalSection);
                document.add(new Paragraph(" "));

                PdfPTable goalTable = new PdfPTable(4);
                goalTable.setWidthPercentage(100);
                goalTable.setWidths(new float[]{30, 25, 25, 20});

                Color goalHeaderBg = new Color(139, 92, 246);
                addHeaderCell(goalTable, "Goal Name", tableHeaderFont, goalHeaderBg);
                addHeaderCell(goalTable, "Target (" + pdfSym + ")", tableHeaderFont, goalHeaderBg);
                addHeaderCell(goalTable, "Current (" + pdfSym + ")", tableHeaderFont, goalHeaderBg);
                addHeaderCell(goalTable, "Progress", tableHeaderFont, goalHeaderBg);

                for (SavingsGoal goal : savingsGoals) {
                    // FIXED: goal.getName() can be null — Phrase constructor is null-hostile in
                    // newer openpdf versions and would NPE. Guard with a fallback label.
                    goalTable.addCell(new Phrase(goal.getName() != null ? goal.getName() : "Unnamed Goal", dataFont));
                    goalTable.addCell(
                            new Phrase(pdfSym + " "
                                    + formatAmount(goal.getTargetAmount(), curr.decimals()), dataFont));
                    goalTable.addCell(
                            new Phrase(pdfSym + " "
                                    + formatAmount(goal.getCurrentAmount(), curr.decimals()), dataFont));
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
            log.error("Failed to export financial statement PDF for user {}", user.getId(), e);
            throw new RuntimeException("Error exporting financial statement to PDF", e);
        }
    }

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

}
