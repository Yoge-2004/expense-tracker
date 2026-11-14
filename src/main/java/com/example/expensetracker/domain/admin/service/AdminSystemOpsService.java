package com.example.expensetracker.domain.admin.service;

import java.util.List;

import com.example.expensetracker.domain.admin.dto.AdminLogEntryDto;
import com.example.expensetracker.domain.admin.dto.AdminTelemetryDto;
import com.example.expensetracker.domain.user.model.User;



/**
 * Service for system observability, live telemetry inspection,
 * runtime cache management, and compliance log export.
 *
 * @author Yogeshwaran
 */
public interface AdminSystemOpsService {

    AdminTelemetryDto getTelemetry();

    void purgeCaches(User actor, String ipAddress, String userAgent);

    String exportAuditLogsCsv();

    List<AdminLogEntryDto> getApplicationLogs(int lines, String level, String query);
}
