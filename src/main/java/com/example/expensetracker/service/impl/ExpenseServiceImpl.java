package com.example.expensetracker.service.impl;

import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.CategoryRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.service.ExpenseService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Service
@Transactional
public class ExpenseServiceImpl implements ExpenseService {

    private final ExpenseRepository expenseRepository;
    private final CategoryRepository categoryRepository;

    public ExpenseServiceImpl(
            ExpenseRepository expenseRepository,
            CategoryRepository categoryRepository
    ) {
        this.expenseRepository = expenseRepository;
        this.categoryRepository = categoryRepository;
    }

    @Override
    public Expense createExpense(Expense expense, User user) {
        expense.setUser(user);

        if (expense.getCategory() != null) {
            Category category = categoryRepository.findById(expense.getCategory().getId())
                    .orElseThrow(() -> new IllegalArgumentException("Invalid category ID"));

            // ✅ SECURITY CHECK: Ensure category belongs to user or is global
            if (category.getUser() != null && !category.getUser().getId().equals(user.getId())) {
                throw new IllegalArgumentException("Access Denied: You do not own this category.");
            }
            expense.setCategory(category);
        }
        return expenseRepository.save(expense);
    }

    @Override
    public List<Expense> getUserExpenses(User user) {
        return expenseRepository.findByUser(user);
    }

    @Override
    public Page<Expense> getUserExpenses(User user, Pageable pageable) {
        return expenseRepository.findByUser(user, pageable);
    }

    @Override
    public Optional<Expense> getExpenseById(Long expenseId, User user) {
        return expenseRepository.findByIdAndUser(expenseId, user);
    }

    @Override
    public List<Expense> getExpensesByDateRange(
            User user,
            LocalDate startDate,
            LocalDate endDate
    ) {
        return expenseRepository.findByUserAndExpenseDateBetween(
                user, startDate, endDate
        );
    }
}