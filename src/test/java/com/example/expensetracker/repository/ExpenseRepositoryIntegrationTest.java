package com.example.expensetracker.repository;

import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.Role;
import com.example.expensetracker.model.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Real SQL engine integration test for {@link ExpenseRepository}.
 * Validates complex JPQL date slicing, coalesce aggregations, pagination,
 * eager category fetches, and tenant data safety.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ExpenseRepositoryIntegrationTest {

    @Autowired
    private ExpenseRepository expenseRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private UserRepository userRepository;

    private User userA;
    private User userB;
    private Category categoryFood;

    @BeforeEach
    void setUp() {
        userA = userRepository.save(User.builder()
                .name("Alice Expense")
                .username("alice_exp_" + System.currentTimeMillis())
                .email("alice_exp_" + System.currentTimeMillis() + "@test.com")
                .password("SecureP@ss123")
                .role(Role.ROLE_USER)
                .enabled(true)
                .build());

        userB = userRepository.save(User.builder()
                .name("Bob Expense")
                .username("bob_exp_" + System.currentTimeMillis())
                .email("bob_exp_" + System.currentTimeMillis() + "@test.com")
                .password("SecureP@ss123")
                .role(Role.ROLE_USER)
                .enabled(true)
                .build());

        categoryFood = categoryRepository.save(Category.builder()
                .name("Food & Groceries")
                .user(userA)
                .build());
    }

    @Test
    @DisplayName("sumTotalExpensesAmountByUser returns 0 when user has zero expenses (never null)")
    void sumTotalExpensesAmountByUser_emptyUserReturnsZero() {
        BigDecimal sum = expenseRepository.sumTotalExpensesAmountByUser(userA);
        assertNotNull(sum, "COALESCE in JPQL must prevent null sum");
        assertEquals(0, BigDecimal.ZERO.compareTo(sum), "Sum for user with no expenses must be exactly zero");
    }

    @Test
    @DisplayName("sumTotalExpensesAmountByUser accurately sums amounts and guarantees tenant isolation")
    void sumTotalExpensesAmountByUser_sumsAccuratelyWithTenantIsolation() {
        expenseRepository.save(Expense.builder()
                .amount(new BigDecimal("120.50"))
                .description("Groceries")
                .expenseDate(LocalDate.now())
                .user(userA)
                .category(categoryFood)
                .build());

        expenseRepository.save(Expense.builder()
                .amount(new BigDecimal("79.50"))
                .description("Dinner")
                .expenseDate(LocalDate.now())
                .user(userA)
                .build());

        // Bob's expense should NOT affect Alice's sum
        expenseRepository.save(Expense.builder()
                .amount(new BigDecimal("5000.00"))
                .description("Bob Luxury Item")
                .expenseDate(LocalDate.now())
                .user(userB)
                .build());

        BigDecimal aliceSum = expenseRepository.sumTotalExpensesAmountByUser(userA);
        assertEquals(0, new BigDecimal("200.00").compareTo(aliceSum), "Alice sum must be 200.00");

        BigDecimal bobSum = expenseRepository.sumTotalExpensesAmountByUser(userB);
        assertEquals(0, new BigDecimal("5000.00").compareTo(bobSum), "Bob sum must be 5000.00");
    }

    @Test
    @DisplayName("findByUserAndExpenseDateBetween enforces inclusive date bounds and filters out-of-range dates")
    void findByUserAndExpenseDateBetween_strictDateBoundaries() {
        LocalDate start = LocalDate.of(2026, 5, 10);
        LocalDate end = LocalDate.of(2026, 5, 20);

        // Exact boundary start -> MATCH
        Expense startExp = expenseRepository.save(Expense.builder()
                .amount(new BigDecimal("10.00"))
                .description("On Start Date")
                .expenseDate(start)
                .user(userA)
                .build());

        // Exact boundary end -> MATCH
        Expense endExp = expenseRepository.save(Expense.builder()
                .amount(new BigDecimal("20.00"))
                .description("On End Date")
                .expenseDate(end)
                .user(userA)
                .build());

        // Inside window -> MATCH
        Expense midExp = expenseRepository.save(Expense.builder()
                .amount(new BigDecimal("30.00"))
                .description("Mid Window")
                .expenseDate(LocalDate.of(2026, 5, 15))
                .user(userA)
                .build());

        // Day before -> EXCLUDE
        expenseRepository.save(Expense.builder()
                .amount(new BigDecimal("40.00"))
                .description("Before Window")
                .expenseDate(start.minusDays(1))
                .user(userA)
                .build());

        // Day after -> EXCLUDE
        expenseRepository.save(Expense.builder()
                .amount(new BigDecimal("50.00"))
                .description("After Window")
                .expenseDate(end.plusDays(1))
                .user(userA)
                .build());

        // Bob's expense on date -> EXCLUDE
        expenseRepository.save(Expense.builder()
                .amount(new BigDecimal("999.00"))
                .description("Bob Inside Window")
                .expenseDate(LocalDate.of(2026, 5, 15))
                .user(userB)
                .build());

        List<Expense> matched = expenseRepository.findByUserAndExpenseDateBetween(userA, start, end);

        assertEquals(3, matched.size());
        List<Long> matchedIds = matched.stream().map(Expense::getId).toList();
        assertTrue(matchedIds.contains(startExp.getId()));
        assertTrue(matchedIds.contains(endExp.getId()));
        assertTrue(matchedIds.contains(midExp.getId()));
    }

    @Test
    @DisplayName("findByUserWithCategory eagerly loads category without LazyInitializationException")
    void findByUserWithCategory_eagerCategoryFetch() {
        expenseRepository.save(Expense.builder()
                .amount(new BigDecimal("45.00"))
                .description("Lunch with category")
                .expenseDate(LocalDate.now())
                .user(userA)
                .category(categoryFood)
                .build());

        Page<Expense> page = expenseRepository.findByUserWithCategory(userA, PageRequest.of(0, 10));
        assertFalse(page.isEmpty());
        Expense exp = page.getContent().get(0);
        assertNotNull(exp.getCategory());
        assertEquals("Food & Groceries", exp.getCategory().getName());
    }

    @Test
    @DisplayName("deleteByUserId purges only target user's expenses")
    void deleteByUserId_strictPurge() {
        expenseRepository.save(Expense.builder()
                .amount(new BigDecimal("10.00"))
                .description("A1")
                .expenseDate(LocalDate.now())
                .user(userA)
                .build());
        expenseRepository.save(Expense.builder()
                .amount(new BigDecimal("20.00"))
                .description("B1")
                .expenseDate(LocalDate.now())
                .user(userB)
                .build());

        expenseRepository.deleteByUserId(userA.getId());

        assertEquals(0, expenseRepository.findByUser(userA).size());
        assertEquals(1, expenseRepository.findByUser(userB).size());
    }
}
