package com.example.expensetracker.repository;

import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Spring Data JPA repository for {@link Expense} entities.
 *
 * @author Yogeshwaran
 * @version 1.0
 * @see Expense
 */
public interface ExpenseRepository extends JpaRepository<Expense, Long> {

    @Query("SELECT e FROM Expense e LEFT JOIN FETCH e.category WHERE e.user = :user "
            + "ORDER BY e.expenseDate DESC, e.id DESC")
    List<Expense> findByUser(@Param("user") User user);

    Optional<Expense> findByIdAndUser(Long id, User user);

    List<Expense> findByUserAndExpenseDateBetween(User user, LocalDate startDate, LocalDate endDate);

    boolean existsByCategory_Id(Long categoryId);

    @Modifying
    @Query("DELETE FROM Expense e WHERE e.user.id = :userId")
    void deleteByUserId(@Param("userId") Long userId);

    @Query("SELECT COALESCE(SUM(e.amount), 0) FROM Expense e")
    BigDecimal sumTotalExpensesAmount();

    long countByUser(User user);

    @Query("SELECT COALESCE(SUM(e.amount), 0) FROM Expense e WHERE e.user = :user")
    BigDecimal sumTotalExpensesAmountByUser(@Param("user") User user);

    @Query("SELECT e FROM Expense e LEFT JOIN FETCH e.category ORDER BY e.expenseDate DESC, e.id DESC")
    org.springframework.data.domain.Page<Expense> findAllWithCategory(org.springframework.data.domain.Pageable pageable);

    @Query("SELECT e FROM Expense e LEFT JOIN FETCH e.category WHERE e.user = :user ORDER BY e.expenseDate DESC, e.id DESC")
    org.springframework.data.domain.Page<Expense> findByUserWithCategory(@Param("user") User user, org.springframework.data.domain.Pageable pageable);
}
