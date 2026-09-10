package com.example.expensetracker.controller;

import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.security.CustomUserDetailsService;
import com.example.expensetracker.security.GoogleIdTokenVerifier;
import com.example.expensetracker.security.JwtAuthenticationFilter;
import com.example.expensetracker.security.JwtService;
import com.example.expensetracker.security.UserSecurity;
import com.example.expensetracker.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(
        controllers = UserController.class,
        excludeFilters = @ComponentScan.Filter(
                type = org.springframework.context.annotation.FilterType.ASSIGNABLE_TYPE,
                classes = JwtAuthenticationFilter.class))
@AutoConfigureMockMvc(addFilters = false)
class UserControllerTest {

    @Autowired MockMvc mockMvc;

    @MockitoBean UserService userService;
    @MockitoBean UserRepository userRepository;
    @MockitoBean UserSecurity userSecurity;
    @MockitoBean PasswordEncoder passwordEncoder;
    @MockitoBean GoogleIdTokenVerifier googleIdTokenVerifier;
    @MockitoBean JwtService jwtService;
    @MockitoBean CustomUserDetailsService customUserDetailsService;

    private User user;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setId(7L);
        user.setName("Jane Doe");
        user.setEmail("jane@example.com");
        user.setCurrency("INR");
        user.setPassword("hashed-password");
    }

    @Test
    void checkUsernameRejectsBlankValueWithoutRepositoryLookup() throws Exception {
        mockMvc.perform(get("/api/users/check-username").queryParam("username", "   "))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.available").value(false))
                .andExpect(jsonPath("$.message").value("Username cannot be empty"));

        verifyNoInteractions(userRepository);
    }

    @Test
    void checkUsernameRejectsInvalidFormatWithoutRepositoryLookup() throws Exception {
        mockMvc.perform(get("/api/users/check-username").queryParam("username", "ab-"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(false))
                .andExpect(jsonPath("$.message").value("Username must be 3-30 alphanumeric characters or underscores"));

        verifyNoInteractions(userRepository);
    }

    @Test
    void checkUsernameTrimsValidInputAndUsesCaseInsensitiveRepositoryLookup() throws Exception {
        when(userRepository.findByUsernameIgnoreCase("Alice_01")).thenReturn(Optional.of(user));

        mockMvc.perform(get("/api/users/check-username").queryParam("username", "  Alice_01  "))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("Alice_01"))
                .andExpect(jsonPath("$.available").value(false))
                .andExpect(jsonPath("$.message").value("Username is already taken"));

        verify(userRepository).findByUsernameIgnoreCase("Alice_01");
    }

    @Test
    void checkUsernameReportsAvailableWhenNoCaseInsensitiveMatchExists() throws Exception {
        when(userRepository.findByUsernameIgnoreCase("alice_01")).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/users/check-username").queryParam("username", "alice_01"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("alice_01"))
                .andExpect(jsonPath("$.available").value(true))
                .andExpect(jsonPath("$.message").value("Username is available!"));
    }

    @Test
    void suggestUsernamesReturnsExactlyThreeUniqueAvailableCandidates() throws Exception {
        when(userRepository.findByUsernameIgnoreCase(anyString())).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/users/suggest-usernames").queryParam("base", "Jane Doe"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.suggestions").isArray())
                .andExpect(jsonPath("$.suggestions.length()").value(3))
                .andExpect(jsonPath("$.suggestions[0]").isString())
                .andExpect(jsonPath("$.suggestions[1]").isString())
                .andExpect(jsonPath("$.suggestions[2]").isString());

        verify(userRepository, atLeast(3)).findByUsernameIgnoreCase(anyString());
    }

    @Test
    void suggestUsernamesFallsBackToUserForPunctuationOnlyBase() throws Exception {
        when(userRepository.findByUsernameIgnoreCase(anyString())).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/users/suggest-usernames").queryParam("base", "!!!"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.suggestions.length()").value(3));

        verify(userRepository).findByUsernameIgnoreCase("iam_user");
    }

    @Test
    void suggestUsernamesSkipsTakenCandidatesAndStillReturnsThree() throws Exception {
        when(userRepository.findByUsernameIgnoreCase("iam_jane")).thenReturn(Optional.of(user));
        when(userRepository.findByUsernameIgnoreCase("the_jane")).thenReturn(Optional.of(user));
        when(userRepository.findByUsernameIgnoreCase("real_jane")).thenReturn(Optional.of(user));
        when(userRepository.findByUsernameIgnoreCase(anyString())).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/users/suggest-usernames").queryParam("base", "Jane"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.suggestions.length()").value(3));

        verify(userRepository).findByUsernameIgnoreCase("iam_jane");
        verify(userRepository).findByUsernameIgnoreCase("the_jane");
        verify(userRepository).findByUsernameIgnoreCase("real_jane");
    }

    @Test
    void getUserProfileReturnsOnlyPublicProfileFields() throws Exception {
        when(userService.findById(7L)).thenReturn(Optional.of(user));

        mockMvc.perform(get("/api/users/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(7))
                .andExpect(jsonPath("$.name").value("Jane Doe"))
                .andExpect(jsonPath("$.email").value("jane@example.com"))
                .andExpect(jsonPath("$.currency").value("INR"))
                .andExpect(jsonPath("$.hasSecurityPin").value(false))
                .andExpect(jsonPath("$.password").doesNotExist());

        verify(userSecurity).validateUserAccess(7L);
    }

    @Test
    void getUserProfileReturnsBadRequestWhenUserMissing() throws Exception {
        when(userService.findById(7L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/users/7"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("User not found"));
    }

    @Test
    void updateSecurityPinRejectsNonSixDigitPinBeforeServiceUpdate() throws Exception {
        mockMvc.perform(put("/api/users/7/security-pin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"securityPin\":\"12345\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Security PIN must be exactly 6 numeric digits."));

        verify(userSecurity).validateUserAccess(7L);
        verify(userService, never()).updateSecurityPin(anyLong(), anyString());
    }

    @Test
    void updateSecurityPinTrimsValidPinAndDelegates() throws Exception {
        mockMvc.perform(put("/api/users/7/security-pin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"securityPin\":\" 123456 \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Security PIN updated successfully"));

        verify(userSecurity).validateUserAccess(7L);
        verify(userService).updateSecurityPin(7L, "123456");
    }

    @Test
    void verifySecurityPinRejectsInvalidFormatBeforeVerificationCall() throws Exception {
        mockMvc.perform(post("/api/users/7/verify-security-pin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"securityPin\":\"12ab56\"}"))
                .andExpect(status().isBadRequest());

        verify(userSecurity).validateUserAccess(7L);
        verify(userService, never()).verifySecurityPin(anyLong(), anyString());
    }

    @Test
    void verifySecurityPinReturnsUnauthorizedForIncorrectPin() throws Exception {
        when(userService.verifySecurityPin(7L, "123456")).thenReturn(false);

        mockMvc.perform(post("/api/users/7/verify-security-pin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"securityPin\":\"123456\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.valid").value(false))
                .andExpect(jsonPath("$.message").value("Invalid security PIN."));
    }

    @Test
    void verifySecurityPinReturnsSuccessForCorrectPin() throws Exception {
        when(userService.verifySecurityPin(7L, "123456")).thenReturn(true);

        mockMvc.perform(post("/api/users/7/verify-security-pin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"securityPin\":\"123456\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valid").value(true))
                .andExpect(jsonPath("$.message").value("Security PIN verified successfully."));
    }

    @Test
    void deleteAccountRejectsMissingConfirmationBeforeDelete() throws Exception {
        when(userService.findById(7L)).thenReturn(Optional.of(user));

        mockMvc.perform(delete("/api/users/7"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid or missing password confirmation. Account deletion requires re-authentication."));

        verify(userService, never()).deleteUser(7L);
    }

    @Test
    void deleteAccountUsesPasswordConfirmationAndDeletesOnlyAfterMatch() throws Exception {
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("correct", "hashed-password")).thenReturn(true);

        mockMvc.perform(delete("/api/users/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"correct\"}"))
                .andExpect(status().isNoContent());

        verify(passwordEncoder).matches("correct", "hashed-password");
        verify(userService).deleteUser(7L);
    }

    @Test
    void deleteAccountRejectsIncorrectPasswordAndDoesNotDelete() throws Exception {
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong", "hashed-password")).thenReturn(false);

        mockMvc.perform(delete("/api/users/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"wrong\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Incorrect password. Account deletion requires valid password confirmation."));

        verify(userService, never()).deleteUser(7L);
    }

    @Test
    void deleteAccountCanUseSecurityPinConfirmation() throws Exception {
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(userService.verifySecurityPin(7L, "123456")).thenReturn(true);

        mockMvc.perform(delete("/api/users/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"securityPin\":\"123456\"}"))
                .andExpect(status().isNoContent());

        verify(userService).verifySecurityPin(7L, "123456");
        verify(userService).deleteUser(7L);
        verifyNoInteractions(passwordEncoder);
    }

    @Test
    void updateCurrencyRejectsInvalidLength() throws Exception {
        mockMvc.perform(put("/api/users/7/currency")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currency\":\"US\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Currency must be a 3-letter ISO 4217 code."));

        verify(userSecurity).validateUserAccess(7L);
        verify(userService, never()).updateCurrency(anyLong(), anyString());
    }

    @Test
    void updateCurrencyNormalizesCodeToUppercase() throws Exception {
        // FIXED: controller now uppercases the currency BEFORE delegating to the service,
        // so the service receives "USD" (not "usd"). This matches the service's own
        // contract (it also uppercases internally) and makes the mock verification pass.
        mockMvc.perform(put("/api/users/7/currency")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currency\":\"usd\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currency").value("USD"));

        verify(userSecurity).validateUserAccess(7L);
        verify(userService).updateCurrency(7L, "USD");
    }
}
