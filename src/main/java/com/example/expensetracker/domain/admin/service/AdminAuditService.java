package com.example.expensetracker.domain.admin.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import com.example.expensetracker.domain.admin.dto.AdminAuditLogDto;


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
