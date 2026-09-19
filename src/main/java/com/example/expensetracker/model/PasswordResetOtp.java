package com.example.expensetracker.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.*;

import java.time.LocalDateTime;

/**
 * A one-time password (OTP) issued for auth flows such as "forgot password"
 * and email-verified signup.
 *
 * <p>The plaintext OTP is never stored — only a BCrypt hash of it, the same
 * way user passwords are stored. A row here proves that a code was issued for
 * an email address, not what the code is.</p>
 *
 * <p>Each row is single-use ({@code used}) and time-limited ({@code expiresAt}).
 * {@code attempts} tracks failed verification tries so a 6-digit code can't be
 * brute-forced. The {@code purpose} field distinguishes between flows:
 * {@code "PASSWORD_RESET"} and {@code "SIGNUP"}.</p>
 */
@Entity
@Table(name = "password_reset_otp")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PasswordResetOtp extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String email;

    @Column(nullable = false)
    private String otpHash;

    @Column(nullable = false)
    private LocalDateTime expiresAt;

    @Builder.Default
    @Column(nullable = false)
    private boolean used = false;

    @Builder.Default
    @Column(nullable = false)
    private int attempts = 0;

    /** Identifies what this OTP is for: {@code "PASSWORD_RESET"} or {@code "SIGNUP"}. */
    @Builder.Default
    @Column(nullable = false, length = 20)
    private String purpose = "PASSWORD_RESET";
}
