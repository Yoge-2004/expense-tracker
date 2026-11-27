package com.example.expensetracker.domain.user.service;

import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.example.expensetracker.common.user.UserCleanupParticipant;
import com.example.expensetracker.domain.user.model.User;

/**
 * Orchestrates ordered cascading removal of user-owned domain records by delegating
 * to registered {@link UserCleanupParticipant} beans sorted by {@link UserCleanupParticipant#order()}.
 *
 * @author Yogeshwaran
 */
@Slf4j
@Service
public class UserCascadeDeletionServiceImpl implements UserCascadeDeletionService {

    private final List<UserCleanupParticipant> cleanupParticipants;

    @Autowired
    public UserCascadeDeletionServiceImpl(
            @Autowired(required = false) List<UserCleanupParticipant> cleanupParticipants) {
        this.cleanupParticipants = cleanupParticipants == null
                ? Collections.emptyList()
                : cleanupParticipants.stream()
                        .sorted(Comparator.comparingInt(UserCleanupParticipant::order))
                        .toList();
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public void cascadeDeleteUserData(Long userId, User user) {
        log.warn("Executing ordered cascade deletion for userId={} across {} participants",
                userId, cleanupParticipants.size());
        String email = user != null ? user.getEmail() : null;
        for (UserCleanupParticipant participant : cleanupParticipants) {
            participant.cleanupForUser(userId, email);
        }
        log.info("Ordered cascade deletion finished for userId={}", userId);
    }
}
