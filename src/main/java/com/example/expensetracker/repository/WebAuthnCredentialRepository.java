package com.example.expensetracker.repository;

import com.example.expensetracker.model.WebAuthnCredential;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WebAuthnCredentialRepository extends JpaRepository<WebAuthnCredential, Long> {
    List<WebAuthnCredential> findByUserId(Long userId);
    Optional<WebAuthnCredential> findByCredentialId(String credentialId);
    Optional<WebAuthnCredential> findByUserHandle(String userHandle);
    Optional<WebAuthnCredential> findByCredentialIdAndUserHandle(String credentialId, String userHandle);
    boolean existsByCredentialId(String credentialId);
}
