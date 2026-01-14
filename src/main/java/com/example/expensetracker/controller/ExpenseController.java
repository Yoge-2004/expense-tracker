package com.example.expensetracker.controller;

import com.example.expensetracker.dto.ExpenseDto;
import com.example.expensetracker.dto.ExpenseRequest;
import com.example.expensetracker.mapper.ExpenseMapper;
import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.User;
import com.example.expensetracker.service.ExpenseService;
import com.example.expensetracker.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/expenses")
public class ExpenseController {

    private final ExpenseService expenseService;
    private final UserService userService;

    public ExpenseController(ExpenseService expenseService,
                             UserService userService) {
        this.expenseService = expenseService;
        this.userService = userService;
    }

    @PostMapping("/user/{userId}")
    public ResponseEntity<ExpenseDto> createExpense(
            @PathVariable Long userId,
            @Valid @RequestBody ExpenseRequest request) {

        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        Expense expense = new Expense();
        expense.setAmount(request.getAmount());
        expense.setDescription(request.getDescription());
        expense.setExpenseDate(request.getExpenseDate());

        Category category = new Category();
        category.setId(request.getCategoryId());
        expense.setCategory(category);

        Expense savedExpense = expenseService.createExpense(expense, user);

        return new ResponseEntity<>(
                ExpenseMapper.toDto(savedExpense),
                HttpStatus.CREATED
        );
    }


    @GetMapping("/user/{userId}")
    public ResponseEntity<List<ExpenseDto>> getExpenses(
            @PathVariable Long userId) {

        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        List<ExpenseDto> expenses = expenseService
                .getUserExpenses(user)
                .stream()
                .map(ExpenseMapper::toDto)
                .collect(Collectors.toList());

        return ResponseEntity.ok(expenses);
    }

    @DeleteMapping("/{expenseId}/user/{userId}") // ✅ Add this endpoint
    public ResponseEntity<Void> deleteExpense(
            @PathVariable Long userId,
            @PathVariable Long expenseId) {

        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        expenseService.deleteExpense(expenseId, user);

        return ResponseEntity.noContent().build();
    }
}
