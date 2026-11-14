package com.example.expensetracker.domain.admin.service;

import com.example.expensetracker.domain.admin.dto.AdminBroadcastRequest;
import com.example.expensetracker.domain.admin.dto.AdminBroadcastResultDto;
import com.example.expensetracker.domain.user.model.User;


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
