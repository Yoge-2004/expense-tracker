package com.example.expensetracker.domain.user.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.Optional;

import com.example.expensetracker.domain.user.model.WebAuthnChallenge;

/**
 * Spring Data JPA repository for transient {@link WebAuthnChallenge} ceremony records.
 */
public interface WebAuthnChallengeRepository extends JpaRepository<WebAuthnChallenge, String> {
    Optional<WebAuthnChallenge> findByIdAndCeremony(String id, String ceremony);
    void deleteByExpiresAtBefore(LocalDateTime cutoff);

    @Modifying
    @Query("DELETE FROM WebAuthnChallenge c WHERE c.userId = :userId")
    void deleteByUserId(@Param("userId") Long userId);
}
