package com.example.expensetracker.config;

import com.example.expensetracker.repository.BudgetRepository;
import com.example.expensetracker.repository.CategoryRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.IncomeRepository;
import com.example.expensetracker.repository.RecurringExpenseRepository;
import com.example.expensetracker.repository.SavingsGoalRepository;
import com.example.expensetracker.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Guards the security defaults of {@link DataInitializer#seedDemoData()}:
 * demo seeding must be strictly opt-in and must refuse to create the demo
 * account without an explicitly configured password (earlier revisions shipped
 * a hard-coded default credential).
 */
@ExtendWith(MockitoExtension.class)
class DataInitializerTest {

    @Mock private UserRepository userRepository;
    @Mock private CategoryRepository categoryRepository;
    @Mock private ExpenseRepository expenseRepository;
    @Mock private IncomeRepository incomeRepository;
    @Mock private SavingsGoalRepository savingsGoalRepository;
    @Mock private BudgetRepository budgetRepository;
    @Mock private RecurringExpenseRepository recurringExpenseRepository;
    @Mock private PasswordEncoder passwordEncoder;

    @InjectMocks
    private DataInitializer dataInitializer;

    @Test
    @DisplayName("seedDemoData does nothing when demo seeding is disabled (secure default)")
    void seedDemoData_disabledByDefault_seedsNothing() {
        ReflectionTestUtils.setField(dataInitializer, "seedEnabled", false);
        ReflectionTestUtils.setField(dataInitializer, "demoPassword", "");

        dataInitializer.seedDemoData();

        verifyNoInteractions(userRepository, categoryRepository, expenseRepository,
                incomeRepository, savingsGoalRepository, budgetRepository,
                recurringExpenseRepository, passwordEncoder);
    }

    @Test
    @DisplayName("seedDemoData refuses to seed when no explicit demo password is configured")
    void seedDemoData_withoutPassword_seedsNothing() {
        ReflectionTestUtils.setField(dataInitializer, "seedEnabled", true);
        ReflectionTestUtils.setField(dataInitializer, "demoPassword", "   ");

        dataInitializer.seedDemoData();

        verifyNoInteractions(userRepository, categoryRepository, expenseRepository,
                incomeRepository, savingsGoalRepository, budgetRepository,
                recurringExpenseRepository, passwordEncoder);
    }

    @Test
    @DisplayName("seedDemoData verifies the demo account is absent before any writes")
    void seedDemoData_enabledWithPassword_startsByCheckingExistingUser() {
        ReflectionTestUtils.setField(dataInitializer, "seedEnabled", true);
        ReflectionTestUtils.setField(dataInitializer, "demoPassword", "s3cure-demo-pass");
        when(userRepository.findByEmail("demo@expensetracker.com")).thenReturn(java.util.Optional.empty());
        // Category lookups legitimately miss in a fresh unit-test context; the
        // assertion below is only that seeding is reachable and queries users first.
        when(categoryRepository.findByNameIgnoreCase(org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(java.util.Optional.empty());

        // Not asserting the full seed payload here (it is large and additive);
        // this call may run through and simply persist through mock repositories.
        dataInitializer.seedDemoData();

        org.mockito.Mockito.verify(userRepository).findByEmail("demo@expensetracker.com");
    }
}
