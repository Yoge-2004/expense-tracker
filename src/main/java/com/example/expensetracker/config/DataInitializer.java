package com.example.expensetracker.config;

import com.example.expensetracker.model.*;
import com.example.expensetracker.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

/**
 * Seeds comprehensive realistic financial data for the demo user upon startup.
 *
 * <p>Populates realistic incomes, expenses, categories, monthly budgets,
 * savings goals, and recurring subscriptions so that when a user explores
 * the application, the dashboard, visual charts, and reports are pre-loaded
 * with rich, representative analytics.</p>
 *
 * <p>Active only in non-test profiles to ensure clean automated testing.</p>
 *
 * @author Yogeshwaran
 * @version 1.0
 */
@Component
@Profile("!test")
public class DataInitializer {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private final UserRepository userRepository;
    private final CategoryRepository categoryRepository;
    private final ExpenseRepository expenseRepository;
    private final IncomeRepository incomeRepository;
    private final SavingsGoalRepository savingsGoalRepository;
    private final BudgetRepository budgetRepository;
    private final RecurringExpenseRepository recurringExpenseRepository;
    private final PasswordEncoder passwordEncoder;

    public DataInitializer(UserRepository userRepository,
                           CategoryRepository categoryRepository,
                           ExpenseRepository expenseRepository,
                           IncomeRepository incomeRepository,
                           SavingsGoalRepository savingsGoalRepository,
                           BudgetRepository budgetRepository,
                           RecurringExpenseRepository recurringExpenseRepository,
                           PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.categoryRepository = categoryRepository;
        this.expenseRepository = expenseRepository;
        this.incomeRepository = incomeRepository;
        this.savingsGoalRepository = savingsGoalRepository;
        this.budgetRepository = budgetRepository;
        this.recurringExpenseRepository = recurringExpenseRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Order(10)
    @Transactional
    public void seedDemoData() {
        String demoEmail = "demo@expensetracker.com";
        Optional<User> existing = userRepository.findByEmail(demoEmail);

        if (existing.isPresent()) {
            log.info("Demo user {} already exists. Skipping demo data seeding.", demoEmail);
            return;
        }

        log.info("Seeding comprehensive financial demo data for {}...", demoEmail);

        // 1. Create Demo User
        User demoUser = new User();
        demoUser.setName("Alex Executive");
        demoUser.setUsername("demo_executive");
        demoUser.setEmail(demoEmail);
        demoUser.setPassword(passwordEncoder.encode("Demo1234!"));
        demoUser.setCurrency("USD");
        demoUser.setEnabled(true);
        demoUser.setAccountLocked(false);
        userRepository.save(demoUser);

        // 2. Fetch categories
        Category foodCat = categoryRepository.findByNameIgnoreCase("Food").orElse(null);
        Category transportCat = categoryRepository.findByNameIgnoreCase("Transport").orElse(null);
        Category utilitiesCat = categoryRepository.findByNameIgnoreCase("Utilities").orElse(null);
        Category entertainmentCat = categoryRepository.findByNameIgnoreCase("Entertainment").orElse(null);
        Category healthCat = categoryRepository.findByNameIgnoreCase("Health").orElse(null);

        LocalDate now = LocalDate.now();
        LocalDate startOfMonth = now.withDayOfMonth(1);
        LocalDate prevMonth = now.minusMonths(1);

        // 3. Populate Incomes (Current & Previous Months)
        createIncome(demoUser, "Tech Lead Primary Salary", new BigDecimal("8500.00"), startOfMonth, true, "Monthly salary after tax");
        createIncome(demoUser, "Full-Stack SaaS Consulting", new BigDecimal("2400.00"), startOfMonth.plusDays(10), false, "Contract client retainer");
        createIncome(demoUser, "High-Yield Index Dividends", new BigDecimal("650.00"), startOfMonth.plusDays(15), true, "Vanguard S&P 500 quarterly payout");
        createIncome(demoUser, "Q3 Performance Bonus", new BigDecimal("3500.00"), startOfMonth.plusDays(20), false, "Executive annual bonus");

        // Previous month history
        createIncome(demoUser, "Tech Lead Primary Salary", new BigDecimal("8500.00"), prevMonth.withDayOfMonth(1), true, "Monthly salary");
        createIncome(demoUser, "Freelance API Architecture", new BigDecimal("1800.00"), prevMonth.withDayOfMonth(14), false, "Consulting fee");
        createIncome(demoUser, "Index Fund Yield", new BigDecimal("650.00"), prevMonth.withDayOfMonth(15), true, "Dividend yield");

        // 4. Populate Expenses
        createExpense(demoUser, foodCat, new BigDecimal("480.50"), startOfMonth.plusDays(2), "Whole Foods Organic Groceries", false);
        createExpense(demoUser, foodCat, new BigDecimal("165.00"), startOfMonth.plusDays(8), "Executive Dinner & Networking", false);
        createExpense(demoUser, foodCat, new BigDecimal("85.20"), startOfMonth.plusDays(16), "Artisan Coffee & Bistro Lunches", false);

        createExpense(demoUser, utilitiesCat, new BigDecimal("2100.00"), startOfMonth.plusDays(1), "Luxury Downtown Apartment Rent", true);
        createExpense(demoUser, utilitiesCat, new BigDecimal("145.00"), startOfMonth.plusDays(5), "Clean Energy Grid Electricity", false);
        createExpense(demoUser, utilitiesCat, new BigDecimal("89.99"), startOfMonth.plusDays(6), "Gigabit Fiber Internet", true);

        createExpense(demoUser, transportCat, new BigDecimal("120.00"), startOfMonth.plusDays(4), "Tesla Supercharger & Toll Pass", false);
        createExpense(demoUser, transportCat, new BigDecimal("45.00"), startOfMonth.plusDays(12), "Airport Ride & City Transit", false);

        createExpense(demoUser, entertainmentCat, new BigDecimal("220.00"), startOfMonth.plusDays(7), "Symphony Hall Concert Tickets", false);
        createExpense(demoUser, entertainmentCat, new BigDecimal("42.98"), startOfMonth.plusDays(14), "Streaming Services (Netflix & Spotify)", true);

        createExpense(demoUser, healthCat, new BigDecimal("180.00"), startOfMonth.plusDays(3), "Equinox Athletic Club Membership", true);
        createExpense(demoUser, healthCat, new BigDecimal("95.00"), startOfMonth.plusDays(18), "Sports Therapy & Wellness", false);

        // Previous month expenses
        createExpense(demoUser, utilitiesCat, new BigDecimal("2100.00"), prevMonth.withDayOfMonth(1), "Apartment Rent", true);
        createExpense(demoUser, foodCat, new BigDecimal("650.00"), prevMonth.withDayOfMonth(10), "Groceries & Dining", false);
        createExpense(demoUser, transportCat, new BigDecimal("150.00"), prevMonth.withDayOfMonth(15), "Fuel & Transit", false);

        // 5. Populate Budgets
        if (foodCat != null) createBudget(demoUser, foodCat, new BigDecimal("900.00"));
        if (utilitiesCat != null) createBudget(demoUser, utilitiesCat, new BigDecimal("2500.00"));
        if (transportCat != null) createBudget(demoUser, transportCat, new BigDecimal("350.00"));
        if (entertainmentCat != null) createBudget(demoUser, entertainmentCat, new BigDecimal("450.00"));
        if (healthCat != null) createBudget(demoUser, healthCat, new BigDecimal("400.00"));

        // 6. Populate Savings Goals
        createSavingsGoal(demoUser, "Emergency Reserve Fund", new BigDecimal("25000.00"), new BigDecimal("18500.00"), now.plusMonths(6));
        createSavingsGoal(demoUser, "Tesla Model Y Downpayment", new BigDecimal("15000.00"), new BigDecimal("12200.00"), now.plusMonths(4));
        createSavingsGoal(demoUser, "Kyoto & Tokyo Vacation", new BigDecimal("7500.00"), new BigDecimal("5400.00"), now.plusMonths(8));
        createSavingsGoal(demoUser, "Passive Index Growth Fund", new BigDecimal("50000.00"), new BigDecimal("34500.00"), now.plusYears(2));

        // 7. Populate Recurring Expenses / Subscriptions
        createRecurringExpense(demoUser, "Gigabit Fiber Internet", new BigDecimal("89.99"), utilitiesCat);
        createRecurringExpense(demoUser, "Equinox Gym Membership", new BigDecimal("180.00"), healthCat);
        createRecurringExpense(demoUser, "Netflix 4K Premium", new BigDecimal("22.99"), entertainmentCat);
        createRecurringExpense(demoUser, "Spotify Family Plan", new BigDecimal("16.99"), entertainmentCat);

        log.info("Comprehensive financial demo data seeded successfully for {}", demoEmail);
    }

    private void createIncome(User user, String source, BigDecimal amount, LocalDate date, boolean recurring, String desc) {
        Income inc = new Income();
        inc.setUser(user);
        inc.setSource(source);
        inc.setAmount(amount);
        inc.setIncomeDate(date);
        inc.setIsRecurring(recurring);
        inc.setDescription(desc);
        incomeRepository.save(inc);
    }

    private void createExpense(User user, Category cat, BigDecimal amount, LocalDate date, String desc, boolean recurring) {
        Expense exp = new Expense();
        exp.setUser(user);
        exp.setCategory(cat);
        exp.setAmount(amount);
        exp.setExpenseDate(date);
        exp.setDescription(desc);
        exp.setRecurring(recurring);
        expenseRepository.save(exp);
    }

    private void createBudget(User user, Category cat, BigDecimal limit) {
        Budget b = new Budget();
        b.setUser(user);
        b.setCategory(cat);
        b.setLimitAmount(limit);
        budgetRepository.save(b);
    }

    private void createSavingsGoal(User user, String name, BigDecimal target, BigDecimal current, LocalDate targetDate) {
        SavingsGoal goal = new SavingsGoal();
        goal.setUser(user);
        goal.setName(name);
        goal.setTargetAmount(target);
        goal.setCurrentAmount(current);
        goal.setTargetDate(targetDate);
        savingsGoalRepository.save(goal);
    }

    private void createRecurringExpense(User user, String desc, BigDecimal amount, Category cat) {
        RecurringExpense rec = new RecurringExpense();
        rec.setUser(user);
        rec.setDescription(desc);
        rec.setAmount(amount);
        rec.setFrequency("MONTHLY");
        rec.setNextDueDate(LocalDate.now().plusDays(15));
        rec.setCategory(cat);
        recurringExpenseRepository.save(rec);
    }
}
