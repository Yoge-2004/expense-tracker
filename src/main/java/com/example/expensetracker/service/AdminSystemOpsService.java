package com.example.expensetracker.service;

import com.example.expensetracker.dto.AdminLogEntryDto;
import com.example.expensetracker.dto.AdminTelemetryDto;
import com.example.expensetracker.model.User;

import java.util.List;

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
