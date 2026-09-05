package com.example.expensetracker.service;

import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.*;
import com.example.expensetracker.service.impl.UserServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("UserServiceImpl Tests")
class UserServiceImplTest {

    @Mock private UserRepository userRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private ExpenseRepository expenseRepository;
    @Mock private CategoryRepository categoryRepository;
    @Mock private BudgetRepository budgetRepository;
    @Mock private RecurringExpenseRepository recurringRepository;
    @Mock private IncomeRepository incomeRepository;
    @Mock private SavingsGoalRepository savingsGoalRepository;

    @InjectMocks
    private UserServiceImpl userService;

    private User user;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setId(1L);
        user.setEmail("user@example.com");
        user.setName("Test User");
        user.setSecurityPinHash("$2a$10$hashedpin");
        user.setFailedPinAttempts(0);
    }

    @Test
    @DisplayName("verifySecurityPin should return true and reset failed attempts on correct PIN")
    void verifySecurityPin_success() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("123456", "$2a$10$hashedpin")).thenReturn(true);

        boolean result = userService.verifySecurityPin(1L, "123456");

        assertThat(result).isTrue();
        assertThat(user.getFailedPinAttempts()).isEqualTo(0);
        assertThat(user.getPinLockedUntil()).isNull();
        verify(userRepository).save(user);
    }

    @Test
    @DisplayName("verifySecurityPin should increment failed attempts and return false on wrong PIN")
    void verifySecurityPin_incorrectPin() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("999999", "$2a$10$hashedpin")).thenReturn(false);

        boolean result = userService.verifySecurityPin(1L, "999999");

        assertThat(result).isFalse();
        assertThat(user.getFailedPinAttempts()).isEqualTo(1);
        verify(userRepository).save(user);
    }

    @Test
    @DisplayName("verifySecurityPin should lock user out after 5 consecutive failures")
    void verifySecurityPin_locksOutAfterFiveFailures() {
        user.setFailedPinAttempts(4);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("999999", "$2a$10$hashedpin")).thenReturn(false);

        boolean result = userService.verifySecurityPin(1L, "999999");

        assertThat(result).isFalse();
        assertThat(user.getFailedPinAttempts()).isEqualTo(5);
        assertThat(user.getPinLockedUntil()).isNotNull();
        assertThat(user.getPinLockedUntil()).isAfter(LocalDateTime.now());
        verify(userRepository).save(user);
    }

    @Test
    @DisplayName("verifySecurityPin should reject attempts when user account is currently locked")
    void verifySecurityPin_rejectsWhenLocked() {
        user.setPinLockedUntil(LocalDateTime.now().plusMinutes(10));
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> userService.verifySecurityPin(1L, "123456"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("temporarily locked");

        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("verifySecurityPin should reject when no PIN is set")
    void verifySecurityPin_rejectsWhenNoPinSet() {
        user.setSecurityPinHash(null);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> userService.verifySecurityPin(1L, "123456"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("No security PIN has been set");
    }

    @Test
    @DisplayName("verifySecurityPin should reject invalid non-6-digit PIN format")
    void verifySecurityPin_rejectsNon6Digits() {
        assertThatThrownBy(() -> userService.verifySecurityPin(1L, "12a"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Security PIN must be exactly 6 numeric digits");

        assertThatThrownBy(() -> userService.verifySecurityPin(1L, "12345"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
