package com.example.expensetracker.repository;

import com.example.expensetracker.model.AdminAuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/**
 * Repository interface for managing immutable administrative audit logs.
 *
 * @author Yogeshwaran
 */
@Repository
public interface AdminAuditLogRepository extends JpaRepository<AdminAuditLog, Long> {

    Page<AdminAuditLog> findAllByOrderByCreatedAtDesc(Pageable pageable);

    @Query("SELECT a FROM AdminAuditLog a WHERE " +
           "(:hasQuery = false OR LOWER(a.actorUsername) LIKE :pattern " +
           "OR LOWER(a.action) LIKE :pattern " +
           "OR LOWER(a.targetResource) LIKE :pattern) " +
           "ORDER BY a.createdAt DESC")
    Page<AdminAuditLog> searchLogsFiltered(@Param("hasQuery") boolean hasQuery, @Param("pattern") String pattern,
                                           Pageable pageable);

    default Page<AdminAuditLog> searchLogs(String query, Pageable pageable) {
        return searchLogsFiltered(SearchPatterns.hasText(query), SearchPatterns.contains(query), pageable);
    }
}
