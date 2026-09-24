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

@ExtendWith(MockitoExtension.class)
class UserServiceImplTest {

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
        service = new UserServiceImpl(
                userRepository,
                passwordEncoder,
                expenseRepository,
                categoryRepository,
                budgetRepository,
                recurringRepository,
                incomeRepository,
                savingsGoalRepository,
                reportLogRepository,
                webAuthnCredentialRepository
        );
    }

    @Test
    @DisplayName("registerUser succeeds and defaults currency to INR when omitted")
    void registerUser_success_defaultCurrency() {
        User user = new User();
        user.setEmail("alice@example.com");
        user.setPassword("RawPassword123");

        when(userRepository.findByEmailIgnoreCase("alice@example.com")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("RawPassword123")).thenReturn("encodedPassword");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(10L);
            return u;
        });

        User result = service.registerUser(user);

        assertNotNull(result);
        assertEquals(10L, result.getId());
        assertEquals("encodedPassword", result.getPassword());
        assertEquals("INR", result.getCurrency());
        assertTrue(result.isEnabled());
        verify(userRepository).save(user);
    }

    @Test
    @DisplayName("registerUser normalizes valid 3-letter currency to uppercase")
    void registerUser_normalizesCurrency() {
        User user = new User();
        user.setEmail("bob@example.com");
        user.setPassword("Pass12345");
        user.setCurrency("usd");

        when(userRepository.findByEmailIgnoreCase("bob@example.com")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(any())).thenReturn("hash");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        User result = service.registerUser(user);

        assertEquals("USD", result.getCurrency());
    }

    @Test
    @DisplayName("registerUser rejects invalid currency format")
    void registerUser_invalidCurrency_throwsException() {
        User user = new User();
        user.setEmail("carol@example.com");
        user.setPassword("Pass12345");
        user.setCurrency("USDOLLAR");

        when(userRepository.findByEmailIgnoreCase("carol@example.com")).thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                service.registerUser(user)
        );

        assertTrue(ex.getMessage().contains("Currency must be a 3-letter ISO 4217 code"));
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("registerUser rejects duplicate email")
    void registerUser_duplicateEmail_throwsException() {
        User existing = new User();
        existing.setId(1L);
        existing.setEmail("existing@example.com");

        User user = new User();
        user.setEmail("EXISTING@example.com");
        user.setPassword("Pass123");

        when(userRepository.findByEmailIgnoreCase("EXISTING@example.com")).thenReturn(Optional.of(existing));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                service.registerUser(user)
        );

        assertTrue(ex.getMessage().contains("User with this email already exists"));
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("registerUser rejects duplicate username")
    void registerUser_duplicateUsername_throwsException() {
        User existing = new User();
        existing.setId(1L);
        existing.setUsername("takenUser");

        User user = new User();
        user.setEmail("unique@example.com");
        user.setUsername("takenUser");
        user.setPassword("Pass123");

        when(userRepository.findByEmailIgnoreCase("unique@example.com")).thenReturn(Optional.empty());
        when(userRepository.findByUsernameIgnoreCase("takenUser")).thenReturn(Optional.of(existing));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                service.registerUser(user)
        );

        assertTrue(ex.getMessage().contains("is already taken"));
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("updateSecurityPin updates hashed PIN and resets lockout")
    void updateSecurityPin_success() {
        User user = new User();
        user.setId(20L);
        user.setFailedPinAttempts(3);
        user.setPinLockedUntil(LocalDateTime.now().plusMinutes(10));

        when(userRepository.findById(20L)).thenReturn(Optional.of(user));
        when(passwordEncoder.encode("123456")).thenReturn("hashed123456");

        service.updateSecurityPin(20L, "123456");

        assertEquals("hashed123456", user.getSecurityPinHash());
        assertEquals(0, user.getFailedPinAttempts());
        assertNull(user.getPinLockedUntil());
        verify(userRepository).save(user);
    }

    @Test
    @DisplayName("updateSecurityPin rejects non-6-digit PIN")
    void updateSecurityPin_invalidFormat_throwsException() {
        assertThrows(IllegalArgumentException.class, () -> service.updateSecurityPin(20L, "12345"));
        assertThrows(IllegalArgumentException.class, () -> service.updateSecurityPin(20L, "1234567"));
        assertThrows(IllegalArgumentException.class, () -> service.updateSecurityPin(20L, "abcdef"));
        assertThrows(IllegalArgumentException.class, () -> service.updateSecurityPin(20L, null));
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("verifySecurityPin validates matching PIN and resets failed attempts")
    void verifySecurityPin_success() {
        User user = new User();
        user.setId(30L);
        user.setSecurityPinHash("encodedPin");
        user.setFailedPinAttempts(2);

        when(userRepository.findById(30L)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("654321", "encodedPin")).thenReturn(true);

        boolean verified = service.verifySecurityPin(30L, "654321");

        assertTrue(verified);
        assertEquals(0, user.getFailedPinAttempts());
        assertNull(user.getPinLockedUntil());
        verify(userRepository).save(user);
    }

    @Test
    @DisplayName("verifySecurityPin locks out account after 5 failed attempts")
    void verifySecurityPin_locksOutAfter5Attempts() {
        User user = new User();
        user.setId(30L);
        user.setSecurityPinHash("encodedPin");
        user.setFailedPinAttempts(4);

        when(userRepository.findById(30L)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("000000", "encodedPin")).thenReturn(false);

        boolean verified = service.verifySecurityPin(30L, "000000");

        assertFalse(verified);
        assertEquals(5, user.getFailedPinAttempts());
        assertNotNull(user.getPinLockedUntil());
        assertTrue(user.getPinLockedUntil().isAfter(LocalDateTime.now()));
        verify(userRepository).save(user);
    }

    @Test
    @DisplayName("verifySecurityPin rejects attempt when lockout is still active")
    void verifySecurityPin_lockedOut_throwsIllegalStateException() {
        User user = new User();
        user.setId(30L);
        user.setSecurityPinHash("encodedPin");
        user.setPinLockedUntil(LocalDateTime.now().plusMinutes(10));

        when(userRepository.findById(30L)).thenReturn(Optional.of(user));

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                service.verifySecurityPin(30L, "123456")
        );

        assertTrue(ex.getMessage().contains("temporarily locked"));
        verify(passwordEncoder, never()).matches(any(), any());
    }

    @Test
    @DisplayName("deleteUser cascades and deletes all associated user entities")
    void deleteUser_cascadesAllData() {
        User user = new User();
        user.setId(40L);

        when(userRepository.findById(40L)).thenReturn(Optional.of(user));

        service.deleteUser(40L);

        verify(reportLogRepository).deleteByUserId(40L);
        verify(webAuthnCredentialRepository).deleteByUserId(40L);
        verify(expenseRepository).deleteByUserId(40L);
        verify(recurringRepository).deleteByUserId(40L);
        verify(incomeRepository).deleteByUserId(40L);
        verify(budgetRepository).deleteByUserId(40L);
        verify(savingsGoalRepository).deleteByUserId(40L);
        verify(categoryRepository).deleteByUserId(40L);
        verify(userRepository).delete(user);
    }

    @Test
    @DisplayName("registerUser: null user, email, or password screams IllegalArgumentException")
    void registerUser_nullOrBlankFields_throwsException() {
        assertThrows(IllegalArgumentException.class, () -> service.registerUser(null));

        User nullEmail = new User();
        nullEmail.setPassword("ValidPass123");
        assertThrows(IllegalArgumentException.class, () -> service.registerUser(nullEmail));

        User blankEmail = new User();
        blankEmail.setEmail("   ");
        blankEmail.setPassword("ValidPass123");
        assertThrows(IllegalArgumentException.class, () -> service.registerUser(blankEmail));

        User nullPass = new User();
        nullPass.setEmail("valid@example.com");
        assertThrows(IllegalArgumentException.class, () -> service.registerUser(nullPass));

        User blankPass = new User();
        blankPass.setEmail("valid@example.com");
        blankPass.setPassword("   ");
        assertThrows(IllegalArgumentException.class, () -> service.registerUser(blankPass));
    }

    @Test
    @DisplayName("operations with null userId scream IllegalArgumentException")
    void nullUserId_throwsException() {
        assertThrows(IllegalArgumentException.class, () -> service.updateSecurityPin(null, "123456"));
        assertThrows(IllegalArgumentException.class, () -> service.verifySecurityPin(null, "123456"));
        assertThrows(IllegalArgumentException.class, () -> service.updateCurrency(null, "USD"));
        assertThrows(IllegalArgumentException.class, () -> service.deleteUser(null));
    }
}
