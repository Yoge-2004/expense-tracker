package com.example.expensetracker.repository;

import com.example.expensetracker.model.Income;
import com.example.expensetracker.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Spring Data JPA repository for {@link Income} entities.
 *
 * @author Yogeshwaran
 */
public interface IncomeRepository extends JpaRepository<Income, Long> {

    List<Income> findByUser(User user);

    List<Income> findByUserAndIncomeDateBetween(User user, LocalDate startDate, LocalDate endDate);

    List<Income> findByIsRecurringTrueAndNextDueDateLessThanEqual(LocalDate date);

    @Modifying
    @Query("DELETE FROM Income i WHERE i.user.id = :userId")
    void deleteByUserId(@Param("userId") Long userId);

    @Query("SELECT COALESCE(SUM(i.amount), 0) FROM Income i")
    BigDecimal sumTotalIncomesAmount();

    long countByUser(User user);

    @Query("SELECT COALESCE(SUM(i.amount), 0) FROM Income i WHERE i.user = :user")
    BigDecimal sumTotalIncomesAmountByUser(@Param("user") User user);
}
