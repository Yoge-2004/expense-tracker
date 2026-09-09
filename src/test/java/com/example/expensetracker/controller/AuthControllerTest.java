package com.example.expensetracker.controller;

import com.example.expensetracker.model.User;
import com.example.expensetracker.security.CustomUserDetails;
import com.example.expensetracker.security.CustomUserDetailsService;
import com.example.expensetracker.security.GoogleIdTokenVerifier;
import com.example.expensetracker.security.JwtService;
import com.example.expensetracker.service.PasswordResetService;
import com.example.expensetracker.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AuthController.class)
@AutoConfigureMockMvc(addFilters = false)
class AuthControllerTest {

    @Autowired
    MockMvc mockMvc;

    @MockitoBean AuthenticationManager authenticationManager;
    @MockitoBean JwtService jwtService;
    @MockitoBean UserService userService;
    @MockitoBean GoogleIdTokenVerifier googleIdTokenVerifier;
    @MockitoBean PasswordResetService passwordResetService;
    @MockitoBean CustomUserDetailsService customUserDetailsService;

    private User user;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setId(42L);
        user.setName("Jane Doe");
        user.setEmail("jane@example.com");
        user.setCurrency("INR");
    }

    @Test
    void authConfigReturnsPublicVerificationFlag() throws Exception {
        mockMvc.perform(get("/api/auth/config"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.emailVerificationEnabled").isBoolean());
    }

    @Test
    void registerCreatesUserAndReturnsCreatedDto() throws Exception {
        when(userService.registerUser(any(User.class))).thenReturn(user);

        mockMvc.perform(post("/api/auth/register")
                        .contentType("application/json")
                        .content("""
                                {
                                  "name":"Jane Doe",
                                  "username":"jane_doe",
                                  "email":"jane@example.com",
                                  "password":"secret123",
                                  "currency":"INR"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(42))
                .andExpect(jsonPath("$.name").value("Jane Doe"))
                .andExpect(jsonPath("$.email").value("jane@example.com"));

        verify(userService).registerUser(argThat(candidate ->
                "Jane Doe".equals(candidate.getName())
                        && "jane_doe".equals(candidate.getUsername())
                        && "jane@example.com".equals(candidate.getEmail())
                        && "secret123".equals(candidate.getPassword())
                        && "INR".equals(candidate.getCurrency())));
        verifyNoInteractions(passwordResetService);
    }

    @Test
    void registerRejectsInvalidUsernameBeforeCallingService() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType("application/json")
                        .content("""
                                {
                                  "name":"Jane Doe",
                                  "username":"bad username!",
                                  "email":"jane@example.com",
                                  "password":"secret123"
                                }
                                """))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(userService, passwordResetService);
    }

    @Test
    void registerRejectsShortPasswordBeforeCallingService() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType("application/json")
                        .content("""
                                {
                                  "name":"Jane Doe",
                                  "username":"jane_doe",
                                  "email":"jane@example.com",
                                  "password":"12345"
                                }
                                """))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(userService, passwordResetService);
    }

    @Test
    void sendSignupOtpDelegatesEmailAndNameWithoutCreatingAccount() throws Exception {
        mockMvc.perform(post("/api/auth/signup/send-otp")
                        .contentType("application/json")
                        .content("""
                                {"email":"jane@example.com","name":"Jane Doe"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("If this email is eligible, a verification code has been dispatched."))
                .andExpect(jsonPath("$.emailVerificationEnabled").isString());

        verify(passwordResetService).sendSignupOtp("jane@example.com", "Jane Doe");
        verifyNoInteractions(userService);
    }

    @Test
    void loginTrimsIdentifierAndReturnsJwtAndUserDetails() throws Exception {
        Authentication authentication = mock(Authentication.class);
        CustomUserDetails principal = mock(CustomUserDetails.class);
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenReturn(authentication);
        when(authentication.getPrincipal()).thenReturn(principal);
        when(principal.getUser()).thenReturn(user);
        when(jwtService.generateToken("jane@example.com")).thenReturn("signed.jwt.token");

        mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content("""
                                {"email":"  jane@example.com  ","password":"secret123"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("signed.jwt.token"))
                .andExpect(jsonPath("$.userId").value(42))
                .andExpect(jsonPath("$.name").value("Jane Doe"))
                .andExpect(jsonPath("$.currency").value("INR"));

        verify(authenticationManager).authenticate(argThat(token ->
                "jane@example.com".equals(token.getName())
                        && "secret123".equals(token.getCredentials())));
        verify(jwtService).generateToken("jane@example.com");
        verifyNoInteractions(userService);
    }
}
