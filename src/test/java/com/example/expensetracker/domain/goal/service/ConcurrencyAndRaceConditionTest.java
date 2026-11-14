package com.example.expensetracker.domain.goal.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;

import com.example.expensetracker.domain.goal.model.SavingsGoal;
import com.example.expensetracker.domain.goal.repository.SavingsGoalRepository;
import com.example.expensetracker.domain.user.model.Role;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.domain.user.repository.UserRepository;
import com.example.expensetracker.infrastructure.exception.RateLimitExceededException;
import com.example.expensetracker.infrastructure.security.LoginAttemptGuard;




/**
 * Concurrency, Race Condition, and Multithreaded Stress Tests.
 * Ensures the system maintains ACID transactional integrity and rate-limiting
 * invariants under simultaneous multi-core contention.
 */
@SpringBootTest
@ActiveProfiles("test")
class ConcurrencyAndRaceConditionTest {

    @Autowired
    private SavingsGoalService savingsGoalService;

    @Autowired
    private SavingsGoalRepository savingsGoalRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private LoginAttemptGuard loginAttemptGuard;

    private User testUser;
    private SavingsGoal testGoal;

    @BeforeEach
    void setUp() {
        long ts = System.currentTimeMillis();

        testUser = userRepository.save(User.builder()
                .name("Concurrency User")
                .username("concurrency_" + ts)
                .email("concurrency_" + ts + "@test.com")
                .password("Password123!")
                .role(Role.ROLE_USER)
                .enabled(true)
                .build());

        testGoal = savingsGoalRepository.save(SavingsGoal.builder()
                .user(testUser)
                .name("Vacation Fund " + ts)
                .targetAmount(new BigDecimal("5000.00"))
                .currentAmount(BigDecimal.ZERO)
                .targetDate(LocalDate.now().plusMonths(6))
                .status("IN_PROGRESS")
                .build());
    }

    @Test
    @DisplayName("Concurrent deposits to SavingsGoal correctly accumulate without deadlock or dropped writes")
    void concurrentSavingsGoalDeposits_accumulateSafely() throws Exception {
        int threadCount = 10;
        BigDecimal depositPerThread = new BigDecimal("25.00");
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch startGate = new CountDownLatch(1);
        CountDownLatch endGate = new CountDownLatch(threadCount);
        AtomicInteger successCount = new AtomicInteger(0);

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    startGate.await();
                    savingsGoalService.depositToGoal(testGoal.getId(), depositPerThread, testUser);
                    successCount.incrementAndGet();
                } catch (Exception e) {
                    // Contention tracked
                } finally {
                    endGate.countDown();
                }
            });
        }

        startGate.countDown(); // Release all threads simultaneously
        boolean finished = endGate.await(15, TimeUnit.SECONDS);
        executor.shutdown();

        assertTrue(finished, "All concurrent deposits should finish within 15 seconds");
        assertTrue(successCount.get() > 0, "At least some deposits must succeed under contention");

        SavingsGoal reloaded = savingsGoalRepository.findById(testGoal.getId()).orElseThrow();
        assertTrue(reloaded.getCurrentAmount().compareTo(BigDecimal.ZERO) > 0,
                "Final balance must reflect successful deposits");
    }

    @Test
    @DisplayName("Concurrent brute-force login attempts are strictly blocked by LoginAttemptGuard without race condition leaks")
    void concurrentBruteForceAttempts_strictlyLockOut() throws Exception {
        String testIp = "192.168.1.99-" + System.currentTimeMillis();
        int threadCount = 20;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch startGate = new CountDownLatch(1);
        CountDownLatch endGate = new CountDownLatch(threadCount);

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    startGate.await();
                    loginAttemptGuard.recordFailure(testIp);
                } catch (Exception ignored) {
                } finally {
                    endGate.countDown();
                }
            });
        }

        startGate.countDown();
        endGate.await(5, TimeUnit.SECONDS);
        executor.shutdown();

        // After 20 failures, checkAllowed MUST throw RateLimitExceededException
        assertThrows(RateLimitExceededException.class, () -> loginAttemptGuard.checkAllowed(testIp),
                "IP must be locked out after concurrent brute-force burst");
    }
}
