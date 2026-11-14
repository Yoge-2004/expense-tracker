package com.example.expensetracker.domain.admin.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import com.example.expensetracker.domain.admin.dto.AdminPermissionsDto;
import com.example.expensetracker.domain.admin.dto.AdminUserCreateRequest;
import com.example.expensetracker.domain.admin.dto.AdminUserDetailDto;
import com.example.expensetracker.domain.admin.dto.AdminUserDto;
import com.example.expensetracker.domain.admin.dto.AdminUserRoleUpdateRequest;
import com.example.expensetracker.domain.admin.dto.AdminUserStatusUpdateRequest;
import com.example.expensetracker.domain.admin.dto.AdminUserUpdateRequest;
import com.example.expensetracker.domain.user.model.Role;
import com.example.expensetracker.domain.user.model.User;


/**
 * Service for administrative user moderation, CRUD operations, status controls, and role management.
 *
 * @author Yogeshwaran
 */
public interface AdminUserService {

    Page<AdminUserDto> getUsers(String query, Role role, Pageable pageable);

    AdminUserDetailDto getUserDetails(Long targetUserId);

    AdminUserDto createUser(AdminUserCreateRequest request, User actor, String ipAddress, String userAgent);

    AdminUserDto updateUser(Long targetUserId, AdminUserUpdateRequest request, User actor, String ipAddress, String userAgent);

    void deleteUser(Long targetUserId, String stepUpPin, User actor, String ipAddress, String userAgent);

    AdminUserDto updateUserStatus(Long targetUserId, AdminUserStatusUpdateRequest request,
                                  User actor, String ipAddress, String userAgent);

    AdminUserDto updateUserRole(Long targetUserId, AdminUserRoleUpdateRequest request,
                                User actor, String ipAddress, String userAgent);

    void resetPinLockout(Long targetUserId, User actor, String ipAddress, String userAgent);

    void revokeUserSessions(Long targetUserId, User actor, String ipAddress, String userAgent);

    AdminPermissionsDto getPermissions(User actor);
}
