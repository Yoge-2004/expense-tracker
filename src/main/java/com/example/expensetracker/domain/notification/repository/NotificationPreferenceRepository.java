package com.example.expensetracker.domain.notification.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.Optional;

import com.example.expensetracker.domain.notification.model.NotificationPreference;
import com.example.expensetracker.domain.user.model.User;



/**
 * Spring Data JPA repository for per-user {@link NotificationPreference} settings.
 */
@Repository
public interface NotificationPreferenceRepository extends JpaRepository<NotificationPreference, Long> {

    Optional<NotificationPreference> findByUser(User user);

    void deleteByUser(User user);

    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM NotificationPreference p WHERE p.user.id = :userId")
    void deleteByUserId(@Param("userId") Long userId);
}
