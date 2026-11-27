package com.example.expensetracker.domain.income.service;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.expensetracker.common.CurrencyAwareDocumentExporter;
import com.example.expensetracker.common.export.CsvExportSupport;
import com.example.expensetracker.domain.income.dto.IncomeDto;
import com.example.expensetracker.domain.income.mapper.IncomeMapper;
import com.example.expensetracker.domain.income.model.Income;
import com.example.expensetracker.domain.income.repository.IncomeRepository;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.infrastructure.exception.ExportException;

/** Income-only export use cases and income persistence access. */
@Service
@Transactional(readOnly = true)
public class IncomeExportServiceImpl implements IncomeExportService {

    private final IncomeRepository incomes;
    private final ObjectMapper objectMapper;
    private final Map<String, CurrencyAwareDocumentExporter<User, List<Income>>> exporters;

    /**
     * Constructs the income export service wired to all registered document exporter strategies.
     *
     * @param incomes      income repository
     * @param objectMapper JSON mapper
     * @param exporters    available document exporter strategies keyed by format
     */
    @Autowired
    public IncomeExportServiceImpl(
            IncomeRepository incomes,
            ObjectMapper objectMapper,
            List<CurrencyAwareDocumentExporter<User, List<Income>>> exporters) {
        this.incomes = incomes;
        this.objectMapper = objectMapper;
        this.exporters = exporters == null
                ? Map.of()
                : exporters.stream().collect(Collectors.toMap(
                        e -> e.getFormat().toUpperCase(Locale.ROOT),
                        Function.identity(),
                        (first, _) -> first));
    }

    /**
     * Compatibility constructor accepting explicit PDF and Excel exporter abstractions.
     *
     * @param incomes       income repository
     * @param objectMapper  JSON mapper
     * @param pdfExporter   PDF exporter strategy
     * @param excelExporter Excel exporter strategy
     */
    public IncomeExportServiceImpl(
            IncomeRepository incomes,
            ObjectMapper objectMapper,
            CurrencyAwareDocumentExporter<User, List<Income>> pdfExporter,
            CurrencyAwareDocumentExporter<User, List<Income>> excelExporter) {
        this(incomes, objectMapper, List.of(pdfExporter, excelExporter));
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
        return exportWithFormat("PDF", user, preferredCurrency);
    }

    @Override
    public byte[] exportIncomesToExcel(User user) {
        return exportIncomesToExcel(user, null);
    }

    @Override
    public byte[] exportIncomesToExcel(User user, String preferredCurrency) {
        return exportWithFormat("EXCEL", user, preferredCurrency);
    }

    private byte[] exportWithFormat(String format, User user, String preferredCurrency) {
        User validUser = requireUser(user);
        CurrencyAwareDocumentExporter<User, List<Income>> exporter = exporters.get(format);
        if (exporter == null) {
            throw new ExportException("No income exporter configured for format: " + format, null);
        }
        return exporter.export(validUser, preferredCurrency, incomes.findByUser(validUser));
    }

    private User requireUser(User user) {
        if (user == null) {
            throw new IllegalArgumentException("User context cannot be null");
        }
        return user;
    }
}
