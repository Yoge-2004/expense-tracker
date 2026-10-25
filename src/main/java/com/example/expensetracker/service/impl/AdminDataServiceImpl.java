package com.example.expensetracker.service.impl;

import com.example.expensetracker.dto.ExpenseDto;
import com.example.expensetracker.dto.IncomeDto;
import com.example.expensetracker.exception.ResourceNotFoundException;
import com.example.expensetracker.mapper.ExpenseMapper;
import com.example.expensetracker.mapper.IncomeMapper;
import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.Income;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.CategoryRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.IncomeRepository;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.service.AdminDataService;
import com.example.expensetracker.service.DatabaseSnapshotService;
import com.example.expensetracker.service.HuggingFaceDatabaseFailoverService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.SQLException;
import java.time.Instant;
import java.util.*;

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
    private final HuggingFaceDatabaseFailoverService failoverService;

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
    @Transactional(readOnly = true)
    public Map<String, Object> exportPlatformLedger() {
        Map<String, Object> dump = new LinkedHashMap<>();
        dump.put("timestamp", Instant.now().toString());

        List<User> users = userRepository.findAll();
        dump.put("totalUsers", users.size());

        List<Map<String, Object>> userList = users.stream().map(u -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", u.getId());
            map.put("name", u.getName());
            map.put("email", u.getEmail());
            map.put("role", u.getRole() != null ? u.getRole().name() : "ROLE_USER");
            map.put("currency", u.getCurrency());
            map.put("enabled", u.isEnabled());
            map.put("createdAt", u.getCreatedAt() != null ? u.getCreatedAt().toString() : null);
            return map;
        }).toList();
        dump.put("users", userList);

        List<Expense> expenses = expenseRepository.findAll();
        dump.put("totalExpensesCount", expenses.size());
        dump.put("expenses", expenses.stream().map(ExpenseMapper::toDto).toList());

        List<Income> incomes = incomeRepository.findAll();
        dump.put("totalIncomesCount", incomes.size());
        dump.put("incomes", incomes.stream().map(IncomeMapper::toDto).toList());

        List<Category> categories = categoryRepository.findAll();
        dump.put("totalCategoriesCount", categories.size());
        dump.put("categories", categories.stream().map(c -> Map.of(
                "id", c.getId(),
                "name", c.getName(),
                "isGlobal", c.getUser() == null
        )).toList());

        return dump;
    }

    @Override
    public byte[] exportSqliteSnapshot() throws IOException, SQLException {
        Path temp = Files.createTempFile("et_snapshot_", ".sqlite");
        try {
            int rows = snapshotService.exportCurrentDatabase(temp);
            log.info("Administrative snapshot generated with {} rows at {}", rows, temp);
            return Files.readAllBytes(temp);
        } finally {
            Files.deleteIfExists(temp);
        }
    }

    @Override
    public Map<String, Object> triggerManualBackup() {
        boolean success = failoverService.forceBackupCurrentDatabase();
        Map<String, Object> diag = failoverService.getDiagnostics();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", success);
        response.put("status", success ? "success" : "error");
        response.put("message", success ? "Database snapshot committed and pushed to Hugging Face Space repository."
                : "Snapshot backup skipped or failed. Reason: " + diag.get("lastError"));
        response.put("diagnostics", diag);
        return response;
    }
}
