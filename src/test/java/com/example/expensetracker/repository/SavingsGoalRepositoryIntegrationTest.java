package com.example.expensetracker.repository;

import com.example.expensetracker.model.Role;
import com.example.expensetracker.model.SavingsGoal;
import com.example.expensetracker.model.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Genuine integration test against a real SQL database engine (H2 PostgreSQL mode)
 * testing custom JPQL queries, atomic increments, tenant isolation, and cascades.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class SavingsGoalRepositoryIntegrationTest {

    @Autowired
    private SavingsGoalRepository savingsGoalRepository;

    @Autowired
    private UserRepository userRepository;

    private User userA;
    private User userB;

    @BeforeEach
    void setUp() {
        userA = userRepository.save(User.builder()
                .name("Alice Tenant")
                .username("alice_repo_" + System.currentTimeMillis())
                .email("alice_repo_" + System.currentTimeMillis() + "@test.com")
                .password("SecureP@ss123")
                .role(Role.ROLE_USER)
                .enabled(true)
                .build());

        userB = userRepository.save(User.builder()
                .name("Bob Tenant")
                .username("bob_repo_" + System.currentTimeMillis())
                .email("bob_repo_" + System.currentTimeMillis() + "@test.com")
                .password("SecureP@ss123")
                .role(Role.ROLE_USER)
                .enabled(true)
                .build());
    }

    @Test
    @DisplayName("addToCurrentAmount atomically increments balance for matching owner")
    void addToCurrentAmount_success() {
        SavingsGoal goal = savingsGoalRepository.save(SavingsGoal.builder()
                .name("House Fund")
                .targetAmount(new BigDecimal("50000.00"))
                .currentAmount(new BigDecimal("10000.00"))
                .user(userA)
                .status("IN_PROGRESS")
                .build());

        int updated = savingsGoalRepository.addToCurrentAmount(goal.getId(), userA, new BigDecimal("2500.50"));
        assertEquals(1, updated, "Should update exactly 1 row");

        SavingsGoal reloaded = savingsGoalRepository.findById(goal.getId()).orElseThrow();
        assertEquals(new BigDecimal("12500.50"), reloaded.getCurrentAmount());
    }

    @Test
    @DisplayName("addToCurrentAmount increments balance starting from zero balance")
    void addToCurrentAmount_startingFromZero() {
        SavingsGoal goal = savingsGoalRepository.save(SavingsGoal.builder()
                .name("Car Fund")
                .targetAmount(new BigDecimal("20000.00"))
                .currentAmount(BigDecimal.ZERO)
                .user(userA)
                .status("IN_PROGRESS")
                .build());

        int updated = savingsGoalRepository.addToCurrentAmount(goal.getId(), userA, new BigDecimal("1500.00"));
        assertEquals(1, updated);

        SavingsGoal reloaded = savingsGoalRepository.findById(goal.getId()).orElseThrow();
        assertEquals(new BigDecimal("1500.00"), reloaded.getCurrentAmount());
    }

    @Test
    @DisplayName("addToCurrentAmount enforces strict tenant isolation - User B cannot mutate User A's goal")
    void addToCurrentAmount_tenantIsolationEnforced() {
        SavingsGoal goalA = savingsGoalRepository.save(SavingsGoal.builder()
                .name("Alice Private Fund")
                .targetAmount(new BigDecimal("10000.00"))
                .currentAmount(new BigDecimal("1000.00"))
                .user(userA)
                .status("IN_PROGRESS")
                .build());

        // User B attempts to mutate User A's goal
        int updated = savingsGoalRepository.addToCurrentAmount(goalA.getId(), userB, new BigDecimal("500.00"));
        assertEquals(0, updated, "Query must update 0 rows when tenant does not match");

        SavingsGoal reloaded = savingsGoalRepository.findById(goalA.getId()).orElseThrow();
        assertEquals(new BigDecimal("1000.00"), reloaded.getCurrentAmount(), "Balance must remain unchanged");
    }

    @Test
    @DisplayName("addToCurrentAmount returns 0 for non-existent goal ID")
    void addToCurrentAmount_nonExistentGoal_returnsZero() {
        int updated = savingsGoalRepository.addToCurrentAmount(999999L, userA, new BigDecimal("100.00"));
        assertEquals(0, updated);
    }

    @Test
    @DisplayName("deleteByUserId purges only the specified user's goals without collateral damage")
    void deleteByUserId_strictScoping() {
        savingsGoalRepository.save(SavingsGoal.builder()
                .name("Alice Goal 1")
                .targetAmount(new BigDecimal("1000.00"))
                .user(userA)
                .build());
        savingsGoalRepository.save(SavingsGoal.builder()
                .name("Alice Goal 2")
                .targetAmount(new BigDecimal("2000.00"))
                .user(userA)
                .build());

        savingsGoalRepository.save(SavingsGoal.builder()
                .name("Bob Goal 1")
                .targetAmount(new BigDecimal("3000.00"))
                .user(userB)
                .build());

        assertEquals(2, savingsGoalRepository.findByUser(userA).size());
        assertEquals(1, savingsGoalRepository.findByUser(userB).size());

        savingsGoalRepository.deleteByUserId(userA.getId());

        assertEquals(0, savingsGoalRepository.findByUser(userA).size(), "Alice's goals must be completely deleted");
        assertEquals(1, savingsGoalRepository.findByUser(userB).size(), "Bob's goals must remain untouched");
    }

    @Test
    @DisplayName("findByIsRecurringTrueAndNextDueDateLessThanEqual respects recurring flag and due threshold")
    void findRecurringDueGoals_accurateFiltering() {
        LocalDate today = LocalDate.now();

        // Goal 1: Recurring & Due today -> MUST MATCH
        SavingsGoal dueRecurring = savingsGoalRepository.save(SavingsGoal.builder()
                .name("Due Recurring")
                .targetAmount(new BigDecimal("5000.00"))
                .user(userA)
                .isRecurring(true)
                .nextDueDate(today)
                .build());

        // Goal 2: Recurring & Due in past -> MUST MATCH
        SavingsGoal pastDueRecurring = savingsGoalRepository.save(SavingsGoal.builder()
                .name("Past Due Recurring")
                .targetAmount(new BigDecimal("5000.00"))
                .user(userA)
                .isRecurring(true)
                .nextDueDate(today.minusDays(2))
                .build());

        // Goal 3: Recurring & Future -> MUST NOT MATCH
        savingsGoalRepository.save(SavingsGoal.builder()
                .name("Future Recurring")
                .targetAmount(new BigDecimal("5000.00"))
                .user(userA)
                .isRecurring(true)
                .nextDueDate(today.plusDays(5))
                .build());

        // Goal 4: Non-recurring with today's date -> MUST NOT MATCH
        savingsGoalRepository.save(SavingsGoal.builder()
                .name("Non-recurring Today")
                .targetAmount(new BigDecimal("5000.00"))
                .user(userA)
                .isRecurring(false)
                .nextDueDate(today)
                .build());

        List<SavingsGoal> due = savingsGoalRepository.findByIsRecurringTrueAndNextDueDateLessThanEqual(today);

        List<Long> matchedIds = due.stream().map(SavingsGoal::getId).toList();
        assertTrue(matchedIds.contains(dueRecurring.getId()));
        assertTrue(matchedIds.contains(pastDueRecurring.getId()));
        assertEquals(2, due.stream().filter(g -> g.getUser().getId().equals(userA.getId())).count());
    }
}
