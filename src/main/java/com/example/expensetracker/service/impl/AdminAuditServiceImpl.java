package com.example.expensetracker.service.impl;

import com.example.expensetracker.dto.AdminAuditLogDto;
import com.example.expensetracker.model.AdminAuditLog;
import com.example.expensetracker.repository.AdminAuditLogRepository;
import com.example.expensetracker.service.AdminAuditService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Implementation of {@link AdminAuditService}.
 *
 * @author Yogeshwaran
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminAuditServiceImpl implements AdminAuditService {

    private final AdminAuditLogRepository auditLogRepository;

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordAction(Long actorId, String actorUsername, String action,
                             String targetResource, String targetId, String details,
                             String ipAddress, String userAgent) {
        try {
            AdminAuditLog logEntry = AdminAuditLog.builder()
                    .actorId(actorId != null ? actorId : 0L)
                    .actorUsername(actorUsername != null ? actorUsername : "system")
                    .action(action)
                    .targetResource(targetResource)
                    .targetId(targetId)
                    .details(details != null && details.length() > 2000 ? details.substring(0, 2000) : details)
                    .ipAddress(ipAddress != null ? ipAddress : "0.0.0.0")
                    .userAgent(userAgent != null && userAgent.length() > 250 ? userAgent.substring(0, 250) : userAgent)
                    .createdAt(LocalDateTime.now())
                    .build();

            auditLogRepository.save(logEntry);
            log.info("Admin audit recorded: actor={}, action={}, target={}:{}", actorUsername, action, targetResource, targetId);
        } catch (Exception e) {
            log.error("Failed to write admin audit log entry: {}", e.getMessage(), e);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AdminAuditLogDto> getAuditLogs(String query, Pageable pageable) {
        Page<AdminAuditLog> page = (query != null && !query.isBlank())
                ? auditLogRepository.searchLogs(query.trim(), pageable)
                : auditLogRepository.findAllByOrderByCreatedAtDesc(pageable);

        return page.map(log -> new AdminAuditLogDto(
                log.getId(),
                log.getActorId(),
                log.getActorUsername(),
                log.getAction(),
                log.getTargetResource(),
                log.getTargetId(),
                log.getDetails(),
                log.getIpAddress(),
                log.getUserAgent(),
                log.getCreatedAt()
        ));
    }
}
