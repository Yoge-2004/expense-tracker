package com.example.expensetracker.domain.user.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.domain.user.model.UserAppearance;



@Repository
public interface UserAppearanceRepository extends JpaRepository<UserAppearance, Long> {
    Optional<UserAppearance> findByUserId(Long userId);
    Optional<UserAppearance> findByUser(User user);
    void deleteByUserId(Long userId);
    void deleteByUser(User user);
}
