package com.example.expensetracker.domain.admin.service;

import com.fasterxml.jackson.core.JsonEncoding;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.SQLException;
import java.time.Instant;
import java.util.*;
import java.util.function.Function;

import com.example.expensetracker.domain.expense.dto.ExpenseDto;
import com.example.expensetracker.domain.expense.mapper.ExpenseMapper;
import com.example.expensetracker.domain.expense.model.Category;
import com.example.expensetracker.domain.expense.repository.CategoryRepository;
import com.example.expensetracker.domain.expense.repository.ExpenseRepository;
import com.example.expensetracker.domain.income.dto.IncomeDto;
import com.example.expensetracker.domain.income.mapper.IncomeMapper;
import com.example.expensetracker.domain.income.repository.IncomeRepository;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.domain.user.repository.UserRepository;
import com.example.expensetracker.infrastructure.exception.ResourceNotFoundException;
import com.example.expensetracker.infrastructure.resilience.DatabaseSnapshotService;
import com.example.expensetracker.infrastructure.exception.BadRequestException;
import com.example.expensetracker.infrastructure.exception.ForbiddenException;
import com.example.expensetracker.domain.user.security.StepUpPinVerifier;



/**
 * Implementation of {@link AdminDataService} enabling full administrative data transparency,
 * cross-tenant ledger queries, and real-time database snapshot generation.
 *
 * @author Yogeshwaran
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminDataServiceImpl implements AdminDataService {

    private final ExpenseRepository expenseRepository;
    private final IncomeRepository incomeRepository;
    private final UserRepository userRepository;
    private final CategoryRepository categoryRepository;
    private final DatabaseSnapshotService snapshotService;
    private final AdminAuditService auditService;
    private final StepUpPinVerifier stepUpPinVerifier;
    private final ObjectMapper objectMapper;

    /** Rows read per query when streaming the platform ledger. */
    private static final int LEDGER_PAGE_SIZE = 500;

    @Override
    @Transactional(readOnly = true)
    public Page<ExpenseDto> getAllExpenses(Long userId, Pageable pageable) {
        if (userId != null) {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new ResourceNotFoundException("User not found with id=" + userId));
            return expenseRepository.findByUserWithCategory(user, pageable).map(ExpenseMapper::toDto);
        }
        return expenseRepository.findAllWithCategory(pageable).map(ExpenseMapper::toDto);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<IncomeDto> getAllIncomes(Long userId, Pageable pageable) {
        if (userId != null) {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new ResourceNotFoundException("User not found with id=" + userId));
            return incomeRepository.findByUserIncomes(user, pageable).map(IncomeMapper::toDto);
        }
        return incomeRepository.findAllIncomes(pageable).map(IncomeMapper::toDto);
    }

    @Override
    public void writePlatformLedger(OutputStream out) throws IOException {
        // No wrapping transaction on purpose: each repository call below runs in its own short one,
        // so loaded rows are released after every page instead of piling up in memory.
        try (JsonGenerator json = objectMapper.getFactory().createGenerator(out, JsonEncoding.UTF8)) {
            json.writeStartObject();
            json.writeStringField("timestamp", Instant.now().toString());

            long users = writePaged(json, "users", Sort.by("id"),
                    userRepository::findAll, AdminDataServiceImpl::toLedgerUser);
            json.writeNumberField("totalUsers", users);

            // These two queries already define their own ORDER BY, so no extra sort is applied.
            long expenses = writePaged(json, "expenses", Sort.unsorted(),
                    expenseRepository::findAllWithCategory, ExpenseMapper::toDto);
            json.writeNumberField("totalExpensesCount", expenses);

            long incomes = writePaged(json, "incomes", Sort.unsorted(),
                    incomeRepository::findAllIncomes, IncomeMapper::toDto);
            json.writeNumberField("totalIncomesCount", incomes);

            long categories = writePaged(json, "categories", Sort.by("id"),
                    categoryRepository::findAll, AdminDataServiceImpl::toLedgerCategory);
            json.writeNumberField("totalCategoriesCount", categories);

            json.writeEndObject();
        }
    }

    /**
     * Writes one JSON array named {@code field}, reading {@link #LEDGER_PAGE_SIZE} rows at a time.
     *
     * @return how many rows were written
     */
    private <T, R> long writePaged(JsonGenerator json, String field, Sort sort,
                                   Function<Pageable, Page<T>> source,
                                   Function<T, R> mapper) throws IOException {
        json.writeArrayFieldStart(field);
        long written = 0;
        int pageIndex = 0;
        Page<T> page;
        do {
            page = source.apply(PageRequest.of(pageIndex++, LEDGER_PAGE_SIZE, sort));
            for (T row : page.getContent()) {
                objectMapper.writeValue(json, mapper.apply(row));
                written++;
            }
        } while (page.hasNext());
        json.writeEndArray();
        return written;
    }

    private static Map<String, Object> toLedgerUser(User u) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", u.getId());
        map.put("name", u.getName());
        map.put("email", u.getEmail());
        map.put("role", u.getRole() != null ? u.getRole().name() : "ROLE_USER");
        map.put("currency", u.getCurrency());
        map.put("enabled", u.isEnabled());
        map.put("createdAt", u.getCreatedAt() != null ? u.getCreatedAt().toString() : null);
        return map;
    }

    private static Map<String, Object> toLedgerCategory(Category c) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", c.getId());
        map.put("name", c.getName());
        map.put("isGlobal", c.getUser() == null);
        return map;
    }

    @Override
    public Path createSqliteSnapshotFile() throws IOException, SQLException {
        Path temp = Files.createTempFile("et_snapshot_", ".sqlite");
        try {
            int rows = snapshotService.exportCurrentDatabase(temp);
            log.info("Administrative snapshot generated with {} rows at {}", rows, temp);
            return temp;
        } catch (IOException | SQLException | RuntimeException e) {
            Files.deleteIfExists(temp);
            throw e;
        }
    }

    @Override
    public void authorizeBulkExport(User actor, String stepUpPin, String action, String ipAddress, String userAgent) {
        if (actor == null || !actor.isSuperAdmin()) {
            throw new ForbiddenException("Only a Super Admin may export platform data");
        }
        if (stepUpPin == null || stepUpPin.isBlank()) {
            throw new BadRequestException("Security PIN is required to export platform data");
        }
        stepUpPinVerifier.verify(actor, stepUpPin);

        auditService.recordAction(
                actor.getId(),
                actor.getUsername() != null ? actor.getUsername() : actor.getEmail(),
                action,
                "PLATFORM_DATA",
                action,
                "Bulk platform export authorised",
                ipAddress,
                userAgent);
    }
}
