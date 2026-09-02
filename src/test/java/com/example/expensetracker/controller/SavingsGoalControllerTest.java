package com.example.expensetracker.controller;

import com.example.expensetracker.dto.SavingsDepositRequest;
import com.example.expensetracker.dto.SavingsGoalDto;
import com.example.expensetracker.dto.SavingsGoalRequest;
import com.example.expensetracker.model.User;
import com.example.expensetracker.security.CustomUserDetailsService;
import com.example.expensetracker.security.JwtService;
import com.example.expensetracker.service.SavingsGoalService;
import com.example.expensetracker.service.UserService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(SavingsGoalController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("SavingsGoalController Tests")
class SavingsGoalControllerTest {

    @Autowired
    private MockMvc mockMvc;

    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());

    @MockitoBean private SavingsGoalService savingsGoalService;
    @MockitoBean private UserService userService;
    @MockitoBean private JwtService jwtService;
    @MockitoBean private CustomUserDetailsService customUserDetailsService;

    private User sampleUser;
    private SavingsGoalDto sampleGoalDto;

    @BeforeEach
    void setUp() {
        sampleUser = new User();
        sampleUser.setId(1L);
        sampleUser.setName("Yogeshwaran");
        sampleUser.setEmail("yoge@example.com");

        sampleGoalDto = new SavingsGoalDto(
                10L,
                "New Laptop",
                new BigDecimal("80000.00"),
                new BigDecimal("20000.00"),
                LocalDate.of(2026, 12, 31),
                "IN_PROGRESS",
                25.0
        );
    }

    @Nested
    @DisplayName("POST /api/savings/goals/user/{userId}")
    class CreateGoal {

        @Test
        @WithMockUser
        @DisplayName("→ 201 Created on valid goal request")
        void validGoal_returns201() throws Exception {
            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            when(savingsGoalService.createGoal(any(SavingsGoalRequest.class), eq(sampleUser)))
                    .thenReturn(sampleGoalDto);

            Map<String, Object> body = Map.of(
                    "name", "New Laptop",
                    "targetAmount", 80000.00,
                    "currentAmount", 20000.00,
                    "targetDate", "2026-12-31"
            );

            mockMvc.perform(post("/api/savings/goals/user/1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.id").value(10))
                    .andExpect(jsonPath("$.name").value("New Laptop"))
                    .andExpect(jsonPath("$.targetAmount").value(80000.00))
                    .andExpect(jsonPath("$.progressPercentage").value(25.0));
        }

        @Test
        @WithMockUser
        @DisplayName("→ 400 Bad Request when name is blank")
        void blankName_returns400() throws Exception {
            Map<String, Object> body = Map.of(
                    "name", "  ",
                    "targetAmount", 80000.00
            );

            mockMvc.perform(post("/api/savings/goals/user/1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @WithMockUser
        @DisplayName("→ 400 Bad Request when target amount is negative")
        void negativeTarget_returns400() throws Exception {
            Map<String, Object> body = Map.of(
                    "name", "Bike",
                    "targetAmount", -500.00
            );

            mockMvc.perform(post("/api/savings/goals/user/1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isBadRequest());
        }
    }

    @Nested
    @DisplayName("GET /api/savings/goals/user/{userId}")
    class GetGoals {

        @Test
        @WithMockUser
        @DisplayName("→ 200 OK with list of savings goals")
        void returnsGoalList() throws Exception {
            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            when(savingsGoalService.getUserGoals(sampleUser)).thenReturn(List.of(sampleGoalDto));

            mockMvc.perform(get("/api/savings/goals/user/1"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(1))
                    .andExpect(jsonPath("$[0].name").value("New Laptop"))
                    .andExpect(jsonPath("$[0].progressPercentage").value(25.0));
        }
    }

    @Nested
    @DisplayName("POST /api/savings/goals/{goalId}/deposit/user/{userId}")
    class DepositToGoal {

        @Test
        @WithMockUser
        @DisplayName("→ 200 OK with updated savings goal")
        void validDeposit_returns200() throws Exception {
            SavingsGoalDto updatedDto = new SavingsGoalDto(
                    10L,
                    "New Laptop",
                    new BigDecimal("80000.00"),
                    new BigDecimal("30000.00"),
                    LocalDate.of(2026, 12, 31),
                    "IN_PROGRESS",
                    37.5
            );

            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            when(savingsGoalService.depositToGoal(eq(10L), any(BigDecimal.class), eq(sampleUser)))
                    .thenReturn(updatedDto);

            Map<String, Object> body = Map.of("amount", 10000.00);

            mockMvc.perform(post("/api/savings/goals/10/deposit/user/1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.currentAmount").value(30000.00))
                    .andExpect(jsonPath("$.progressPercentage").value(37.5));
        }

        @Test
        @WithMockUser
        @DisplayName("→ 400 Bad Request when deposit amount is zero")
        void zeroDeposit_returns400() throws Exception {
            Map<String, Object> body = Map.of("amount", 0.00);

            mockMvc.perform(post("/api/savings/goals/10/deposit/user/1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isBadRequest());
        }
    }

    @Nested
    @DisplayName("DELETE /api/savings/goals/{goalId}/user/{userId}")
    class DeleteGoal {

        @Test
        @WithMockUser
        @DisplayName("→ 204 No Content on successful deletion")
        void validDelete_returns204() throws Exception {
            when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
            doNothing().when(savingsGoalService).deleteGoal(10L, sampleUser);

            mockMvc.perform(delete("/api/savings/goals/10/user/1"))
                    .andExpect(status().isNoContent());

            verify(savingsGoalService).deleteGoal(10L, sampleUser);
        }
    }
}
