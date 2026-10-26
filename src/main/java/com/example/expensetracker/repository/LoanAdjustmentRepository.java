package com.example.expensetracker.repository;

import com.example.expensetracker.model.LoanAdjustment;
import com.example.expensetracker.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for managing {@link LoanAdjustment} persistence.
 *
 * @author Yogeshwaran
 */
@Repository
public interface LoanAdjustmentRepository extends JpaRepository<LoanAdjustment, Long> {

    @Query("SELECT l FROM LoanAdjustment l LEFT JOIN FETCH l.expense WHERE l.user = :user ORDER BY l.adjustmentDate DESC, l.id DESC")
    List<LoanAdjustment> findByUserOrderByAdjustmentDateDescIdDesc(@Param("user") User user);

    @Query("SELECT l FROM LoanAdjustment l LEFT JOIN FETCH l.expense WHERE l.user = :user AND l.isSettled = :isSettled ORDER BY l.adjustmentDate DESC, l.id DESC")
    List<LoanAdjustment> findByUserAndIsSettledOrderByAdjustmentDateDescIdDesc(@Param("user") User user, @Param("isSettled") Boolean isSettled);

    @Query("SELECT l FROM LoanAdjustment l LEFT JOIN FETCH l.expense WHERE l.id = :id AND l.user = :user")
    Optional<LoanAdjustment> findByIdAndUser(@Param("id") Long id, @Param("user") User user);

    long countByUser(User user);

    long countByUserAndIsSettled(User user, Boolean isSettled);

    void deleteByUser(User user);
}
