package com.example.expensetracker.service;

import com.example.expensetracker.dto.AdminDatabaseTopologyDto;
import com.example.expensetracker.model.User;

import java.util.Map;

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
