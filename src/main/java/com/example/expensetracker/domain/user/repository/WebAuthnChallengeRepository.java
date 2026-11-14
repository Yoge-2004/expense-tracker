package com.example.expensetracker.domain.user.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDateTime;
import java.util.Optional;

import com.example.expensetracker.domain.user.model.WebAuthnChallenge;



public interface WebAuthnChallengeRepository extends JpaRepository<WebAuthnChallenge, String> {
    Optional<WebAuthnChallenge> findByIdAndCeremony(String id, String ceremony);
    void deleteByExpiresAtBefore(LocalDateTime cutoff);
}
