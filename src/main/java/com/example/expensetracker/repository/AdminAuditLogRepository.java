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
           "(:query IS NULL OR LOWER(a.actorUsername) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "OR LOWER(a.action) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "OR LOWER(a.targetResource) LIKE LOWER(CONCAT('%', :query, '%'))) " +
           "ORDER BY a.createdAt DESC")
    Page<AdminAuditLog> searchLogs(@Param("query") String query, Pageable pageable);
}
