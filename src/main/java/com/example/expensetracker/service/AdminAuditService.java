package com.example.expensetracker.service;

import com.example.expensetracker.dto.AdminAuditLogDto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/**
 * Service for recording and querying administrative audit trails.
 *
 * @author Yogeshwaran
 */
public interface AdminAuditService {

    void recordAction(Long actorId, String actorUsername, String action,
                      String targetResource, String targetId, String details,
                      String ipAddress, String userAgent);

    Page<AdminAuditLogDto> getAuditLogs(String query, Pageable pageable);
}
