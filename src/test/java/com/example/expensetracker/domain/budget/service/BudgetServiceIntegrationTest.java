package com.example.expensetracker.domain.budget.service;

import com.example.expensetracker.domain.budget.dto.BudgetDto;
import com.example.expensetracker.domain.budget.dto.BudgetStatusDto;
import com.example.expensetracker.domain.expense.model.Category;
import com.example.expensetracker.domain.expense.model.Expense;
import com.example.expensetracker.domain.expense.repository.CategoryRepository;
import com.example.expensetracker.domain.expense.repository.ExpenseRepository;
import com.example.expensetracker.domain.income.model.Income;
import com.example.expensetracker.domain.income.repository.IncomeRepository;
import com.example.expensetracker.domain.user.model.Role;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.domain.user.repository.UserRepository;
import com.example.expensetracker.domain.user.security.CustomUserDetails;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration test for {@link BudgetServiceImpl} against JPA/H2 verifying
 * {@code CategorySpendSummary} aggregation, reimbursement subtraction, and BigDecimal precision.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class BudgetServiceIntegrationTest {

    @Autowired private BudgetService budgetService;
    @Autowired private UserRepository userRepository;
    @Autowired private CategoryRepository categoryRepository;
    @Autowired private ExpenseRepository expenseRepository;
    @Autowired private IncomeRepository incomeRepository;

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void getBudgetStatusAggregatesExpensesViaGroupByAndSubtractsReimbursementsWithBigDecimalPrecision() {
        long ts = System.nanoTime();
        User user = userRepository.save(User.builder()
                .name("Budget User")
                .username("buser_" + ts)
                .email("buser_" + ts + "@test.com")
                .password("SecureP@ss123")
                .role(Role.ROLE_USER)
                .enabled(true)
                .build());
        authenticate(user);

        Category food = categoryRepository.save(Category.builder().name("Food_" + ts).user(user).build());
        Category travel = categoryRepository.save(Category.builder().name("Travel_" + ts).user(user).build());

        LocalDate today = LocalDate.now();
        expenseRepository.save(Expense.builder()
                .user(user).category(food).amount(new BigDecimal("100.25"))
                .description("Lunch").expenseDate(today).build());
        expenseRepository.save(Expense.builder()
                .user(user).category(food).amount(new BigDecimal("49.75"))
                .description("Groceries").expenseDate(today).build());
        expenseRepository.save(Expense.builder()
                .user(user).category(travel).amount(new BigDecimal("200.00"))
                .description("Train").expenseDate(today).build());

        incomeRepository.save(Income.builder()
                .user(user)
                .amount(new BigDecimal("30.00"))
                .source("Splitwise")
                .incomeDate(today)
                .kind("REIMBURSEMENT")
                .reimbursedCategoryId(food.getId())
                .build());

        budgetService.setBudget(user.getId(), new BudgetDto(
                null, food.getId(), new BigDecimal("300.00"), "MONTHLY", null, null, null));
        budgetService.setBudget(user.getId(), new BudgetDto(
                null, travel.getId(), new BigDecimal("500.00"), "MONTHLY", null, null, null));

        List<BudgetStatusDto> statuses = budgetService.getBudgetStatus(user.getId());
        assertThat(statuses).hasSize(2);

        BudgetStatusDto foodStatus = statuses.stream()
                .filter(s -> s.categoryId().equals(food.getId())).findFirst().orElseThrow();
        // (100.25 + 49.75) - 30.00 = 120.00; 120 / 300 * 100 = 40.0%
        assertThat(foodStatus.spent()).isEqualByComparingTo("120.00");
        assertThat(foodStatus.percentage()).isEqualTo(40.0);

        BudgetStatusDto travelStatus = statuses.stream()
                .filter(s -> s.categoryId().equals(travel.getId())).findFirst().orElseThrow();
        assertThat(travelStatus.spent()).isEqualByComparingTo("200.00");
        assertThat(travelStatus.percentage()).isEqualTo(40.0);
    }

    private static void authenticate(User user) {
        CustomUserDetails principal = new CustomUserDetails(user);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }
}
