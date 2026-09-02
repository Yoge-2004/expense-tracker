package com.example.expensetracker.service;

import com.example.expensetracker.dto.SavingsGoalDto;
import com.example.expensetracker.dto.SavingsGoalRequest;
import com.example.expensetracker.model.SavingsGoal;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.SavingsGoalRepository;
import com.example.expensetracker.service.impl.SavingsGoalServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("SavingsGoalServiceImpl Unit Tests")
class SavingsGoalServiceImplTest {

    @Mock
    private SavingsGoalRepository savingsGoalRepository;

    private SavingsGoalServiceImpl savingsGoalService;
    private User testUser;
    private User otherUser;

    @BeforeEach
    void setUp() {
        savingsGoalService = new SavingsGoalServiceImpl(savingsGoalRepository);

        testUser = new User();
        testUser.setId(1L);
        testUser.setName("Yogeshwaran");
        testUser.setEmail("yoge@example.com");

        otherUser = new User();
        otherUser.setId(2L);
        otherUser.setName("Other");
    }

    @Test
    @DisplayName("createGoal → creates new savings goal with 0% initial progress")
    void createGoal_success() {
        SavingsGoalRequest req = new SavingsGoalRequest();
        req.setName("Emergency Fund");
        req.setTargetAmount(new BigDecimal("100000.00"));
        req.setCurrentAmount(BigDecimal.ZERO);
        req.setTargetDate(LocalDate.of(2027, 1, 1));

        when(savingsGoalRepository.save(any(SavingsGoal.class))).thenAnswer(invocation -> {
            SavingsGoal g = invocation.getArgument(0);
            g.setId(10L);
            return g;
        });

        SavingsGoalDto dto = savingsGoalService.createGoal(req, testUser);

        assertThat(dto).isNotNull();
        assertThat(dto.getId()).isEqualTo(10L);
        assertThat(dto.getName()).isEqualTo("Emergency Fund");
        assertThat(dto.getTargetAmount()).isEqualByComparingTo("100000.00");
        assertThat(dto.getCurrentAmount()).isEqualByComparingTo("0");
        assertThat(dto.getProgressPercentage()).isEqualTo(0.0);
        assertThat(dto.getStatus()).isEqualTo("IN_PROGRESS");
    }

    @Test
    @DisplayName("getUserGoals → returns user goals with progress percentage")
    void getUserGoals_returnsList() {
        SavingsGoal goal = new SavingsGoal();
        goal.setId(10L);
        goal.setName("Laptop");
        goal.setTargetAmount(new BigDecimal("80000.00"));
        goal.setCurrentAmount(new BigDecimal("40000.00"));
        goal.setStatus("IN_PROGRESS");
        goal.setUser(testUser);

        when(savingsGoalRepository.findByUser(testUser)).thenReturn(List.of(goal));

        List<SavingsGoalDto> goals = savingsGoalService.getUserGoals(testUser);

        assertThat(goals).hasSize(1);
        assertThat(goals.get(0).getName()).isEqualTo("Laptop");
        assertThat(goals.get(0).getProgressPercentage()).isEqualTo(50.0);
    }

    @Test
    @DisplayName("depositToGoal → increments currentAmount and marks COMPLETED if target reached")
    void depositToGoal_reachesTarget_marksCompleted() {
        SavingsGoal goal = new SavingsGoal();
        goal.setId(10L);
        goal.setName("Bike");
        goal.setTargetAmount(new BigDecimal("50000.00"));
        goal.setCurrentAmount(new BigDecimal("45000.00"));
        goal.setStatus("IN_PROGRESS");
        goal.setUser(testUser);

        when(savingsGoalRepository.findById(10L)).thenReturn(Optional.of(goal));
        when(savingsGoalRepository.save(any(SavingsGoal.class))).thenAnswer(invocation -> invocation.getArgument(0));

        SavingsGoalDto updated = savingsGoalService.depositToGoal(10L, new BigDecimal("6000.00"), testUser);

        assertThat(updated.getCurrentAmount()).isEqualByComparingTo("51000.00");
        assertThat(updated.getStatus()).isEqualTo("COMPLETED");
        assertThat(updated.getProgressPercentage()).isEqualTo(102.0);
    }

    @Test
    @DisplayName("depositToGoal → increments currentAmount and stays IN_PROGRESS if target not reached")
    void depositToGoal_notReachesTarget_staysInProgress() {
        SavingsGoal goal = new SavingsGoal();
        goal.setId(10L);
        goal.setName("Bike");
        goal.setTargetAmount(new BigDecimal("50000.00"));
        goal.setCurrentAmount(new BigDecimal("10000.00"));
        goal.setStatus("IN_PROGRESS");
        goal.setUser(testUser);

        when(savingsGoalRepository.findById(10L)).thenReturn(Optional.of(goal));
        when(savingsGoalRepository.save(any(SavingsGoal.class))).thenAnswer(invocation -> invocation.getArgument(0));

        SavingsGoalDto updated = savingsGoalService.depositToGoal(10L, new BigDecimal("5000.00"), testUser);

        assertThat(updated.getCurrentAmount()).isEqualByComparingTo("15000.00");
        assertThat(updated.getStatus()).isEqualTo("IN_PROGRESS");
        assertThat(updated.getProgressPercentage()).isEqualTo(30.0);
    }

    @Test
    @DisplayName("depositToGoal → rejects zero or negative deposit")
    void depositToGoal_negative_throwsException() {
        assertThatThrownBy(() -> savingsGoalService.depositToGoal(10L, BigDecimal.ZERO, testUser))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Deposit amount must be greater than zero");
    }

    @Test
    @DisplayName("depositToGoal → throws exception if goal belongs to another user")
    void depositToGoal_wrongUser_throwsException() {
        SavingsGoal goal = new SavingsGoal();
        goal.setId(10L);
        goal.setUser(otherUser);

        when(savingsGoalRepository.findById(10L)).thenReturn(Optional.of(goal));

        assertThatThrownBy(() -> savingsGoalService.depositToGoal(10L, new BigDecimal("1000.00"), testUser))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Savings goal does not belong to this user");
    }

    @Test
    @DisplayName("deleteGoal → deletes goal if owned by user")
    void deleteGoal_success() {
        SavingsGoal goal = new SavingsGoal();
        goal.setId(10L);
        goal.setUser(testUser);

        when(savingsGoalRepository.findById(10L)).thenReturn(Optional.of(goal));

        savingsGoalService.deleteGoal(10L, testUser);

        verify(savingsGoalRepository).delete(goal);
    }
}
