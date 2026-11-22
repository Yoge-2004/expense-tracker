package com.example.expensetracker.domain.user.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.example.expensetracker.domain.ai.repository.MlFeedbackRepository;
import com.example.expensetracker.domain.budget.repository.BudgetRepository;
import com.example.expensetracker.domain.expense.repository.CategoryRepository;
import com.example.expensetracker.domain.expense.repository.ExpenseRepository;
import com.example.expensetracker.domain.expense.repository.RecurringExpenseRepository;
import com.example.expensetracker.domain.goal.repository.SavingsGoalRepository;
import com.example.expensetracker.domain.income.repository.IncomeRepository;
import com.example.expensetracker.domain.loan.repository.LoanAdjustmentRepository;
import com.example.expensetracker.domain.notification.repository.AppNotificationRepository;
import com.example.expensetracker.domain.notification.repository.DeviceTokenRepository;
import com.example.expensetracker.domain.notification.repository.NotificationPreferenceRepository;
import com.example.expensetracker.domain.report.repository.MonthlyReportLogRepository;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.domain.user.repository.UserAppearanceRepository;
import com.example.expensetracker.domain.user.repository.WebAuthnCredentialRepository;


/**
 * Robust implementation of {@link UserCascadeDeletionService} managing ordered cascading
 * removal of child domain entities to maintain relational and foreign key integrity.
 *
 * @author Yogeshwaran
 */
@Slf4j
@Service
public class UserCascadeDeletionServiceImpl implements UserCascadeDeletionService {

    private final ExpenseRepository expenseRepository;
    private final CategoryRepository categoryRepository;
    private final BudgetRepository budgetRepository;
    private final RecurringExpenseRepository recurringRepository;
    private final IncomeRepository incomeRepository;
    private final SavingsGoalRepository savingsGoalRepository;
    private final MonthlyReportLogRepository reportLogRepository;
    private final WebAuthnCredentialRepository webAuthnCredentialRepository;
    private final AppNotificationRepository appNotificationRepository;
    private final DeviceTokenRepository deviceTokenRepository;
    private final LoanAdjustmentRepository loanAdjustmentRepository;
    private final MlFeedbackRepository mlFeedbackRepository;
    private final NotificationPreferenceRepository notificationPreferenceRepository;
    private final UserAppearanceRepository userAppearanceRepository;

    @Autowired
    public UserCascadeDeletionServiceImpl(
            ExpenseRepository expenseRepository,
            CategoryRepository categoryRepository,
            BudgetRepository budgetRepository,
            RecurringExpenseRepository recurringRepository,
            IncomeRepository incomeRepository,
            SavingsGoalRepository savingsGoalRepository,
            MonthlyReportLogRepository reportLogRepository,
            WebAuthnCredentialRepository webAuthnCredentialRepository,
            AppNotificationRepository appNotificationRepository,
            DeviceTokenRepository deviceTokenRepository,
            LoanAdjustmentRepository loanAdjustmentRepository,
            MlFeedbackRepository mlFeedbackRepository,
            NotificationPreferenceRepository notificationPreferenceRepository,
            UserAppearanceRepository userAppearanceRepository) {
        this.expenseRepository = expenseRepository;
        this.categoryRepository = categoryRepository;
        this.budgetRepository = budgetRepository;
        this.recurringRepository = recurringRepository;
        this.incomeRepository = incomeRepository;
        this.savingsGoalRepository = savingsGoalRepository;
        this.reportLogRepository = reportLogRepository;
        this.webAuthnCredentialRepository = webAuthnCredentialRepository;
        this.appNotificationRepository = appNotificationRepository;
        this.deviceTokenRepository = deviceTokenRepository;
        this.loanAdjustmentRepository = loanAdjustmentRepository;
        this.mlFeedbackRepository = mlFeedbackRepository;
        this.notificationPreferenceRepository = notificationPreferenceRepository;
        this.userAppearanceRepository = userAppearanceRepository;
    }

    /** Compatibility path used by older direct service instantiations without auxiliary repositories. */
    @Deprecated(forRemoval = false)
    UserCascadeDeletionServiceImpl(
            ExpenseRepository expenseRepository,
            CategoryRepository categoryRepository,
            BudgetRepository budgetRepository,
            RecurringExpenseRepository recurringRepository,
            IncomeRepository incomeRepository,
            SavingsGoalRepository savingsGoalRepository,
            MonthlyReportLogRepository reportLogRepository,
            WebAuthnCredentialRepository webAuthnCredentialRepository) {
        this(expenseRepository, categoryRepository, budgetRepository, recurringRepository,
                incomeRepository, savingsGoalRepository, reportLogRepository, webAuthnCredentialRepository,
                null, null, null, null, null, null);
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public void cascadeDeleteUserData(Long userId, User user) {
        log.warn("Executing ordered cascade deletion for userId={}", userId);

        if (appNotificationRepository != null && user != null) {
            appNotificationRepository.deleteByUser(user);
        }
        if (deviceTokenRepository != null && user != null) {
            deviceTokenRepository.deleteByUser(user);
        }
        if (loanAdjustmentRepository != null && user != null) {
            loanAdjustmentRepository.deleteByUser(user);
        }
        if (mlFeedbackRepository != null && user != null) {
            mlFeedbackRepository.deleteByUser(user);
        }
        if (notificationPreferenceRepository != null && user != null) {
            notificationPreferenceRepository.deleteByUser(user);
        }
        if (userAppearanceRepository != null && user != null) {
            userAppearanceRepository.deleteByUser(user);
        }

        if (reportLogRepository != null) {
            reportLogRepository.deleteByUserId(userId);
        }
        if (webAuthnCredentialRepository != null) {
            webAuthnCredentialRepository.deleteByUserId(userId);
        }
        if (expenseRepository != null) {
            expenseRepository.deleteByUserId(userId);
        }
        if (recurringRepository != null) {
            recurringRepository.deleteByUserId(userId);
        }
        if (incomeRepository != null) {
            incomeRepository.deleteByUserId(userId);
        }
        if (budgetRepository != null) {
            budgetRepository.deleteByUserId(userId);
        }
        if (savingsGoalRepository != null) {
            savingsGoalRepository.deleteByUserId(userId);
        }
        if (categoryRepository != null) {
            categoryRepository.deleteByUserId(userId);
        }

        log.info("Ordered cascade deletion finished for userId={}", userId);
    }
}
