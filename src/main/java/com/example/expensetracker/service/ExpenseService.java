package com.example.expensetracker.service;

import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ExpenseService {

    Expense createExpense(Expense expense, User user);

    List<Expense> getUserExpenses(User user);

    Page<Expense> getUserExpenses(User user, Pageable pageable);

    Optional<Expense> getExpenseById(Long expenseId, User user);

    List<Expense> getExpensesByDateRange(
            User user,
            LocalDate startDate,
            LocalDate endDate
    );

    void deleteExpense(Long expenseId, User user);
}
