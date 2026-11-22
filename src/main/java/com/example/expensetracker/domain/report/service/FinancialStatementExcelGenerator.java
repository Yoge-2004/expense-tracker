package com.example.expensetracker.domain.report.service;

import lombok.extern.slf4j.Slf4j;
import org.apache.poi.xssf.usermodel.DefaultIndexedColorMap;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFFormulaEvaluator;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import java.io.ByteArrayOutputStream;
import java.time.Clock;
import java.util.List;

import com.example.expensetracker.domain.budget.model.Budget;
import com.example.expensetracker.domain.expense.model.Expense;
import com.example.expensetracker.domain.goal.model.SavingsGoal;
import com.example.expensetracker.domain.income.model.Income;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.infrastructure.exception.ExportException;



/**
 * Enterprise report generator producing PowerBI-grade multi-sheet executive
 * financial intelligence workbooks with embedded charts, Pareto analysis,
 * solvency metrics, and strategic AI prescriptions.
 *
 * @author Yogeshwaran
 */
@Slf4j
@Component
public class FinancialStatementExcelGenerator {

    private final FinancialStatementExcelStyles styles;
    private final FinancialStatementAnalysisService analysisService;
    private final FinancialStatementLedgerSheetWriter ledgerSheetWriter;
    private final FinancialStatementDashboardSheetWriter dashboardSheetWriter;

    @Autowired
    public FinancialStatementExcelGenerator(FinancialStatementExcelStyles styles,
                                           FinancialStatementAnalysisService analysisService,
                                           FinancialStatementLedgerSheetWriter ledgerSheetWriter,
                                           FinancialStatementDashboardSheetWriter dashboardSheetWriter) {
        this.styles = styles;
        this.analysisService = analysisService;
        this.ledgerSheetWriter = ledgerSheetWriter;
        this.dashboardSheetWriter = dashboardSheetWriter;
    }

    @Deprecated(forRemoval = false)
    public FinancialStatementExcelGenerator() {
        FinancialStatementExcelStyles styles = new FinancialStatementExcelStyles();
        Clock clock = Clock.systemDefaultZone();
        this.styles = styles;
        this.analysisService = new FinancialStatementAnalysisService(clock);
        this.ledgerSheetWriter = new FinancialStatementLedgerSheetWriter(styles);
        this.dashboardSheetWriter = new FinancialStatementDashboardSheetWriter(styles, clock);
    }

    // Modern PowerBI Corporate Palette (24-bit RGB)

    public byte[] generate(User user, String preferredCurrency,
                           List<Expense> expenses, List<Income> incomes,
                           List<SavingsGoal> savingsGoals, List<Budget> budgets) {
        FinancialStatementAnalysis analysis = analysisService.analyze(
                user, preferredCurrency, expenses, incomes, savingsGoals, budgets);
        CurrencyFormats.Metadata curr = analysis.currency();
        String curFmt = curr.excelFormat();

        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            DefaultIndexedColorMap colorMap = new DefaultIndexedColorMap();

            // 1. Create ALL sheets in order
            XSSFSheet dashSheet = workbook.createSheet("Dashboard");
            XSSFSheet incSheet = workbook.createSheet("Incomes");
            XSSFSheet expSheet = workbook.createSheet("Expenses");
            XSSFSheet goalSheet = workbook.createSheet("Savings Goals");

            // Set tab branding colors
            dashSheet.setTabColor(new XSSFColor(FinancialStatementExcelStyles.PBI_INDIGO_ACCENT, colorMap));
            incSheet.setTabColor(new XSSFColor(FinancialStatementExcelStyles.PBI_EMERALD_GREEN, colorMap));
            expSheet.setTabColor(new XSSFColor(FinancialStatementExcelStyles.PBI_ROSE_RED, colorMap));
            goalSheet.setTabColor(new XSSFColor(FinancialStatementExcelStyles.PBI_VIOLET, colorMap));

            // Enable automatic formula calculation across all sheets
            dashSheet.setForceFormulaRecalculation(true);
            incSheet.setForceFormulaRecalculation(true);
            expSheet.setForceFormulaRecalculation(true);
            goalSheet.setForceFormulaRecalculation(true);

            FinancialStatementExcelStyles.RowStyles rowStyles =
                    styles.createRowStyles(workbook, colorMap, curFmt);
            FinancialStatementWorkbookData workbookData = new FinancialStatementWorkbookData(
                    user, expenses, incomes, savingsGoals, analysis);
            ledgerSheetWriter.write(workbook, colorMap, workbookData, rowStyles);
            dashboardSheetWriter.write(workbook, colorMap, dashSheet, workbookData, rowStyles);

            // Pre-evaluate formula cache
            try {
                XSSFFormulaEvaluator.evaluateAllFormulaCells(workbook);
            } catch (Exception evalEx) {
                log.debug("Pre-evaluating formulas note: {}", evalEx.getMessage());
            }

            workbook.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            log.error("Failed to export financial workbook to Excel for user {}", user.getId(), e);
            throw new ExportException("Error exporting financial workbook to Excel", e);
        }
    }

}
