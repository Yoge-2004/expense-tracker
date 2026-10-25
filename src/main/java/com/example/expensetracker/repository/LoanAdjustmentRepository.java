package com.example.expensetracker.repository;

import com.example.expensetracker.model.LoanAdjustment;
import com.example.expensetracker.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
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

    List<LoanAdjustment> findByUserOrderByAdjustmentDateDescIdDesc(User user);

    List<LoanAdjustment> findByUserAndIsSettledOrderByAdjustmentDateDescIdDesc(User user, Boolean isSettled);

    Optional<LoanAdjustment> findByIdAndUser(Long id, User user);

    long countByUser(User user);

    long countByUserAndIsSettled(User user, Boolean isSettled);

    void deleteByUser(User user);
}
