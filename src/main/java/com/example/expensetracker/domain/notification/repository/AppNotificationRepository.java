package com.example.expensetracker.domain.notification.repository;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

import com.example.expensetracker.domain.notification.model.AppNotification;
import com.example.expensetracker.domain.user.model.User;



@Repository
public interface AppNotificationRepository extends JpaRepository<AppNotification, Long> {

    List<AppNotification> findByUserOrderByCreatedAtDesc(User user, Pageable pageable);

    long countByUserAndReadAtIsNull(User user);

    boolean existsByUserAndDedupeKey(User user, String dedupeKey);

    List<AppNotification> findByUserAndReadAtIsNull(User user);

    List<AppNotification> findByUserAndIdIn(User user, Collection<Long> ids);

    @Transactional
    long deleteByCreatedAtBefore(LocalDateTime cutoff);

    @Transactional
    long deleteByUserAndId(User user, Long id);

    @Transactional
    long deleteByUser(User user);
}
