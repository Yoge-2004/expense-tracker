package com.example.expensetracker.repository;

import com.example.expensetracker.model.MonthlyReportLog;
import com.example.expensetracker.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface MonthlyReportLogRepository extends JpaRepository<MonthlyReportLog, Long> {
    boolean existsByUserAndReportYearAndReportMonthAndSentSuccessfullyTrue(User user, int reportYear, int reportMonth);
    Optional<MonthlyReportLog> findByUserAndReportYearAndReportMonth(User user, int reportYear, int reportMonth);
}
