package com.example.expensetracker.repository;

import com.example.expensetracker.model.WebAuthnCredential;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

@SuppressWarnings("unused")
public interface WebAuthnCredentialRepository extends JpaRepository<WebAuthnCredential, Long> {
    List<WebAuthnCredential> findByUserId(Long userId);
    Optional<WebAuthnCredential> findByCredentialId(String credentialId);
    Optional<WebAuthnCredential> findByUserHandle(String userHandle);
    Optional<WebAuthnCredential> findByCredentialIdAndUserHandle(String credentialId, String userHandle);
    boolean existsByCredentialId(String credentialId);

    @Modifying
    @Query("DELETE FROM WebAuthnCredential w WHERE w.user.id = :userId")
    void deleteByUserId(@Param("userId") Long userId);
}
