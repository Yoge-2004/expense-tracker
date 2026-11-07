package com.example.expensetracker.service;

import com.example.expensetracker.dto.SavingsGoalDto;
import com.example.expensetracker.dto.SavingsGoalRequest;
import com.example.expensetracker.model.Role;
import com.example.expensetracker.model.SavingsGoal;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.SavingsGoalRepository;
import com.example.expensetracker.repository.UserRepository;
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

/**
 * Real multi-threaded concurrency integration test verifying that concurrent deposits
 * under high thread contention do NOT suffer from lost-update anomalies or race conditions.
 */
@SpringBootTest
@ActiveProfiles("test")
class SavingsGoalConcurrencyIntegrationTest {

    @Autowired
    private SavingsGoalService savingsGoalService;

    @Autowired
    private SavingsGoalRepository savingsGoalRepository;

    @Autowired
    private UserRepository userRepository;

    @Test
    @DisplayName("10 concurrent threads depositing $100 simultaneously produce an exact $1,000 balance without lost updates")
    void concurrentDeposits_zeroLostUpdates() throws InterruptedException {
        User user = userRepository.save(User.builder()
                .name("Concurrency Tester")
                .username("concurrency_usr_" + System.currentTimeMillis())
                .email("concurrency_" + System.currentTimeMillis() + "@test.com")
                .password("SecureP@ss123")
                .role(Role.ROLE_USER)
                .enabled(true)
                .build());

        SavingsGoalDto createdGoal = savingsGoalService.createGoal(new SavingsGoalRequest(
                "High Contention Vacation Fund",
                new BigDecimal("2000.00"),
                BigDecimal.ZERO,
                LocalDate.now().plusYears(1),
                "IN_PROGRESS",
                false,
                null,
                null,
                null,
                null,
                null
        ), user);

        final Long goalId = createdGoal.id();
        final int threadCount = 10;
        final BigDecimal depositPerThread = new BigDecimal("100.00");

        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch startGate = new CountDownLatch(1);
        CountDownLatch finishGate = new CountDownLatch(threadCount);
        AtomicInteger successCount = new AtomicInteger(0);
        ConcurrentLinkedQueue<Throwable> errors = new ConcurrentLinkedQueue<>();

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    startGate.await(); // wait until all threads are prepped
                    savingsGoalService.depositToGoal(goalId, depositPerThread, user);
                    successCount.incrementAndGet();
                } catch (Throwable t) {
                    errors.add(t);
                } finally {
                    finishGate.countDown();
                }
            });
        }

        startGate.countDown(); // release all threads simultaneously
        boolean finished = finishGate.await(15, TimeUnit.SECONDS);
        executor.shutdown();

        assertTrue(finished, "All deposit threads should finish within the timeout");
        assertTrue(errors.isEmpty(), "Zero threads should fail during concurrent deposits. Errors: " + errors);
        assertEquals(threadCount, successCount.get(), "All 10 threads must complete successfully");

        // Authoritative verification directly from the database
        SavingsGoal finalGoal = savingsGoalRepository.findById(goalId).orElseThrow();
        BigDecimal expectedTotal = new BigDecimal("1000.00");
        assertEquals(0, expectedTotal.compareTo(finalGoal.getCurrentAmount()),
                "Final balance must be exactly $1000.00 — any other number proves a lost-update concurrency bug!");
        assertEquals("IN_PROGRESS", finalGoal.getStatus());

        // Deposit remaining 1000 to reach 2000 target and verify automatic state transition
        SavingsGoalDto completedGoal = savingsGoalService.depositToGoal(goalId, new BigDecimal("1000.00"), user);
        assertEquals(0, new BigDecimal("2000.00").compareTo(completedGoal.currentAmount()));
        assertEquals("COMPLETED", completedGoal.status(), "Goal must automatically transition to COMPLETED when target is reached");
    }
}
