package com.example.expensetracker.service.impl;

import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Lockout behaviour of {@link UserServiceImpl#verifySecurityPin(Long, String)}.
 *
 * <p>The regression these pin down: the failure counter was never reset when a lock
 * expired, so it stayed at >= 5 and a single wrong PIN after the 15 minutes were
 * served counted as failure #6 and re-locked the account for another full period.</p>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("UserServiceImpl.verifySecurityPin — lockout")
class UserServiceImplPinLockoutTest {

    private static final Long ID = 7L;

    @Mock private UserRepository userRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private ExpenseRepository expenseRepository;
    @Mock private CategoryRepository categoryRepository;
    @Mock private BudgetRepository budgetRepository;
    @Mock private RecurringExpenseRepository recurringRepository;
    @Mock private IncomeRepository incomeRepository;
    @Mock private SavingsGoalRepository savingsGoalRepository;
    @Mock private MonthlyReportLogRepository reportLogRepository;
    @Mock private WebAuthnCredentialRepository webAuthnCredentialRepository;

    private UserServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new UserServiceImpl(userRepository, passwordEncoder, expenseRepository, categoryRepository,
                budgetRepository, recurringRepository, incomeRepository, savingsGoalRepository,
                reportLogRepository, webAuthnCredentialRepository);
    }

    private User userWithPin(int failed, LocalDateTime lockedUntil) {
        User u = new User();
        u.setSecurityPinHash("PINHASH");
        u.setFailedPinAttempts(failed);
        u.setPinLockedUntil(lockedUntil);
        when(userRepository.findById(ID)).thenReturn(Optional.of(u));
        return u;
    }

    @Test
    @DisplayName("5th consecutive wrong PIN locks for 15 minutes; the 4th only counts")
    void fifthFailureLocksFourthDoesNot() {
        User u = userWithPin(3, null);
        when(passwordEncoder.matches("000000", "PINHASH")).thenReturn(false);

        assertFalse(service.verifySecurityPin(ID, "000000"));
        assertEquals(4, u.getFailedPinAttempts());
        assertNull(u.getPinLockedUntil());

        LocalDateTime before = LocalDateTime.now();
        assertFalse(service.verifySecurityPin(ID, "000000"));
        LocalDateTime after = LocalDateTime.now();
        assertEquals(5, u.getFailedPinAttempts());
        assertNotNull(u.getPinLockedUntil());
        assertFalse(u.getPinLockedUntil().isBefore(before.plusMinutes(15)));
        assertFalse(u.getPinLockedUntil().isAfter(after.plusMinutes(15)));
    }

    @Test
    @DisplayName("REGRESSION: after a lock expires, one wrong PIN is failure #1 (not #6) and does not re-lock")
    void expiredLockGrantsFreshBudget() {
        User u = userWithPin(5, LocalDateTime.now().minusMinutes(1));
        when(passwordEncoder.matches("000000", "PINHASH")).thenReturn(false);

        assertFalse(service.verifySecurityPin(ID, "000000"));

        assertEquals(1, u.getFailedPinAttempts());
        assertNull(u.getPinLockedUntil());
        verify(userRepository).save(u);
    }

    @Test
    @DisplayName("after expiry a full new run of 4 wrong PINs is tolerated and the 5th re-locks")
    void freshBudgetIsExactlyFive() {
        User u = userWithPin(5, LocalDateTime.now().minusSeconds(30));
        when(passwordEncoder.matches("000000", "PINHASH")).thenReturn(false);

        for (int i = 1; i <= 4; i++) {
            assertFalse(service.verifySecurityPin(ID, "000000"));
            assertEquals(i, u.getFailedPinAttempts());
            assertNull(u.getPinLockedUntil(), "must not be locked after failure #" + i);
        }
        assertFalse(service.verifySecurityPin(ID, "000000"));
        assertEquals(5, u.getFailedPinAttempts());
        assertNotNull(u.getPinLockedUntil());
    }

    @Test
    @DisplayName("an expired lock does not block the correct PIN, and success leaves clean counters")
    void expiredLockCorrectPinSucceeds() {
        User u = userWithPin(5, LocalDateTime.now().minusMinutes(1));
        when(passwordEncoder.matches("123456", "PINHASH")).thenReturn(true);

        assertTrue(service.verifySecurityPin(ID, "123456"));

        assertEquals(0, u.getFailedPinAttempts());
        assertNull(u.getPinLockedUntil());
    }

    @Test
    @DisplayName("while locked, even the correct PIN is refused and nothing is compared, changed or saved")
    void activeLockRefusesWithoutSideEffects() {
        LocalDateTime lockedUntil = LocalDateTime.now().plusMinutes(10);
        User u = userWithPin(5, lockedUntil);

        assertThrows(IllegalStateException.class, () -> service.verifySecurityPin(ID, "123456"));

        assertEquals(5, u.getFailedPinAttempts());
        assertEquals(lockedUntil, u.getPinLockedUntil());
        verify(passwordEncoder, never()).matches(any(), any());
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("a NULL failure-counter column (legacy row) behaves as zero: the first failure is #1")
    void nullCounterTreatedAsZero() {
        User u = userWithPin(0, null);
        org.springframework.test.util.ReflectionTestUtils.setField(u, "failedPinAttempts", null);
        when(passwordEncoder.matches("000000", "PINHASH")).thenReturn(false);

        assertFalse(service.verifySecurityPin(ID, "000000"));

        assertEquals(1, u.getFailedPinAttempts());
    }

    @Test
    @DisplayName("PIN format is validated before anything is loaded: 5 digits, 7 digits, letters, spaces, "
            + "empty, null and a trailing newline are all rejected")
    void pinFormatBoundaries() {
        for (String bad : new String[]{"12345", "1234567", "12345a", "12 456", "", null, "123456\n"}) {
            assertThrows(IllegalArgumentException.class, () -> service.verifySecurityPin(ID, bad), "pin=[" + bad + "]");
        }
        verifyNoInteractions(userRepository);
    }

    @Test
    @DisplayName("a null user id is rejected")
    void nullUserIdRejected() {
        assertThrows(IllegalArgumentException.class, () -> service.verifySecurityPin(null, "123456"));
    }
}
