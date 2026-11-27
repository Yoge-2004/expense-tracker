package com.example.expensetracker.domain.notification.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Optional;

import com.example.expensetracker.domain.notification.model.DeviceToken;
import com.example.expensetracker.domain.user.model.User;



/**
 * Spring Data JPA repository for registered push-notification {@link DeviceToken} entities.
 */
@Repository
public interface DeviceTokenRepository extends JpaRepository<DeviceToken, Long> {

    List<DeviceToken> findByUser(User user);

    Optional<DeviceToken> findByToken(String token);

    long countByUser(User user);

    @Transactional
    void deleteByToken(String token);

    @Transactional
    void deleteByTokenAndUser(String token, User user);

    @Transactional
    void deleteByUser(User user);

    @Modifying(clearAutomatically = true)
    @Transactional
    @Query("DELETE FROM DeviceToken d WHERE d.user.id = :userId")
    void deleteByUserId(@Param("userId") Long userId);
}
