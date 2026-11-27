package com.example.expensetracker.domain.report.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.task.TaskExecutor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicInteger;

import com.example.expensetracker.domain.budget.repository.BudgetRepository;
import com.example.expensetracker.domain.expense.model.Expense;
import com.example.expensetracker.domain.expense.repository.ExpenseRepository;
import com.example.expensetracker.domain.goal.model.SavingsGoal;
import com.example.expensetracker.domain.goal.repository.SavingsGoalRepository;
import com.example.expensetracker.domain.income.mapper.IncomeRules;
import com.example.expensetracker.domain.income.model.Income;
import com.example.expensetracker.domain.income.repository.IncomeRepository;
import com.example.expensetracker.domain.report.dto.MonthlyReportDto;
import com.example.expensetracker.domain.report.repository.MonthlyReportLogRepository;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.domain.user.repository.UserRepository;
import com.example.expensetracker.infrastructure.concurrent.BoundedFanOut;
import com.example.expensetracker.infrastructure.exception.EmailDeliveryException;

/**
 * Production implementation of {@link MonthlyReportService}.
 *
 * <p>Coordinates ledger loading, report calculation via {@link MonthlyReportInsightBuilder},
 * HTML rendering via {@link MonthlyHtmlReportGenerator}, email dispatch via
 * {@link MonthlyReportDeliveryService}, and scheduled catch-up execution.</p>
 *
 * @author Yogeshwaran
 */
@Slf4j
@Service
@Transactional(readOnly = true)
@SuppressWarnings("java:S6809")
public class MonthlyReportServiceImpl implements MonthlyReportService {

    /** Users read per query by the automated catch-up job. */
    private static final int USER_PAGE_SIZE = 200;

    private final UserRepository userRepository;
    private final ExpenseRepository expenseRepository;
    private final IncomeRepository incomeRepository;
    private final SavingsGoalRepository savingsGoalRepository;
    private final BudgetRepository budgetRepository;
    private final MonthlyReportLogRepository reportLogRepository;
    private final MonthlyHtmlReportGenerator monthlyHtmlReportGenerator;
    private final PlatformTransactionManager transactionManager;
    private final MonthlyReportInsightBuilder insightBuilder;
    private final MonthlyReportDeliveryService deliveryService;
    private final TaskExecutor taskExecutor;
    private final Clock clock;

    @Value("${spring.mail.host:}")
    private String configuredMailHost;

    @Value("${app.mail.enabled:false}")
    private boolean mailEnabled;

    /** Most users processed at once; keep it below the database pool size so live requests still get connections. */
    @Value("${app.async.batch-concurrency:4}")
    private int batchConcurrency = 4;

    /**
     * Primary Spring constructor using full constructor injection.
     *
     * @param userRepository             user repository
     * @param expenseRepository          expense repository
     * @param incomeRepository           income repository
     * @param savingsGoalRepository      savings goal repository
     * @param budgetRepository           budget repository
     * @param reportLogRepository        report dispatch log repository
     * @param monthlyHtmlReportGenerator standalone HTML renderer
     * @param transactionManager         platform transaction manager for per-user TX isolation
     * @param insightBuilder             domain calculation & insight builder
     * @param deliveryService            email delivery & audit collaborator
     * @param taskExecutor               optional executor for bounded catch-up dispatch
     * @param clock                      time source for determining previous reporting month
     */
    @Autowired
    public MonthlyReportServiceImpl(
            UserRepository userRepository,
            ExpenseRepository expenseRepository,
            IncomeRepository incomeRepository,
            SavingsGoalRepository savingsGoalRepository,
            BudgetRepository budgetRepository,
            MonthlyReportLogRepository reportLogRepository,
            MonthlyHtmlReportGenerator monthlyHtmlReportGenerator,
            PlatformTransactionManager transactionManager,
            MonthlyReportInsightBuilder insightBuilder,
            MonthlyReportDeliveryService deliveryService,
            @Autowired(required = false) TaskExecutor taskExecutor,
            @Autowired(required = false) Clock clock) {
        this.userRepository = userRepository;
        this.expenseRepository = expenseRepository;
        this.incomeRepository = incomeRepository;
        this.savingsGoalRepository = savingsGoalRepository;
        this.budgetRepository = budgetRepository;
        this.reportLogRepository = reportLogRepository;
        this.monthlyHtmlReportGenerator = monthlyHtmlReportGenerator;
        this.transactionManager = transactionManager;
        this.insightBuilder = insightBuilder;
        this.deliveryService = deliveryService;
        this.taskExecutor = taskExecutor;
        this.clock = clock != null ? clock : Clock.systemDefaultZone();
    }

    /**
     * Compatibility constructor for direct unit-test instantiation.
     *
     * @param userRepository             user repository
     * @param expenseRepository          expense repository
     * @param incomeRepository           income repository
     * @param savingsGoalRepository      savings goal repository
     * @param budgetRepository           budget repository
     * @param reportLogRepository        report dispatch log repository
     * @param mailSenderProvider         optional mail sender provider
     * @param monthlyHtmlReportGenerator standalone HTML renderer
     * @param transactionManager         platform transaction manager
     */
    public MonthlyReportServiceImpl(
            UserRepository userRepository,
            ExpenseRepository expenseRepository,
            IncomeRepository incomeRepository,
            SavingsGoalRepository savingsGoalRepository,
            BudgetRepository budgetRepository,
            MonthlyReportLogRepository reportLogRepository,
            ObjectProvider<JavaMailSender> mailSenderProvider,
            MonthlyHtmlReportGenerator monthlyHtmlReportGenerator,
            PlatformTransactionManager transactionManager) {
        this(
                userRepository,
                expenseRepository,
                incomeRepository,
                savingsGoalRepository,
                budgetRepository,
                reportLogRepository,
                monthlyHtmlReportGenerator,
                transactionManager,
                new MonthlyReportInsightBuilder(),
                new MonthlyReportDeliveryService(reportLogRepository, mailSenderProvider, Clock.systemDefaultZone()),
                null,
                Clock.systemDefaultZone());
    }

