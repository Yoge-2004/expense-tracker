package com.example.expensetracker.domain.notification.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

import com.example.expensetracker.domain.notification.model.NotificationPreference;
import com.example.expensetracker.domain.user.model.User;



@Repository
public interface NotificationPreferenceRepository extends JpaRepository<NotificationPreference, Long> {

    Optional<NotificationPreference> findByUser(User user);

    void deleteByUser(User user);
}
