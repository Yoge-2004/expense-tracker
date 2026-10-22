package com.example.expensetracker.service;

import com.example.expensetracker.dto.AdminBroadcastRequest;
import com.example.expensetracker.dto.AdminBroadcastResultDto;
import com.example.expensetracker.model.User;

/**
 * Service for administrative broadcast announcements across web and push notification surfaces.
 *
 * @author Yogeshwaran
 */
public interface AdminNotificationBroadcastService {

    AdminBroadcastResultDto broadcastAnnouncement(AdminBroadcastRequest request,
                                                  User actor,
                                                  String ipAddress,
                                                  String userAgent);
}
