package com.example.expensetracker.service;

import com.example.expensetracker.model.*;
import com.example.expensetracker.repository.BudgetRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.RecurringExpenseRepository;
import com.example.expensetracker.repository.SavingsGoalRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("NotificationDetector — what is worth telling the user about")
class NotificationDetectorTest {

    /** A Wednesday. */
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 14);

    @Mock private BudgetRepository budgetRepository;
    @Mock private ExpenseRepository expenseRepository;
    @Mock private RecurringExpenseRepository recurringExpenseRepository;
    @Mock private SavingsGoalRepository savingsGoalRepository;
    @InjectMocks private NotificationDetector detector;

    private User user;
    private Category food;
    private Category transport;
    private final List<Expense> allExpenses = new ArrayList<>();

    @BeforeEach
    void setUp() {
        user = new User();
        user.setId(1L);
        user.setCurrency("INR");
        food = category(10L, "Food");
        transport = category(11L, "Transport");
        // One answer for every date window the detector asks about, filtered by the requested dates.
        lenient().when(expenseRepository.findByUserAndExpenseDateBetween(any(User.class), any(LocalDate.class), any(LocalDate.class)))
                .thenAnswer(invocation -> {
                    LocalDate from = invocation.getArgument(1);
                    LocalDate to = invocation.getArgument(2);
                    return allExpenses.stream()
                            .filter(e -> !e.getExpenseDate().isBefore(from) && !e.getExpenseDate().isAfter(to))
                            .toList();
                });
    }

    private static Category category(Long id, String name) {
        Category category = new Category();
        category.setId(id);
        category.setName(name);
        return category;
    }

    private Expense expense(Long id, String amount, LocalDate date, Category category, String description) {
        Expense expense = new Expense();
        expense.setId(id);
        expense.setAmount(new BigDecimal(amount));
        expense.setExpenseDate(date);
        expense.setCategory(category);
        expense.setDescription(description);
        expense.setUser(user);
        allExpenses.add(expense);
        return expense;
    }

    private Budget budget(Long id, String limit, Category category, String period) {
        Budget budget = new Budget();
        budget.setId(id);
        budget.setLimitAmount(new BigDecimal(limit));
        budget.setCategory(category);
        budget.setPeriod(period);
        budget.setUser(user);
        return budget;
    }

    @Nested
    @DisplayName("budgets")
    class Budgets {

        @Test
        @DisplayName("84% of a monthly budget warns once, keyed by budget, month and level")
        void warnsAtEightyPercent() {
            when(budgetRepository.findByUser(user)).thenReturn(List.of(budget(7L, "5000", food, "MONTHLY")));
            expense(1L, "4200", LocalDate.of(2026, 10, 5), food, "Groceries");

            List<PendingNotification> result = detector.detectDaily(user, TODAY);

            assertEquals(1, result.size());
            PendingNotification n = result.get(0);
            assertEquals(NotificationType.BUDGET_WARNING, n.type());
            assertEquals("budget:7:2026-10-01:80", n.dedupeKey());
            assertEquals("budgets", n.route());
            assertTrue(n.body().contains("84%"), n.body());
            assertTrue(n.title().contains("Food"));
        }

        @Test
        @DisplayName("reaching the limit says so, as its own event")
        void exceeded() {
            when(budgetRepository.findByUser(user)).thenReturn(List.of(budget(7L, "5000", food, "MONTHLY")));
            expense(1L, "5200", LocalDate.of(2026, 10, 5), food, "Groceries");

            List<PendingNotification> result = detector.detectDaily(user, TODAY);

            assertEquals(1, result.size());
            assertEquals(NotificationType.BUDGET_EXCEEDED, result.get(0).type());
            assertEquals("budget:7:2026-10-01:100", result.get(0).dedupeKey());
        }

        @Test
        @DisplayName("spending below 80%, or in another category, or last month, does not alert")
        void quietWhenFine() {
            when(budgetRepository.findByUser(user)).thenReturn(List.of(budget(7L, "5000", food, "MONTHLY")));
            expense(1L, "3000", LocalDate.of(2026, 10, 5), food, "Groceries");
            expense(2L, "9000", LocalDate.of(2026, 10, 6), transport, "Flight");
            expense(3L, "9000", LocalDate.of(2026, 9, 28), food, "Last month");

            assertTrue(detector.detectDaily(user, TODAY).stream()
                    .noneMatch(n -> n.type() == NotificationType.BUDGET_WARNING || n.type() == NotificationType.BUDGET_EXCEEDED));
        }

        @Test
        @DisplayName("a budget with no category counts every expense")
        void overallBudget() {
            when(budgetRepository.findByUser(user)).thenReturn(List.of(budget(8L, "1000", null, "MONTHLY")));
            expense(1L, "600", LocalDate.of(2026, 10, 5), food, "a");
            expense(2L, "300", LocalDate.of(2026, 10, 6), transport, "b");

            List<PendingNotification> result = detector.detectDaily(user, TODAY);
            assertEquals(1, result.size());
            assertEquals(NotificationType.BUDGET_WARNING, result.get(0).type());
            assertTrue(result.get(0).title().contains("Overall"));
        }

        @Test
        @DisplayName("budget windows: week starts Monday, year is the calendar year, custom only inside its dates")
        void windows() {
            LocalDate[] week = NotificationDetector.budgetWindow(budget(1L, "1", null, "WEEKLY"), TODAY);
            assertEquals(LocalDate.of(2026, 10, 12), week[0]);
            assertEquals(LocalDate.of(2026, 10, 18), week[1]);

            LocalDate[] year = NotificationDetector.budgetWindow(budget(1L, "1", null, "YEARLY"), TODAY);
            assertEquals(LocalDate.of(2026, 1, 1), year[0]);
            assertEquals(LocalDate.of(2026, 12, 31), year[1]);

            Budget custom = budget(1L, "1", null, "CUSTOM");
            custom.setStartDate(LocalDate.of(2026, 11, 1));
            custom.setEndDate(LocalDate.of(2026, 11, 30));
            assertNull(NotificationDetector.budgetWindow(custom, TODAY));
            custom.setStartDate(LocalDate.of(2026, 10, 1));
            assertNotNull(NotificationDetector.budgetWindow(custom, TODAY));
        }
    }

    @Nested
    @DisplayName("upcoming bills")
    class Bills {

        private RecurringExpense bill(Long id, LocalDate due) {
            RecurringExpense bill = new RecurringExpense();
            bill.setId(id);
            bill.setAmount(new BigDecimal("12000"));
            bill.setDescription("Rent");
            bill.setNextDueDate(due);
            bill.setUser(user);
            return bill;
        }

        @Test
        @DisplayName("reminds 3 days, 1 day and on the day, and only then")
        void remindersOnTheRightDays() {
            when(recurringExpenseRepository.findByUser(user)).thenReturn(List.of(
                    bill(1L, TODAY.plusDays(3)), bill(2L, TODAY.plusDays(2)),
                    bill(3L, TODAY.plusDays(1)), bill(4L, TODAY), bill(5L, TODAY.plusDays(4))));

            List<PendingNotification> result = detector.detectDaily(user, TODAY);

            assertEquals(3, result.size());
            assertTrue(result.stream().allMatch(n -> n.type() == NotificationType.SUBSCRIPTION_DUE));
            assertTrue(result.stream().anyMatch(n -> n.title().equals("Rent is due in 3 days")));
            assertTrue(result.stream().anyMatch(n -> n.title().equals("Rent is due tomorrow")));
            assertTrue(result.stream().anyMatch(n -> n.title().equals("Rent is due today")));
        }

        @Test
        @DisplayName("each reminder has its own key so tomorrow's does not repeat today's")
        void keysAreDistinct() {
            when(recurringExpenseRepository.findByUser(user)).thenReturn(List.of(bill(1L, TODAY.plusDays(1))));
            assertEquals("bill:1:2026-10-15:1", detector.detectDaily(user, TODAY).get(0).dedupeKey());
        }
    }

    @Nested
    @DisplayName("savings goals")
    class Goals {

        private SavingsGoal goal(Long id, String current, String target) {
            SavingsGoal goal = new SavingsGoal();
            goal.setId(id);
            goal.setName("Emergency fund");
            goal.setCurrentAmount(new BigDecimal(current));
            goal.setTargetAmount(new BigDecimal(target));
            goal.setUser(user);
            return goal;
        }

        @Test
        @DisplayName("announces the milestone a goal has reached, with a stable key")
        void milestone() {
            when(savingsGoalRepository.findByUser(user)).thenReturn(List.of(goal(4L, "5000", "10000"), goal(5L, "900", "10000")));

            List<PendingNotification> result = detector.detectDaily(user, TODAY);

            assertEquals(1, result.size());
            assertEquals(NotificationType.GOAL_MILESTONE, result.get(0).type());
            assertEquals("goal:4:50", result.get(0).dedupeKey());
            assertEquals("Emergency fund is 50% funded", result.get(0).title());
        }

        @Test
        @DisplayName("a full goal is celebrated as reached")
        void reached() {
            when(savingsGoalRepository.findByUser(user)).thenReturn(List.of(goal(4L, "10000", "10000")));
            assertEquals("Goal reached: Emergency fund", detector.detectDaily(user, TODAY).get(0).title());
        }
    }

    @Nested
    @DisplayName("large expenses")
    class LargeExpenses {

        private void usualHistory() {
            for (int i = 0; i < 5; i++) {
                expense(100L + i, "100", TODAY.minusDays(10L + i), food, "usual " + i);
            }
        }

        @Test
        @DisplayName("yesterday's expense far above the usual is flagged once, keyed by the expense")
        void flagsUnusuallyLargeExpense() {
            usualHistory();
            expense(1L, "1000", TODAY.minusDays(1), food, "Phone repair");

            List<PendingNotification> result = detector.detectDaily(user, TODAY);

            assertEquals(1, result.size());
            assertEquals(NotificationType.LARGE_EXPENSE, result.get(0).type());
            assertEquals("large:1", result.get(0).dedupeKey());
            assertTrue(result.get(0).body().contains("10x"), result.get(0).body());
        }

        @Test
        @DisplayName("bills the app created on its own are expected, so they are never flagged")
        void ignoresAutoGeneratedExpenses() {
            usualHistory();
            expense(1L, "5000", TODAY.minusDays(1), food, "Rent (Auto)");
            assertTrue(detector.detectDaily(user, TODAY).isEmpty());
        }

        @Test
        @DisplayName("with too little history nothing is called unusual")
        void needsHistory() {
            expense(1L, "5000", TODAY.minusDays(1), food, "First ever");
            assertTrue(detector.detectDaily(user, TODAY).isEmpty());
        }
    }

    @Nested
    @DisplayName("weekly digest")
    class Digest {

        private static final LocalDate SUNDAY = LocalDate.of(2026, 10, 18);

        @Test
        @DisplayName("summarises the week, compares with the one before and names the top category")
        void summarises() {
            expense(1L, "300", LocalDate.of(2026, 10, 13), food, "a");
            expense(2L, "100", LocalDate.of(2026, 10, 15), transport, "b");
            expense(3L, "200", LocalDate.of(2026, 10, 7), food, "last week");

            List<PendingNotification> result = detector.detectWeeklyDigest(user, SUNDAY);

            assertEquals(1, result.size());
            assertEquals(NotificationType.WEEKLY_DIGEST, result.get(0).type());
            assertEquals("digest:2026-10-12", result.get(0).dedupeKey());
            assertEquals("Spent INR 400 across 2 expenses (up 100% vs last week). Top category: Food.", result.get(0).body());
        }

        @Test
        @DisplayName("a week with no spending sends nothing")
        void quietWeek() {
            assertTrue(detector.detectWeeklyDigest(user, SUNDAY).isEmpty());
        }
    }
}
