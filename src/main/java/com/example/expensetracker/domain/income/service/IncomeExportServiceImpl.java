package com.example.expensetracker.domain.income.service;

import java.nio.charset.StandardCharsets;
import java.util.List;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.expensetracker.common.export.CsvExportSupport;
import com.example.expensetracker.domain.income.dto.IncomeDto;
import com.example.expensetracker.domain.income.mapper.IncomeMapper;
import com.example.expensetracker.domain.income.model.Income;
import com.example.expensetracker.domain.income.repository.IncomeRepository;
import com.example.expensetracker.domain.report.service.IncomeExcelReportGenerator;
import com.example.expensetracker.domain.report.service.IncomePdfReportGenerator;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.infrastructure.exception.ExportException;

/** Income-only export use cases and income persistence access. */
@Service
@Transactional(readOnly = true)
public class IncomeExportServiceImpl implements IncomeExportService {

    private final IncomeRepository incomes;
    private final ObjectMapper objectMapper;
    private final IncomePdfReportGenerator pdfGenerator;
    private final IncomeExcelReportGenerator excelGenerator;

    public IncomeExportServiceImpl(IncomeRepository incomes,
                                   ObjectMapper objectMapper,
                                   IncomePdfReportGenerator pdfGenerator,
                                   IncomeExcelReportGenerator excelGenerator) {
        this.incomes = incomes;
        this.objectMapper = objectMapper;
        this.pdfGenerator = pdfGenerator;
        this.excelGenerator = excelGenerator;
    }

    @Override
    public byte[] exportIncomesToCsv(User user) {
        List<Income> rows = incomes.findByUser(requireUser(user));
        StringBuilder csv = new StringBuilder((int) Math.min(1_000_000L, 48L + rows.size() * 112L));
        csv.append("ID,Date,Source,Amount,Description,Recurring\n");
        for (Income income : rows) {
            csv.append(income.getId()).append(',')
                    .append(income.getIncomeDate() == null ? "" : income.getIncomeDate()).append(',')
                    .append(CsvExportSupport.quotedCell(income.getSource())).append(',')
                    .append(income.getAmount() == null ? "0" : income.getAmount().toPlainString()).append(',')
                    .append(CsvExportSupport.quotedCell(income.getDescription())).append(',')
                    .append(Boolean.TRUE.equals(income.getIsRecurring())).append('\n');
        }
        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }

    @Override
    public byte[] exportIncomesToJson(User user) {
        List<IncomeDto> rows = incomes.findByUser(requireUser(user)).stream()
                .map(IncomeMapper::toDto)
                .toList();
        try {
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(rows);
        } catch (JsonProcessingException exception) {
            throw new ExportException("Error exporting incomes to JSON", exception);
        }
    }

    @Override
    public byte[] exportIncomesToPdf(User user) {
        return exportIncomesToPdf(user, null);
    }

    @Override
    public byte[] exportIncomesToPdf(User user, String preferredCurrency) {
        User validUser = requireUser(user);
        return pdfGenerator.generate(validUser, preferredCurrency, incomes.findByUser(validUser));
    }

    @Override
    public byte[] exportIncomesToExcel(User user) {
        return exportIncomesToExcel(user, null);
    }

    @Override
    public byte[] exportIncomesToExcel(User user, String preferredCurrency) {
        User validUser = requireUser(user);
        return excelGenerator.generate(validUser, preferredCurrency, incomes.findByUser(validUser));
    }

    private User requireUser(User user) {
        if (user == null) {
            throw new IllegalArgumentException("User context cannot be null");
        }
        return user;
    }
}
