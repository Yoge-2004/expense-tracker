package com.example.expensetracker.repository;

import com.example.expensetracker.model.User;
import com.example.expensetracker.model.UserAppearance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserAppearanceRepository extends JpaRepository<UserAppearance, Long> {
    Optional<UserAppearance> findByUserId(Long userId);
    Optional<UserAppearance> findByUser(User user);
    void deleteByUserId(Long userId);
    void deleteByUser(User user);
}
