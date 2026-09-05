package com.example.expensetracker.service;

import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.BudgetRepository;
import com.example.expensetracker.repository.CategoryRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.IncomeRepository;
import com.example.expensetracker.repository.RecurringExpenseRepository;
import com.example.expensetracker.repository.SavingsGoalRepository;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.service.impl.UserServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
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

    private UserServiceImpl userService;
    private User user;

    @BeforeEach
    void setUp() {
        userService = new UserServiceImpl(
                userRepository,
                passwordEncoder,
                expenseRepository,
                categoryRepository,
                budgetRepository,
                recurringRepository,
                incomeRepository,
                savingsGoalRepository
        );

        user = user(1L, "yoge@example.com");
        user.setSecurityPinHash("hashed-pin");
        user.setFailedPinAttempts(0);

        lenient().when(passwordEncoder.encode(any(String.class)))
                .thenAnswer(invocation -> "encoded:" + invocation.getArgument(0));
    }

    @Test
    void registerUser_normalizesEmailAndPersistsEncodedSecrets() {
        User newUser = user(null, "  YOGE@EXAMPLE.COM  ");
        newUser.setPassword("plain-password");
        newUser.setSecurityPinHash("123456");
        newUser.setCurrency(" usd ");

        when(userRepository.existsByEmailIgnoreCase("yoge@example.com")).thenReturn(false);
        when(userRepository.existsByUsernameIgnoreCase("yoge_26")).thenReturn(false);
        when(userRepository.save(newUser)).thenReturn(newUser);
        newUser.setUsername("  yoge_26  ");

        User saved = userService.registerUser(newUser);

        assertThat(saved.getEmail()).isEqualTo("yoge@example.com");
        assertThat(saved.getUsername()).isEqualTo("yoge_26");
        assertThat(saved.getPassword()).isEqualTo("encoded:plain-password");
        assertThat(saved.getSecurityPinHash()).isEqualTo("encoded:123456");
        assertThat(saved.getCurrency()).isEqualTo("USD");
        assertThat(saved.isEnabled()).isTrue();
        verify(userRepository).save(newUser);
    }

    @Test
    void registerUser_rejectsEmailAlreadyRegisteredCaseInsensitively() {
        User newUser = user(null, "YOGE@EXAMPLE.COM");
        newUser.setPassword("plain-password");
        when(userRepository.existsByEmailIgnoreCase("yoge@example.com")).thenReturn(true);

        assertThatThrownBy(() -> userService.registerUser(newUser))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("User with this email already exists");

        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void registerUser_rejectsDuplicateUsernameCaseInsensitively() {
        User newUser = user(null, "new@example.com");
        newUser.setPassword("plain-password");
        newUser.setUsername("Yoge_26");
        when(userRepository.existsByEmailIgnoreCase("new@example.com")).thenReturn(false);
        when(userRepository.existsByUsernameIgnoreCase("Yoge_26")).thenReturn(true);

        assertThatThrownBy(() -> userService.registerUser(newUser))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("already taken");

        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void findByIdentifier_checksEmailThenUsername() {
        when(userRepository.findByEmailIgnoreCase("yoge")).thenReturn(Optional.empty());
        when(userRepository.findByUsernameIgnoreCase("yoge")).thenReturn(Optional.of(user));

        assertThat(userService.findByIdentifier(" yoge ")).containsSame(user);
        verify(userRepository).findByEmailIgnoreCase("yoge");
        verify(userRepository).findByUsernameIgnoreCase("yoge");
    }

    @Test
    void verifySecurityPin_success_resetsLockoutState() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("123456", "hashed-pin")).thenReturn(true);

        boolean result = userService.verifySecurityPin(1L, "123456");

        assertThat(result).isTrue();
        assertThat(user.getFailedPinAttempts()).isZero();
        assertThat(user.getPinLockedUntil()).isNull();
        verify(userRepository).save(user);
    }

    @Test
    void verifySecurityPin_wrongPin_incrementsFailures() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("999999", "hashed-pin")).thenReturn(false);

        boolean result = userService.verifySecurityPin(1L, "999999");

        assertThat(result).isFalse();
        assertThat(user.getFailedPinAttempts()).isEqualTo(1);
        verify(userRepository).save(user);
    }

    @Test
    void verifySecurityPin_fifthFailure_locksForFifteenMinutes() {
        user.setFailedPinAttempts(4);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("999999", "hashed-pin")).thenReturn(false);

        assertThat(userService.verifySecurityPin(1L, "999999")).isFalse();

        assertThat(user.getFailedPinAttempts()).isEqualTo(5);
        assertThat(user.getPinLockedUntil()).isAfter(LocalDateTime.now());
        verify(userRepository).save(user);
    }

    @Test
    void verifySecurityPin_lockedAccount_doesNotChangeState() {
        user.setPinLockedUntil(LocalDateTime.now().plusMinutes(10));
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> userService.verifySecurityPin(1L, "123456"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("temporarily locked");

        verify(userRepository, never()).save(any(User.class));
        verify(passwordEncoder, never()).matches(any(String.class), any(String.class));
    }

    @Test
    void verifySecurityPin_requiresConfiguredPin() {
        user.setSecurityPinHash(null);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> userService.verifySecurityPin(1L, "123456"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("No security PIN has been set");
    }

    @Test
    void verifySecurityPin_rejectsInvalidFormatBeforeDatabaseLookup() {
        assertThatThrownBy(() -> userService.verifySecurityPin(1L, "12a"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("exactly 6 numeric digits");

        verify(userRepository, never()).findById(any());
    }

    @Test
    void deleteUser_removesDependantsBeforeUser() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(expenseRepository.findByUser(user)).thenReturn(List.of());
        when(incomeRepository.findByUser(user)).thenReturn(List.of());
        when(savingsGoalRepository.findByUser(user)).thenReturn(List.of());
        when(budgetRepository.findByUser(user)).thenReturn(List.of());
        when(recurringRepository.findByUser(user)).thenReturn(List.of());
        when(categoryRepository.findByUser(user)).thenReturn(List.of());

        userService.deleteUser(1L);

        var inOrder = inOrder(
                expenseRepository,
                incomeRepository,
                savingsGoalRepository,
                budgetRepository,
                recurringRepository,
                categoryRepository,
                userRepository
        );
        inOrder.verify(expenseRepository).deleteAll(List.of());
        inOrder.verify(incomeRepository).deleteAll(List.of());
        inOrder.verify(savingsGoalRepository).deleteAll(List.of());
        inOrder.verify(budgetRepository).deleteAll(List.of());
        inOrder.verify(recurringRepository).deleteAll(List.of());
        inOrder.verify(categoryRepository).deleteAll(List.of());
        inOrder.verify(userRepository).delete(user);
    }

    @Test
    void deleteUser_rejectsUnknownUserWithoutTouchingDependants() {
        when(userRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.deleteUser(99L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("User not found");

        verifyNoInteractions(expenseRepository, incomeRepository, savingsGoalRepository,
                budgetRepository, recurringRepository, categoryRepository);
        verify(userRepository).findById(99L);
        verify(userRepository, never()).delete(any(User.class));
    }

    @Test
    void updateCurrency_requiresThreeAlphabeticCharacters() {
        assertThatThrownBy(() -> userService.updateCurrency(1L, "USD1"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("3-letter ISO 4217 code");
        verify(userRepository, never()).findById(any());
    }

    @Test
    void updateCurrency_normalizesAndSavesUppercaseCode() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        userService.updateCurrency(1L, " eur ");

        assertThat(user.getCurrency()).isEqualTo("EUR");
        verify(userRepository).save(user);
    }

    private User user(Long id, String email) {
        User value = new User();
        value.setId(id);
        value.setName("Test User");
        value.setEmail(email);
        value.setEnabled(true);
        return value;
    }
}