    private void validatePeriod(Long userId, int year, int month) {
        if (userId == null) {
            throw new IllegalArgumentException("User ID cannot be null");
        }
        if (month < 1 || month > 12) {
            throw new IllegalArgumentException("Month must be between 1 and 12 (got " + month + ")");
        }
        if (year < 1900 || year > 2100) {
            throw new IllegalArgumentException("Year must be between 1900 and 2100 (got " + year + ")");
        }
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional(readOnly = true)
    public MonthlyReportDto generateMonthlyReport(Long userId, int year, int month) {
        validatePeriod(userId, year, month);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        LocalDate startDate = LocalDate.of(year, month, 1);
        LocalDate endDate = startDate.withDayOfMonth(startDate.lengthOfMonth());

        List<Expense> expenses = expenseRepository.findByUserAndExpenseDateBetween(user, startDate, endDate);
        YearMonth reportMonth = YearMonth.of(year, month);
        List<Income> incomes = incomeRepository.findByUserAndIncomeDateBetween(user,
                        startDate.minusMonths(IncomeRules.MAX_MONTH_SHIFT), endDate.plusMonths(IncomeRules.MAX_MONTH_SHIFT))
                .stream()
                .filter(i -> reportMonth.equals(IncomeRules.effectiveMonth(i)))
                .toList();
        List<SavingsGoal> savingsGoals = savingsGoalRepository.findByUser(user);

        return insightBuilder.buildReport(
                user, year, month, expenses, incomes, savingsGoals, budgetRepository.findByUser(user));
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public void sendMonthlyReportEmail(Long userId, int year, int month) {
        validatePeriod(userId, year, month);

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        if (!deliveryService.isDeliveryAvailable(mailEnabled, configuredMailHost)) {
            log.warn("Email delivery disabled or unconfigured for userId={}", userId);
            deliveryService.recordOutcome(user, year, month, false, "Email delivery disabled or unconfigured");
            throw new EmailDeliveryException("Email delivery is disabled or unconfigured on this server.");
        }

        MonthlyReportDto report = generateMonthlyReport(userId, year, month);
        String htmlContent = monthlyHtmlReportGenerator.buildMonthlyReportHtml(user.getName(), report, user.getId());
        deliveryService.sendAndLog(user, year, month, report.period(), htmlContent);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional(readOnly = true)
    public String generateMonthlyReportHtml(Long userId, int year, int month) {
        validatePeriod(userId, year, month);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        MonthlyReportDto report = generateMonthlyReport(userId, year, month);
        return monthlyHtmlReportGenerator.buildMonthlyReportHtml(user.getName(), report, user.getId());
    }

    /**
     * {@inheritDoc}
     *
     * <p>This job deliberately does <em>not</em> run inside one transaction. Each user's email and its
     * log row get their own transaction (see {@link #sendInOwnTransaction}), so a report that has been
     * sent is recorded straight away.</p>
     */
    @EventListener(ApplicationReadyEvent.class)
    @Scheduled(cron = "0 0 6 1-3 * ?")
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Override
    public void sendAutomatedMonthlyReports() {
        if (!deliveryService.isDeliveryAvailable(mailEnabled, configuredMailHost)) {
            log.debug("Email service is disabled or unconfigured. Automated monthly reports skipped.");
            return;
        }
        log.info("Checking database for unsent monthly financial reports...");
        LocalDate lastMonth = LocalDate.now(clock).minusMonths(1);
        int year = lastMonth.getYear();
        int month = lastMonth.getMonthValue();

        AtomicInteger sentCount = new AtomicInteger(0);
        Executor executor = taskExecutor != null ? taskExecutor : Runnable::run;
        try {
            Pageable pageable = PageRequest.of(0, USER_PAGE_SIZE, Sort.by("id"));
            Page<User> page;
            do {
                page = userRepository.findAll(pageable);
                BoundedFanOut.forEach(page.getContent(), batchConcurrency, executor, u -> {
                    try {
                        boolean alreadySent = reportLogRepository
                                .existsByUserAndReportYearAndReportMonthAndSentSuccessfullyTrue(u, year, month);
                        if (!alreadySent && sendInOwnTransaction(u.getId(), year, month)) {
                            sentCount.incrementAndGet();
                        }
                    } catch (Exception e) {
                        log.error("Error processing automated monthly report catch-up for user {}", u.getId(), e);
                    }
                });
                pageable = page.nextPageable();
            } while (page.hasNext());
        } catch (Exception e) {
            log.warn("Could not query users for automated monthly reports: {}", e.getMessage());
        }
        log.info("Automated monthly report check complete. Dispatched {} pending reports for {}/{}.",
                sentCount.get(), month, year);
    }

    private boolean sendInOwnTransaction(Long userId, int year, int month) {
        TransactionTemplate template = new TransactionTemplate(transactionManager);
        return Boolean.TRUE.equals(template.execute(_ -> {
            try {
                sendMonthlyReportEmail(userId, year, month);
                return true;
            } catch (EmailDeliveryException e) {
                log.warn("Monthly report not delivered to userId={}: {}", userId, e.getMessage());
                return false;
            }
        }));
    }
}
