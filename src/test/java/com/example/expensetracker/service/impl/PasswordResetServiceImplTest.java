package com.example.expensetracker.service.impl;

import com.example.expensetracker.model.PasswordResetOtp;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.PasswordResetOtpRepository;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.service.OtpDeliveryListener;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.NoSuchElementException;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PasswordResetServiceImplTest {

    @Mock private UserRepository userRepository;
    @Mock private PasswordResetOtpRepository otpRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private ObjectProvider<JavaMailSender> mailSenderProvider;
    @Mock private ObjectProvider<OtpDeliveryListener> otpDeliveryListenerProvider;

    private PasswordResetServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new PasswordResetServiceImpl(
                userRepository,
                otpRepository,
                passwordEncoder,
                mailSenderProvider,
                otpDeliveryListenerProvider
        );
    }

    @Test
    @DisplayName("requestReset throws when email is blank or missing")
    void requestReset_blankEmail_throwsException() {
        assertThrows(IllegalArgumentException.class, () -> service.requestReset("  "));
        assertThrows(IllegalArgumentException.class, () -> service.requestReset(null));
        verify(otpRepository, never()).save(any());
    }

    @Test
    @DisplayName("requestReset throws NoSuchElementException when user account not found")
    void requestReset_userNotFound_throwsException() {
        when(userRepository.findByEmailIgnoreCase("unknown@example.com")).thenReturn(Optional.empty());

        assertThrows(NoSuchElementException.class, () -> service.requestReset("unknown@example.com"));
        verify(otpRepository, never()).save(any());
    }

    @Test
    @DisplayName("requestReset creates new OTP and invalidates existing unused OTP")
    void requestReset_success() {
        User user = new User();
        user.setEmail("user@example.com");
        when(userRepository.findByEmailIgnoreCase("user@example.com")).thenReturn(Optional.of(user));

        PasswordResetOtp oldOtp = new PasswordResetOtp();
        oldOtp.setUsed(false);
        when(otpRepository.findFirstByEmailAndPurposeAndUsedFalseOrderByCreatedAtDesc("user@example.com", "PASSWORD_RESET"))
                .thenReturn(Optional.of(oldOtp));
        when(passwordEncoder.encode(anyString())).thenReturn("hashedOtp");

        service.requestReset("user@example.com");

        assertTrue(oldOtp.isUsed());
        verify(otpRepository, times(2)).save(any(PasswordResetOtp.class));
    }

    @Test
    @DisplayName("resetPassword authorizes reset via 6-digit Security PIN")
    void resetPassword_viaSecurityPin_success() {
        User user = new User();
        user.setEmail("user@example.com");
        user.setSecurityPinHash("hashedPin");

        when(userRepository.findByEmailIgnoreCase("user@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("123456", "hashedPin")).thenReturn(true);
        when(passwordEncoder.encode("NewSecretPassword")).thenReturn("newHashedPassword");

        service.resetPassword("user@example.com", "123456", "NewSecretPassword");

        assertEquals("newHashedPassword", user.getPassword());
        assertEquals(0, user.getFailedPinAttempts());
        assertNull(user.getPinLockedUntil());
        verify(userRepository).save(user);
    }

    @Test
    @DisplayName("resetPassword authorizes reset via valid Email OTP")
    void resetPassword_viaEmailOtp_success() {
        User user = new User();
        user.setEmail("user@example.com");
        user.setSecurityPinHash("differentPinHash");

        when(userRepository.findByEmailIgnoreCase("user@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("654321", "differentPinHash")).thenReturn(false);

        PasswordResetOtp otpRecord = new PasswordResetOtp();
        otpRecord.setEmail("user@example.com");
        otpRecord.setOtpHash("hashedOtp");
        otpRecord.setExpiresAt(LocalDateTime.now().plusMinutes(5));
        otpRecord.setAttempts(0);
        otpRecord.setUsed(false);

        when(otpRepository.findFirstByEmailAndPurposeAndUsedFalseOrderByCreatedAtDesc("user@example.com", "PASSWORD_RESET"))
                .thenReturn(Optional.of(otpRecord));
        when(passwordEncoder.matches("654321", "hashedOtp")).thenReturn(true);
        when(passwordEncoder.encode("NewPassword123")).thenReturn("newHashedPassword");

        service.resetPassword("user@example.com", "654321", "NewPassword123");

        assertTrue(otpRecord.isUsed());
        assertEquals("newHashedPassword", user.getPassword());
        verify(otpRepository).save(otpRecord);
        verify(userRepository).save(user);
    }

    @Test
    @DisplayName("resetPassword rejects deprecated BYPASS token")
    void resetPassword_rejectsBypassToken() {
        assertThrows(BadCredentialsException.class, () ->
                service.resetPassword("user@example.com", "BYPASS", "Password123")
        );
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("resetPassword blocks attempt when account is temporarily locked")
    void resetPassword_accountLocked_throwsBadCredentialsException() {
        User user = new User();
        user.setEmail("user@example.com");
        user.setPinLockedUntil(LocalDateTime.now().plusMinutes(10));

        when(userRepository.findByEmailIgnoreCase("user@example.com")).thenReturn(Optional.of(user));

        BadCredentialsException ex = assertThrows(BadCredentialsException.class, () ->
                service.resetPassword("user@example.com", "123456", "Password123")
        );

        assertTrue(ex.getMessage().contains("temporarily locked"));
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("sendSignupOtp skips when email is already registered")
    void sendSignupOtp_alreadyRegistered_returnsFalse() {
        when(userRepository.existsByEmail("user@example.com")).thenReturn(true);

        boolean sent = service.sendSignupOtp("user@example.com", "Existing User");

        assertFalse(sent);
        verify(otpRepository, never()).save(any());
    }

    @Test
    @DisplayName("sendSignupOtp creates OTP for new user")
    void sendSignupOtp_newUser_returnsTrue() {
        when(userRepository.existsByEmail("new@example.com")).thenReturn(false);
        when(otpRepository.findFirstByEmailAndPurposeAndUsedFalseOrderByCreatedAtDesc("new@example.com", "SIGNUP"))
                .thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hashedOtp");

        boolean sent = service.sendSignupOtp("new@example.com", "New User");

        assertTrue(sent);
        verify(otpRepository).save(any(PasswordResetOtp.class));
    }
}
