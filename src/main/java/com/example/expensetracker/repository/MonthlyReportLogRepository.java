package com.example.expensetracker.repository;

import com.example.expensetracker.model.MonthlyReportLog;
import com.example.expensetracker.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repository for {@link MonthlyReportLog} audit rows — used both to check
 * whether a report has already been successfully sent for a given user and
 * period (avoiding duplicate sends from the scheduled automated job) and to
 * find/update the existing log row rather than inserting a duplicate.
 */
@Repository
public interface MonthlyReportLogRepository extends JpaRepository<MonthlyReportLog, Long> {

    /**
     * Checks whether a monthly report has already been successfully sent to
     * this user for this exact year/month — used to guard against sending
     * the same report twice if the automated job runs more than once.
     */
    boolean existsByUserAndReportYearAndReportMonthAndSentSuccessfullyTrue(User user, int reportYear, int reportMonth);

    /**
     * Finds the existing log row for a user/period, if one exists — used to
     * update it in place (per the unique constraint on the entity) rather
     * than ever inserting a second row for the same period.
     */
    Optional<MonthlyReportLog> findByUserAndReportYearAndReportMonth(User user, int reportYear, int reportMonth);
}
