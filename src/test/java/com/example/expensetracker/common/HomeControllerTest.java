package com.example.expensetracker.common;

import com.example.expensetracker.infrastructure.security.BrowserSessionCookieService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.expensetracker.infrastructure.security.CustomUserDetailsService;
import com.example.expensetracker.infrastructure.security.JwtAuthenticationFilter;
import com.example.expensetracker.infrastructure.security.JwtService;



/**
 * {@link HomeController} was previously the only controller in this codebase
 * with zero test coverage. Its logic is a single unconditional redirect, so
 * this test is intentionally small — there's no branching logic, no input to
 * vary, nothing character-level to probe here.
 */
@WebMvcTest(
        controllers = HomeController.class,
        excludeFilters = @ComponentScan.Filter(
                type = org.springframework.context.annotation.FilterType.ASSIGNABLE_TYPE,
                classes = JwtAuthenticationFilter.class))
@AutoConfigureMockMvc(addFilters = false)
class HomeControllerTest {
    @MockitoBean BrowserSessionCookieService browserSessionCookieService;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private JwtService jwtService;

    @MockitoBean
    private CustomUserDetailsService customUserDetailsService;

    @Test
    @DisplayName("GET / redirects (302) to /swagger-ui.html")
    void rootRedirectsToSwaggerUi() throws Exception {
        mockMvc.perform(get("/"))
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrl("/swagger-ui.html"));
    }
}
