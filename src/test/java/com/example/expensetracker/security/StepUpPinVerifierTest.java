package com.example.expensetracker.security;

import com.example.expensetracker.exception.BadRequestException;
import com.example.expensetracker.model.Role;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StepUpPinVerifierTest {

    @Mock UserRepository userRepository;
    @Mock PasswordEncoder passwordEncoder;
    @InjectMocks StepUpPinVerifier verifier;

    private User admin;

    @BeforeEach
    void setUp() {
        admin = User.builder()
                .id(1L).username("admin").email("admin@test.com")
                .role(Role.ROLE_ADMIN).securityPinHash("hash")
                .enabled(true).accountLocked(false).failedPinAttempts(0)
                .build();
        lenient().when(userRepository.findById(1L)).thenReturn(Optional.of(admin));
    }

    @Test
    void correctPinPasses() {
        when(passwordEncoder.matches("123456", "hash")).thenReturn(true);

        assertDoesNotThrow(() -> verifier.verify(admin, "123456"));
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void correctPinClearsEarlierFailures() {
        admin.setFailedPinAttempts(3);
        when(passwordEncoder.matches("123456", "hash")).thenReturn(true);

        verifier.verify(admin, "123456");

        assertEquals(0, admin.getFailedPinAttempts());
        verify(userRepository).save(admin);
    }

    @Test
    void wrongPinIsCountedAndRejected() {
        when(passwordEncoder.matches("000000", "hash")).thenReturn(false);

        assertThrows(BadRequestException.class, () -> verifier.verify(admin, "000000"));

        assertEquals(1, admin.getFailedPinAttempts());
        assertNull(admin.getPinLockedUntil());
        verify(userRepository).save(admin);
    }

    @Test
    void fifthWrongPinLocksTheAccountPin() {
        admin.setFailedPinAttempts(StepUpPinVerifier.MAX_FAILED_ATTEMPTS - 1);
        when(passwordEncoder.matches("000000", "hash")).thenReturn(false);

        assertThrows(BadRequestException.class, () -> verifier.verify(admin, "000000"));

        assertNotNull(admin.getPinLockedUntil());
        assertTrue(admin.getPinLockedUntil().isAfter(LocalDateTime.now().plusMinutes(StepUpPinVerifier.LOCK_MINUTES - 1)));
    }

    @Test
    void lockedPinRejectsEvenTheCorrectPin() {
        admin.setPinLockedUntil(LocalDateTime.now().plusMinutes(10));

        assertThrows(BadRequestException.class, () -> verifier.verify(admin, "123456"));

        verify(passwordEncoder, never()).matches(any(), any());
    }

    @Test
    void expiredLockIsClearedAndPinChecked() {
        admin.setFailedPinAttempts(5);
        admin.setPinLockedUntil(LocalDateTime.now().minusMinutes(1));
        when(passwordEncoder.matches("123456", "hash")).thenReturn(true);

        assertDoesNotThrow(() -> verifier.verify(admin, "123456"));

        assertEquals(0, admin.getFailedPinAttempts());
        assertNull(admin.getPinLockedUntil());
    }

    @Test
    void missingPinHashIsRejected() {
        admin.setSecurityPinHash(null);

        assertThrows(BadRequestException.class, () -> verifier.verify(admin, "123456"));
    }

    @Test
    void nullPinCountsAsWrong() {
        assertThrows(BadRequestException.class, () -> verifier.verify(admin, null));

        assertEquals(1, admin.getFailedPinAttempts());
    }
}
