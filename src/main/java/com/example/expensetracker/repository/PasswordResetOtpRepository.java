package com.example.expensetracker.repository;

import com.example.expensetracker.model.PasswordResetOtp;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * Spring Data JPA repository for {@link PasswordResetOtp} entities.
 *
 * @see com.example.expensetracker.service.impl.PasswordResetServiceImpl
 */
public interface PasswordResetOtpRepository extends JpaRepository<PasswordResetOtp, Long> {

    /**
     * Retrieves the most recently issued, still-unused OTP for an email address.
     *
     * <p>Used both to verify a submitted code during reset and to invalidate
     * any still-open code when a new one is requested.</p>
     *
     * @param email the account email the OTP was issued for
     * @return the newest unused {@link PasswordResetOtp} row for this email, if any
     */
    Optional<PasswordResetOtp> findFirstByEmailAndUsedFalseOrderByCreatedAtDesc(String email);
}
