package com.example.expensetracker.domain.budget.api;

import com.example.expensetracker.domain.budget.dto.BudgetStatusDto;
import com.example.expensetracker.domain.budget.service.BudgetService;
import com.example.expensetracker.domain.user.security.CustomUserDetailsService;
import com.example.expensetracker.domain.user.security.UserSecurity;
import com.example.expensetracker.infrastructure.security.BrowserSessionCookieService;
import com.example.expensetracker.infrastructure.security.JwtAuthenticationFilter;
import com.example.expensetracker.infrastructure.security.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(
        controllers = BudgetController.class,
        excludeFilters = @ComponentScan.Filter(
                type = FilterType.ASSIGNABLE_TYPE,
                classes = JwtAuthenticationFilter.class))
@AutoConfigureMockMvc(addFilters = false)
class BudgetControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean private BudgetService budgetService;
    @MockitoBean private UserSecurity userSecurity;
    @MockitoBean private JwtService jwtService;
    @MockitoBean private CustomUserDetailsService customUserDetailsService;
    @MockitoBean private BrowserSessionCookieService browserSessionCookieService;

    @Test
    void setBudgetRejectsNullCategoryIdViaBeanValidation() throws Exception {
        mockMvc.perform(post("/api/expenses/budget/user/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"limitAmount\": 1000.00, \"period\": \"MONTHLY\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("categoryId: Category ID is required"));

        verifyNoInteractions(budgetService);
    }

    @Test
    void setBudgetAcceptsLimitAliasAndDelegatesToService() throws Exception {
        mockMvc.perform(post("/api/expenses/budget/user/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"categoryId\": 3, \"limit\": 2500.50, \"period\": \"MONTHLY\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Budget set successfully"));

        verify(userSecurity).validateUserAccess(7L);
        verify(budgetService).setBudget(eq(7L), any());
    }

    @Test
    void getBudgetStatusReturnsServiceStatuses() throws Exception {
        when(budgetService.getBudgetStatus(7L)).thenReturn(List.of(
                new BudgetStatusDto(1L, 3L, "Food", new BigDecimal("5000"),
                        new BigDecimal("1250"), 25.0, "MONTHLY", null,
                        LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 30))));

        mockMvc.perform(get("/api/expenses/budget/status/user/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].categoryName").value("Food"))
                .andExpect(jsonPath("$[0].percentage").value(25.0));
    }
}
