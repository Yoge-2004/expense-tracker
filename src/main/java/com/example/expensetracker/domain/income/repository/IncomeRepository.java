package com.example.expensetracker.domain.income.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import com.example.expensetracker.domain.income.model.Income;
import com.example.expensetracker.domain.user.model.User;



/**
 * Spring Data JPA repository for {@link Income} entities.
 *
 * @author Yogeshwaran
 */
public interface IncomeRepository extends JpaRepository<Income, Long> {

    @Query("SELECT i FROM Income i WHERE i.user = :user ORDER BY i.incomeDate DESC, i.id DESC")
    List<Income> findByUser(@Param("user") User user);

    @Query("SELECT i FROM Income i WHERE i.user = :user AND i.incomeDate BETWEEN :startDate AND :endDate ORDER BY i.incomeDate DESC, i.id DESC")
    List<Income> findByUserAndIncomeDateBetween(@Param("user") User user, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    @Query("SELECT i FROM Income i WHERE i.user = :user AND i.incomeDate >= :startDate ORDER BY i.incomeDate DESC, i.id DESC")
    List<Income> findByUserAndIncomeDateGreaterThanEqual(@Param("user") User user, @Param("startDate") LocalDate startDate);

    @Query("SELECT i FROM Income i WHERE i.user = :user AND i.incomeDate <= :endDate ORDER BY i.incomeDate DESC, i.id DESC")
    List<Income> findByUserAndIncomeDateLessThanEqual(@Param("user") User user, @Param("endDate") LocalDate endDate);

    List<Income> findByIsRecurringTrueAndNextDueDateLessThanEqual(LocalDate date);

    @Modifying
    @Query("DELETE FROM Income i WHERE i.user.id = :userId")
    void deleteByUserId(@Param("userId") Long userId);

    @Query("SELECT COALESCE(SUM(i.amount), 0) FROM Income i")
    BigDecimal sumTotalIncomesAmount();

    long countByUser(User user);

    Optional<Income> findByIdAndUser(Long id, User user);

    @Query("SELECT COALESCE(SUM(i.amount), 0) FROM Income i WHERE i.user = :user")
    BigDecimal sumTotalIncomesAmountByUser(@Param("user") User user);

    @Query(value = "SELECT i FROM Income i ORDER BY i.incomeDate DESC, i.id DESC",
           countQuery = "SELECT COUNT(i) FROM Income i")
    org.springframework.data.domain.Page<Income> findAllIncomes(org.springframework.data.domain.Pageable pageable);

    @Query(value = "SELECT i FROM Income i WHERE i.user = :user ORDER BY i.incomeDate DESC, i.id DESC",
           countQuery = "SELECT COUNT(i) FROM Income i WHERE i.user = :user")
    org.springframework.data.domain.Page<Income> findByUserIncomes(@Param("user") User user, org.springframework.data.domain.Pageable pageable);

    @Query("""
            SELECT i FROM Income i
            WHERE i.user = :user
              AND UPPER(TRIM(i.kind)) = 'REIMBURSEMENT'
              AND i.reimbursedCategoryId IS NOT NULL
              AND i.incomeDate BETWEEN :startDate AND :endDate""")
    List<Income> findReimbursementsByUserAndIncomeDateBetween(
            @Param("user") User user,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);
}
