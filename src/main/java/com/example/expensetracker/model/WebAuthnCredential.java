package com.example.expensetracker.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "webauthn_credentials", indexes = {
    @Index(name = "idx_webauthn_credential_user", columnList = "user_id"),
    @Index(name = "idx_webauthn_user_handle", columnList = "user_handle")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WebAuthnCredential {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "credential_id", nullable = false, unique = true, length = 1024)
    private String credentialId;

    @Lob
    @Column(name = "public_key_cose", nullable = false)
    private String publicKeyCose;

    @Column(name = "user_handle", nullable = false, length = 512)
    private String userHandle;

    @Column(name = "signature_count", nullable = false)
    private long signatureCount;

    @Builder.Default
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "last_used_at")
    private LocalDateTime lastUsedAt;
}
