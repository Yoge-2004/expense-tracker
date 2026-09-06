package com.example.expensetracker.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "webauthn_challenges", indexes = {
    @Index(name = "idx_webauthn_challenge_expires", columnList = "expires_at")
})
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

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getCeremony() { return ceremony; }
    public void setCeremony(String ceremony) { this.ceremony = ceremony; }
    public String getRequestJson() { return requestJson; }
    public void setRequestJson(String requestJson) { this.requestJson = requestJson; }
    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }
}
