package com.example.expensetracker.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "webauthn_challenges", indexes = {
    @Index(name = "idx_webauthn_challenge_expires", columnList = "expires_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WebAuthnChallenge {
    @Id
    @Column(length = 64)
    private String id;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "ceremony", nullable = false, length = 20)
    private String ceremony;

    @Lob
    @Column(name = "request_json", nullable = false)
    private String requestJson;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;
}
