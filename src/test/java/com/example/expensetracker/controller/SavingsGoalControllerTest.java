package com.example.expensetracker.controller;

import com.example.expensetracker.dto.CashFlowSummaryDto;
import com.example.expensetracker.dto.SavingsGoalDto;
import com.example.expensetracker.model.User;
import com.example.expensetracker.security.CustomUserDetailsService;
import com.example.expensetracker.security.JwtAuthenticationFilter;
import com.example.expensetracker.security.JwtService;
import com.example.expensetracker.security.UserSecurity;
import com.example.expensetracker.service.SavingsGoalService;
import com.example.expensetracker.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(
        controllers = SavingsGoalController.class,
        excludeFilters = @ComponentScan.Filter(
                type = org.springframework.context.annotation.FilterType.ASSIGNABLE_TYPE,
                classes = JwtAuthenticationFilter.class))
@AutoConfigureMockMvc(addFilters = false)
class SavingsGoalControllerTest {

    @Autowired MockMvc mockMvc;

    @MockitoBean SavingsGoalService savingsGoalService;
    @MockitoBean UserService userService;
    @MockitoBean UserSecurity userSecurity;
    @MockitoBean JwtService jwtService;
    @MockitoBean CustomUserDetailsService customUserDetailsService;

    private User user;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setId(7L);
        user.setName("Jane Doe");
    }

    @Test
    void createGoalReturnsCreatedDtoAndDelegatesOwner() throws Exception {
        SavingsGoalDto created = goal(10L, "Emergency Fund", "100000", "15000", "2026-12-31", "IN_PROGRESS", 15);
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(savingsGoalService.createGoal(any(), same(user))).thenReturn(created);

        mockMvc.perform(post("/api/savings/goals/user/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Emergency Fund","targetAmount":100000,"currentAmount":15000,"targetDate":"2026-12-31"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(10))
                .andExpect(jsonPath("$.name").value("Emergency Fund"))
                .andExpect(jsonPath("$.targetAmount").value(100000))
                .andExpect(jsonPath("$.currentAmount").value(15000))
                .andExpect(jsonPath("$.progressPercentage").value(15.0));

        verify(userSecurity).validateUserAccess(7L);
        verify(savingsGoalService).createGoal(any(), same(user));
    }

    @Test
    void createGoalRejectsInvalidPayloadBeforeLookup() throws Exception {
        mockMvc.perform(post("/api/savings/goals/user/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\",\"targetAmount\":0}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));

        verifyNoInteractions(userSecurity, userService, savingsGoalService);
    }

    @Test
    void createGoalReturnsBadRequestWhenUserMissing() throws Exception {
        when(userService.findById(7L)).thenReturn(Optional.empty());

        mockMvc.perform(post("/api/savings/goals/user/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Travel\",\"targetAmount\":50000}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("User not found"));

        verify(savingsGoalService, never()).createGoal(any(), any(User.class));
    }

    @Test
    void getUserGoalsReturnsServiceResults() throws Exception {
        SavingsGoalDto first = goal(10L, "Emergency Fund", "100000", "45000", "2026-12-31", "IN_PROGRESS", 45);
        SavingsGoalDto second = goal(11L, "Travel", "50000", "50000", "2026-10-31", "COMPLETED", 100);
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(savingsGoalService.getUserGoals(user)).thenReturn(List.of(first, second));

        mockMvc.perform(get("/api/savings/goals/user/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(10))
                .andExpect(jsonPath("$[0].progressPercentage").value(45.0))
                .andExpect(jsonPath("$[1].status").value("COMPLETED"));

        verify(savingsGoalService).getUserGoals(user);
    }

    @Test
    void updateGoalValidatesOwnerAndReturnsUpdatedGoal() throws Exception {
        SavingsGoalDto updated = goal(10L, "Emergency Fund Plus", "120000", "50000", "2027-01-31", "IN_PROGRESS", 41.6667);
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(savingsGoalService.updateGoal(eq(10L), any(), same(user))).thenReturn(updated);

        mockMvc.perform(put("/api/savings/goals/10/user/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Emergency Fund Plus","targetAmount":120000,"currentAmount":50000,"targetDate":"2027-01-31"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Emergency Fund Plus"))
                .andExpect(jsonPath("$.targetAmount").value(120000));

        verify(userSecurity).validateUserAccess(7L);
        verify(savingsGoalService).updateGoal(eq(10L), any(), same(user));
    }

    @Test
    void depositReturnsUpdatedGoalAndPassesAmount() throws Exception {
        SavingsGoalDto updated = goal(10L, "Emergency Fund", "100000", "100000", "2026-12-31", "COMPLETED", 100);
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(savingsGoalService.depositToGoal(eq(10L), eq(new BigDecimal("55000")), same(user))).thenReturn(updated);

        mockMvc.perform(post("/api/savings/goals/10/deposit/user/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\":55000}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentAmount").value(100000))
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.progressPercentage").value(100.0));

        verify(userSecurity).validateUserAccess(7L);
        verify(savingsGoalService).depositToGoal(10L, new BigDecimal("55000"), user);
    }

    @Test
    void depositRejectsNonPositiveAmountBeforeService() throws Exception {
        mockMvc.perform(post("/api/savings/goals/10/deposit/user/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\":0}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));

        verifyNoInteractions(userSecurity, userService, savingsGoalService);
    }

    @Test
    void deleteGoalReturnsNoContentAndDelegates() throws Exception {
        when(userService.findById(7L)).thenReturn(Optional.of(user));

        mockMvc.perform(delete("/api/savings/goals/10/user/7"))
                .andExpect(status().isNoContent());

        verify(userSecurity).validateUserAccess(7L);
        verify(savingsGoalService).deleteGoal(10L, user);
    }

    @Test
    void getRecurringGoalsValidatesUserAndReturnsRecurringSubset() throws Exception {
        SavingsGoalDto recurring = goal(12L, "Monthly SIP", "120000", "30000", "2027-06-30", "IN_PROGRESS", 25);
        recurring.setIsRecurring(true);
        recurring.setRecurringAmount(new BigDecimal("10000"));
        recurring.setFrequency("MONTHLY");
        recurring.setNextDueDate(LocalDate.of(2026, 10, 1));
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(savingsGoalService.getRecurringGoals(user)).thenReturn(List.of(recurring));

        mockMvc.perform(get("/api/savings/goals/recurring/user/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(12))
                .andExpect(jsonPath("$[0].isRecurring").value(true))
                .andExpect(jsonPath("$[0].frequency").value("MONTHLY"))
                .andExpect(jsonPath("$[0].nextDueDate").value("2026-10-01"));

        verify(userSecurity).validateUserAccess(7L);
        verify(savingsGoalService).getRecurringGoals(user);
    }

    @Test
    void goalServiceFailureIsMappedToConflict() throws Exception {
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        doThrow(new IllegalStateException("Goal name already exists")).when(savingsGoalService).deleteGoal(10L, user);

        mockMvc.perform(delete("/api/savings/goals/10/user/7"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Goal name already exists"));
    }

    private static SavingsGoalDto goal(Long id, String name, String target, String current,
                                       String targetDate, String status, double progress) {
        SavingsGoalDto dto = new SavingsGoalDto();
        dto.setId(id);
        dto.setName(name);
        dto.setTargetAmount(new BigDecimal(target));
        dto.setCurrentAmount(new BigDecimal(current));
        dto.setTargetDate(LocalDate.parse(targetDate));
        dto.setStatus(status);
        dto.setProgressPercentage(progress);
        return dto;
    }
}
