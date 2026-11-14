package com.example.expensetracker.domain.user.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

import com.example.expensetracker.domain.user.model.PasswordResetOtp;
import com.example.expensetracker.domain.user.service.PasswordResetServiceImpl;



/**
 * Spring Data JPA repository for {@link PasswordResetOtp} entities.
 *
 * @see com.example.expensetracker.domain.user.service.PasswordResetServiceImpl
 */
public interface PasswordResetOtpRepository extends JpaRepository<PasswordResetOtp, Long> {

    /**
     * Retrieves the most recently issued, still-unused OTP for an email address
     * and a specific purpose (e.g. {@code "PASSWORD_RESET"} or {@code "SIGNUP"}).
     *
     * @param email   the account email the OTP was issued for
     * @param purpose the OTP purpose to filter by
     * @return the newest unused {@link PasswordResetOtp} row for this email + purpose, if any
     */
    Optional<PasswordResetOtp> findFirstByEmailAndPurposeAndUsedFalseOrderByCreatedAtDesc(String email, String purpose);
}
