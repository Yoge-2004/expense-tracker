package com.example.expensetracker.repository;

import com.example.expensetracker.model.DeviceToken;
import com.example.expensetracker.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

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
}
