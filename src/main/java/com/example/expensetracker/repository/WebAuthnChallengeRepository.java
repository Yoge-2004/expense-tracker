package com.example.expensetracker.repository;

import com.example.expensetracker.model.WebAuthnChallenge;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.Optional;

public interface WebAuthnChallengeRepository extends JpaRepository<WebAuthnChallenge, String> {
    Optional<WebAuthnChallenge> findByIdAndCeremony(String id, String ceremony);
    void deleteByExpiresAtBefore(LocalDateTime cutoff);
}
