package com.example.expensetracker.domain.user.api;

import com.example.expensetracker.infrastructure.security.BrowserSessionCookieService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import java.util.Optional;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.domain.user.repository.UserRepository;
import com.example.expensetracker.domain.user.service.UserAppearanceService;
import com.example.expensetracker.domain.user.service.UserAvatarService;
import com.example.expensetracker.domain.user.service.UserService;
import com.example.expensetracker.domain.user.security.CustomUserDetailsService;
import com.example.expensetracker.infrastructure.security.GoogleIdTokenVerifier;
import com.example.expensetracker.infrastructure.security.JwtService;
import com.example.expensetracker.domain.user.security.UserSecurity;




@WebMvcTest(UserController.class)
@AutoConfigureMockMvc(addFilters = false)
class UserControllerTest {
    @MockitoBean BrowserSessionCookieService browserSessionCookieService;

    @Autowired MockMvc mockMvc;

    @MockitoBean UserService userService;
    @MockitoBean UserAppearanceService userAppearanceService;
    @MockitoBean UserAvatarService userAvatarService;
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
        when(userService.userExistsByUsername("john.doe")).thenReturn(false);

        mockMvc.perform(get("/api/users/check-username").queryParam("username", "john.doe"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("john.doe"))
                .andExpect(jsonPath("$.available").value(true))
                .andExpect(jsonPath("$.message").value("Username is available!"));

        verify(userService).userExistsByUsername("john.doe");
    }

    @Test
    void checkUsernameTrimsValidInputAndDelegatesToUserService() throws Exception {
        when(userService.userExistsByUsername("Alice_01")).thenReturn(true);

        mockMvc.perform(get("/api/users/check-username").queryParam("username", "  Alice_01  "))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("Alice_01"))
                .andExpect(jsonPath("$.available").value(false))
                .andExpect(jsonPath("$.message").value("Username is already taken"));

        verify(userService).userExistsByUsername("Alice_01");
    }

    @Test
    void checkUsernameReportsAvailableWhenNoCaseInsensitiveMatchExists() throws Exception {
        when(userService.userExistsByUsername("alice_01")).thenReturn(false);

        mockMvc.perform(get("/api/users/check-username").queryParam("username", "alice_01"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("alice_01"))
                .andExpect(jsonPath("$.available").value(true))
                .andExpect(jsonPath("$.message").value("Username is available!"));
    }

    @Test
    void suggestUsernamesDelegatesToUserService() throws Exception {
        when(userService.suggestUsernames("Jane Doe"))
                .thenReturn(java.util.List.of("iam_janedoe", "the_janedoe", "real_janedoe"));

        mockMvc.perform(get("/api/users/suggest-usernames").queryParam("base", "Jane Doe"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.suggestions").isArray())
                .andExpect(jsonPath("$.suggestions.length()").value(3))
                .andExpect(jsonPath("$.suggestions[0]").value("iam_janedoe"))
                .andExpect(jsonPath("$.suggestions[1]").value("the_janedoe"))
                .andExpect(jsonPath("$.suggestions[2]").value("real_janedoe"));

        verify(userService).suggestUsernames("Jane Doe");
    }

    @Test
    void suggestUsernamesUsesDefaultBaseWhenOmitted() throws Exception {
        when(userService.suggestUsernames("user"))
                .thenReturn(java.util.List.of("iam_user", "the_user", "real_user"));

        mockMvc.perform(get("/api/users/suggest-usernames"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.suggestions.length()").value(3))
                .andExpect(jsonPath("$.suggestions[0]").value("iam_user"));

        verify(userService).suggestUsernames("user");
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

    @Test
    void uploadAvatarDelegatesToAvatarService() throws Exception {
        org.springframework.mock.web.MockMultipartFile mockFile =
                new org.springframework.mock.web.MockMultipartFile(
                        "file",
                        "avatar.png",
                        "image/png",
                        new byte[]{1, 2, 3}
                );

        when(userAvatarService.storeAvatar(eq(7L), any())).thenReturn("/api/users/7/avatar?v=12345");

        mockMvc.perform(multipart("/api/users/7/avatar").file(mockFile))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profilePictureUrl").value("/api/users/7/avatar?v=12345"))
                .andExpect(jsonPath("$.message").value("Profile picture updated successfully"));

        verify(userSecurity).validateUserAccess(7L);
        verify(userAvatarService).storeAvatar(eq(7L), any());
    }

    @Test
    void getAvatarReturnsBinaryWhenPresent() throws Exception {
        when(userAvatarService.getAvatar(7L))
                .thenReturn(Optional.of(new UserAvatarService.AvatarContent(new byte[]{1, 2, 3}, "image/png", null)));

        mockMvc.perform(get("/api/users/7/avatar"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, MediaType.IMAGE_PNG_VALUE))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "public, max-age=3600"))
                .andExpect(content().bytes(new byte[]{1, 2, 3}));

        verify(userAvatarService).getAvatar(7L);
    }

    @Test
    void getAvatarRedirectsWhenExternalUrlPresent() throws Exception {
        when(userAvatarService.getAvatar(7L))
                .thenReturn(Optional.of(new UserAvatarService.AvatarContent(null, null, "https://lh3.googleusercontent.com/avatar.jpg")));

        mockMvc.perform(get("/api/users/7/avatar"))
                .andExpect(status().isFound())
                .andExpect(header().string(HttpHeaders.LOCATION, "https://lh3.googleusercontent.com/avatar.jpg"));

        verify(userAvatarService).getAvatar(7L);
    }

    @Test
    void getAvatarReturnsNotFoundWhenAbsent() throws Exception {
        when(userAvatarService.getAvatar(7L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/users/7/avatar"))
                .andExpect(status().isNotFound());

        verify(userAvatarService).getAvatar(7L);
    }

    @Test
    void deleteAvatarDelegatesToAvatarService() throws Exception {
        mockMvc.perform(delete("/api/users/7/avatar"))
                .andExpect(status().isNoContent());

        verify(userSecurity).validateUserAccess(7L);
        verify(userAvatarService).deleteAvatar(7L);
    }

    @Test
    void updateProfileUpdatesDisplayNameAndAvatarUrl() throws Exception {
        User updatedUser = new User();
        updatedUser.setId(7L);
        updatedUser.setName("Jane Updated");
        updatedUser.setUsername("jane_doe");
        updatedUser.setEmail("jane@example.com");
        updatedUser.setCurrency("INR");
        updatedUser.setProfilePictureUrl("https://example.com/avatar.png");

        when(userService.updateProfile(7L, "Jane Updated", "https://example.com/avatar.png"))
                .thenReturn(updatedUser);

        mockMvc.perform(put("/api/users/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Jane Updated\",\"profilePictureUrl\":\"https://example.com/avatar.png\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(7))
                .andExpect(jsonPath("$.name").value("Jane Updated"))
                .andExpect(jsonPath("$.profilePictureUrl").value("https://example.com/avatar.png"));

        verify(userSecurity).validateUserAccess(7L);
        verify(userService).updateProfile(7L, "Jane Updated", "https://example.com/avatar.png");
    }

    @Test
    void updateProfileRejectsBlankName() throws Exception {
        mockMvc.perform(put("/api/users/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"   \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("name: Name cannot be blank"));

        verify(userService, never()).updateProfile(anyLong(), any(), any());
    }
}
