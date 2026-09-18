package com.example.expensetracker.controller;

import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.security.GoogleIdTokenVerifier;
import com.example.expensetracker.security.JwtService;
import com.example.expensetracker.security.CustomUserDetailsService;
import com.example.expensetracker.security.UserSecurity;
import com.example.expensetracker.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(UserController.class)
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
        user.setUsername("jane_doe");
        user.setEmail("jane@example.com");
        user.setPassword("encodedPassword");
        user.setCurrency("INR");
        user.setEnabled(true);
    }

    @Test
    void checkUsernameRejectsBlankInput() throws Exception {
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
                .andExpect(jsonPath("$.message")
                        .value("Username must be 3-30 alphanumeric characters, dots, or underscores"));

        verifyNoInteractions(userRepository);
    }

    @Test
    void checkUsernameAllowsDotsInHandle() throws Exception {
        when(userRepository.findByUsernameIgnoreCase("john.doe")).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/users/check-username").queryParam("username", "john.doe"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("john.doe"))
                .andExpect(jsonPath("$.available").value(true))
                .andExpect(jsonPath("$.message").value("Username is available!"));

        verify(userRepository).findByUsernameIgnoreCase("john.doe");
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
                .andExpect(jsonPath("$.suggestions[0]").value("iam_janedoe"))
                .andExpect(jsonPath("$.suggestions[1]").value("the_janedoe"))
                .andExpect(jsonPath("$.suggestions[2]").value("real_janedoe"));

        verify(userRepository).findByUsernameIgnoreCase("iam_janedoe");
        verify(userRepository).findByUsernameIgnoreCase("the_janedoe");
        verify(userRepository).findByUsernameIgnoreCase("real_janedoe");
    }

    @Test
    void suggestUsernamesFallsBackToUserBaseWhenInputSanitizesToEmpty() throws Exception {
        when(userRepository.findByUsernameIgnoreCase(anyString())).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/users/suggest-usernames").queryParam("base", "!!!"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.suggestions").isArray())
                .andExpect(jsonPath("$.suggestions.length()").value(3))
                .andExpect(jsonPath("$.suggestions[0]").value("iam_user"));
    }

    @Test
    void suggestUsernamesGeneratesRandomSuffixesWhenPrefixCandidatesCollided() throws Exception {
        when(userRepository.findByUsernameIgnoreCase("iam_jane")).thenReturn(Optional.of(user));
        when(userRepository.findByUsernameIgnoreCase("the_jane")).thenReturn(Optional.of(user));
        when(userRepository.findByUsernameIgnoreCase("real_jane")).thenReturn(Optional.of(user));
        when(userRepository.findByUsernameIgnoreCase("hey_jane")).thenReturn(Optional.of(user));
        when(userRepository.findByUsernameIgnoreCase("go_jane")).thenReturn(Optional.of(user));
        when(userRepository.findByUsernameIgnoreCase(startsWith("jane"))).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/users/suggest-usernames").queryParam("base", "Jane"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.suggestions").isArray())
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
                .andExpect(jsonPath("$.username").value("jane_doe"))
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
    void updateSecurityPinRejectsMalformedPin() throws Exception {
        mockMvc.perform(put("/api/users/7/security-pin")
                        .contentType("application/json")
                        .content("{\"pin\":\"1234a\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Security PIN must be exactly 6 numeric digits"));

        verify(userSecurity).validateUserAccess(7L);
        verify(userService, never()).updateSecurityPin(anyLong(), anyString());
    }

    @Test
    void updateSecurityPinPersistsValidPin() throws Exception {
        mockMvc.perform(put("/api/users/7/security-pin")
                        .contentType("application/json")
                        .content("{\"pin\":\"123456\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Security PIN updated successfully"));

        verify(userSecurity).validateUserAccess(7L);
        verify(userService).updateSecurityPin(7L, "123456");
    }

    @Test
    void verifySecurityPinReturnsFalseForIncorrectPin() throws Exception {
        when(userService.verifySecurityPin(7L, "654321")).thenReturn(false);

        mockMvc.perform(post("/api/users/7/verify-security-pin")
                        .contentType("application/json")
                        .content("{\"pin\":\"654321\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valid").value(false))
                .andExpect(jsonPath("$.message").value("Incorrect Security PIN"));

        verify(userSecurity).validateUserAccess(7L);
        verify(userService).verifySecurityPin(7L, "654321");
    }

    @Test
    void verifySecurityPinReturnsTrueForCorrectPin() throws Exception {
        when(userService.verifySecurityPin(7L, "123456")).thenReturn(true);

        mockMvc.perform(post("/api/users/7/verify-security-pin")
                        .contentType("application/json")
                        .content("{\"pin\":\"123456\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valid").value(true))
                .andExpect(jsonPath("$.message").doesNotExist());

        verify(userSecurity).validateUserAccess(7L);
        verify(userService).verifySecurityPin(7L, "123456");
    }

    @Test
    void verifySecurityPinRejectsMalformedPin() throws Exception {
        mockMvc.perform(post("/api/users/7/verify-security-pin")
                        .contentType("application/json")
                        .content("{\"pin\":\"123\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Security PIN must be exactly 6 numeric digits"));

        verify(userSecurity).validateUserAccess(7L);
        verify(userService, never()).verifySecurityPin(anyLong(), anyString());
    }

    @Test
    void deleteAccountSucceedsWhenPasswordMatches() throws Exception {
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("myPassword", "encodedPassword")).thenReturn(true);

        mockMvc.perform(delete("/api/users/7")
                        .contentType("application/json")
                        .content("{\"password\":\"myPassword\"}"))
                .andExpect(status().isNoContent());

        verify(userSecurity).validateUserAccess(7L);
        verify(userService).deleteUser(7L);
    }

    @Test
    void deleteAccountSucceedsWhenSecurityPinMatches() throws Exception {
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(userService.verifySecurityPin(7L, "123456")).thenReturn(true);

        mockMvc.perform(delete("/api/users/7")
                        .contentType("application/json")
                        .content("{\"securityPin\":\"123456\"}"))
                .andExpect(status().isNoContent());

        verify(userSecurity).validateUserAccess(7L);
        verify(userService).deleteUser(7L);
    }

    @Test
    void deleteAccountSucceedsWhenGoogleIdTokenMatchesUserEmail() throws Exception {
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(googleIdTokenVerifier.verify("valid-google-token"))
                .thenReturn(new GoogleIdTokenVerifier.VerifiedIdentity("jane@example.com", "Jane Doe"));

        mockMvc.perform(delete("/api/users/7")
                        .contentType("application/json")
                        .content("{\"googleIdToken\":\"valid-google-token\"}"))
                .andExpect(status().isNoContent());

        verify(userSecurity).validateUserAccess(7L);
        verify(googleIdTokenVerifier).verify("valid-google-token");
        verify(userService).deleteUser(7L);
    }

    @Test
    void deleteAccountFailsWhenPasswordDoesNotMatch() throws Exception {
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrongPassword", "encodedPassword")).thenReturn(false);

        mockMvc.perform(delete("/api/users/7")
                        .contentType("application/json")
                        .content("{\"password\":\"wrongPassword\"}"))
                .andExpect(status().isUnauthorized());

        verify(userSecurity).validateUserAccess(7L);
        verify(userService, never()).deleteUser(anyLong());
    }

    @Test
    void updateCurrencySucceedsForValidIsoCode() throws Exception {
        mockMvc.perform(put("/api/users/7/currency")
                        .contentType("application/json")
                        .content("{\"currency\":\"USD\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currency").value("USD"))
                .andExpect(jsonPath("$.message").value("Currency preference updated successfully"));

        verify(userSecurity).validateUserAccess(7L);
        verify(userService).updateCurrency(7L, "USD");
    }

    @Test
    void updateCurrencyRejectsInvalidIsoCode() throws Exception {
        mockMvc.perform(put("/api/users/7/currency")
                        .contentType("application/json")
                        .content("{\"currency\":\"US\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message")
                        .value("Currency must be a valid 3-letter ISO 4217 code (e.g., USD, EUR, INR)"));

        verify(userSecurity).validateUserAccess(7L);
        verify(userService, never()).updateCurrency(anyLong(), anyString());
    }
}
