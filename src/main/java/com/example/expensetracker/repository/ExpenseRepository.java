package com.example.expensetracker.repository;

import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ExpenseRepository extends JpaRepository<Expense, Long> {

    List<Expense> findByUser(User user);

    Page<Expense> findByUser(User user, Pageable pageable);

    List<Expense> findByUserAndExpenseDateBetween(
            User user,
            LocalDate startDate,
            LocalDate endDate
    );

    Optional<Expense> findByIdAndUser(Long id, User user);
}
