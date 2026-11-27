package com.example.expensetracker.domain.user.service;

import com.example.expensetracker.common.user.UserCleanupParticipant;
import com.example.expensetracker.domain.budget.model.Budget;
import com.example.expensetracker.domain.budget.repository.BudgetRepository;
import com.example.expensetracker.domain.expense.model.Category;
import com.example.expensetracker.domain.expense.model.Expense;
import com.example.expensetracker.domain.expense.repository.CategoryRepository;
import com.example.expensetracker.domain.expense.repository.ExpenseRepository;
import com.example.expensetracker.domain.income.model.Income;
import com.example.expensetracker.domain.income.repository.IncomeRepository;
import com.example.expensetracker.domain.user.model.PasswordResetOtp;
import com.example.expensetracker.domain.user.model.Role;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.domain.user.model.WebAuthnChallenge;
import com.example.expensetracker.domain.user.model.WebAuthnCredential;
import com.example.expensetracker.domain.user.repository.PasswordResetOtpRepository;
import com.example.expensetracker.domain.user.repository.UserRepository;
import com.example.expensetracker.domain.user.repository.WebAuthnChallengeRepository;
import com.example.expensetracker.domain.user.repository.WebAuthnCredentialRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration test verifying ordered {@link UserCleanupParticipant} cascade deletion
 * across user-owned domain entities, OTPs, and WebAuthn ceremonies without FK violations.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class UserCascadeDeletionIntegrationTest {

    @Autowired private List<UserCleanupParticipant> cleanupParticipants;
    @Autowired private UserCascadeDeletionService cascadeDeletionService;
    @Autowired private UserRepository userRepository;
    @Autowired private CategoryRepository categoryRepository;
    @Autowired private ExpenseRepository expenseRepository;
    @Autowired private BudgetRepository budgetRepository;
    @Autowired private IncomeRepository incomeRepository;
    @Autowired private PasswordResetOtpRepository otpRepository;
    @Autowired private WebAuthnChallengeRepository webAuthnChallengeRepository;
    @Autowired private WebAuthnCredentialRepository webAuthnCredentialRepository;

    @Test
    void cascadeDeleteRemovesAllOwnedUserRecordsAndLeavesOtherUsersUntouched() {
        assertThat(cleanupParticipants).hasSizeGreaterThanOrEqualTo(10);

        long ts = System.nanoTime();
        User target = userRepository.save(User.builder()
                .name("Target User")
                .username("target_" + ts)
                .email("TARGET_" + ts + "@test.com")
                .password("SecureP@ss123")
                .role(Role.ROLE_USER)
                .enabled(true)
                .build());
        User bystander = userRepository.save(User.builder()
                .name("Bystander User")
                .username("bystander_" + ts)
                .email("bystander_" + ts + "@test.com")
                .password("SecureP@ss123")
                .role(Role.ROLE_USER)
                .enabled(true)
                .build());

        Category targetCat = categoryRepository.save(Category.builder().name("Food_" + ts).user(target).build());
        Category bystanderCat = categoryRepository.save(Category.builder().name("Food_" + ts).user(bystander).build());

        expenseRepository.save(Expense.builder()
                .user(target).category(targetCat).amount(new BigDecimal("12.00"))
                .description("Coffee").expenseDate(LocalDate.now()).build());
        expenseRepository.save(Expense.builder()
                .user(bystander).category(bystanderCat).amount(new BigDecimal("20.00"))
                .description("Tea").expenseDate(LocalDate.now()).build());

        budgetRepository.save(Budget.builder().user(target).category(targetCat).limitAmount(new BigDecimal("100.00")).build());
        incomeRepository.save(Income.builder().user(target).amount(new BigDecimal("500.00")).source("Salary").incomeDate(LocalDate.now()).build());

        otpRepository.save(PasswordResetOtp.builder()
                .email(target.getEmail().toLowerCase())
                .otpHash("hash")
                .expiresAt(LocalDateTime.now().plusMinutes(10))
                .purpose("PASSWORD_RESET")
                .build());
        webAuthnChallengeRepository.save(WebAuthnChallenge.builder()
                .id("chal-" + ts)
                .userId(target.getId())
                .ceremony("registration")
                .requestJson("{}")
                .expiresAt(LocalDateTime.now().plusMinutes(5))
                .build());
        webAuthnCredentialRepository.save(WebAuthnCredential.builder()
                .user(target)
                .credentialId("cred-" + ts)
                .userHandle("handle-" + ts)
                .publicKeyCose("pk")
                .signatureCount(0L)
                .build());

        cascadeDeletionService.cascadeDeleteUserData(target.getId(), target);
        userRepository.deleteById(target.getId());
        userRepository.flush();

        assertThat(userRepository.findById(target.getId())).isEmpty();
        assertThat(expenseRepository.findByUser(target)).isEmpty();
        assertThat(budgetRepository.findByUser(target)).isEmpty();
        assertThat(incomeRepository.findByUser(target)).isEmpty();
        assertThat(categoryRepository.findByUser(target)).isEmpty();
        assertThat(otpRepository.findFirstByEmailAndPurposeAndUsedFalseOrderByCreatedAtDesc(
                target.getEmail().toLowerCase(), "PASSWORD_RESET")).isEmpty();
        assertThat(webAuthnChallengeRepository.findById("chal-" + ts)).isEmpty();
        assertThat(webAuthnCredentialRepository.findByUserId(target.getId())).isEmpty();

        assertThat(userRepository.findById(bystander.getId())).isPresent();
        assertThat(expenseRepository.findByUser(bystander)).hasSize(1);
    }
}
