package com.example.expensetracker.domain.admin.service;

import java.util.Map;

import com.example.expensetracker.domain.admin.dto.AdminDatabaseTopologyDto;
import com.example.expensetracker.domain.user.model.User;



/**
 * Service for administrative resilience monitoring, cluster database topology,
 * and Hugging Face snapshot failover operations.
 *
 * @author Yogeshwaran
 */
public interface AdminResilienceService {

    Map<String, Object> getResilienceStatus();

    AdminDatabaseTopologyDto getDatabaseTopology();

    boolean triggerSnapshotBackup(User actor, String stepUpPin, String ipAddress, String userAgent);
}
