package com.example.expensetracker.service.impl;

import com.example.expensetracker.model.User;
import com.example.expensetracker.service.PasswordResetService;
import com.example.expensetracker.service.WebAuthnService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("PasskeyRecoveryServiceImpl")
class PasskeyRecoveryServiceImplTest {

    @Mock private WebAuthnService webAuthnService;
    @Mock private PasswordResetService passwordResetService;
    @InjectMocks private PasskeyRecoveryServiceImpl service;

    @Test
    @DisplayName("startRecovery hands out the same assertion challenge as sign-in")
    void startRecovery_returnsChallenge() {
        Map<String, String> challenge = Map.of("transactionId", "tx-1", "publicKey", "{}");
        when(webAuthnService.startAuthentication()).thenReturn(challenge);

        assertEquals(challenge, service.startRecovery());
    }

    @Test
    @DisplayName("a verified assertion sets the new password for exactly the account it proves")
    void resetPassword_verifiedAssertion_setsPassword() {
        User user = new User();
        user.setId(7L);
        when(webAuthnService.verifyAssertionForRecovery("tx-1", "{assertion}")).thenReturn(user);

        service.resetPassword("tx-1", "{assertion}", "newSecret456");

        verify(passwordResetService).resetPasswordForVerifiedUser(user, "newSecret456");
    }

    @Test
    @DisplayName("an invalid assertion never reaches the password change")
    void resetPassword_invalidAssertion_changesNothing() {
        when(webAuthnService.verifyAssertionForRecovery("tx-1", "{bad}"))
                .thenThrow(new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Biometric verification failed."));

        assertThrows(ResponseStatusException.class, () -> service.resetPassword("tx-1", "{bad}", "newSecret456"));

        verifyNoInteractions(passwordResetService);
    }

    @Test
    @DisplayName("a missing or short password is rejected before the single-use challenge is consumed")
    void resetPassword_weakPassword_doesNotTouchTheChallenge() {
        assertThrows(IllegalArgumentException.class, () -> service.resetPassword("tx-1", "{a}", null));
        assertThrows(IllegalArgumentException.class, () -> service.resetPassword("tx-1", "{a}", "  "));
        assertThrows(IllegalArgumentException.class, () -> service.resetPassword("tx-1", "{a}", "12345"));

        verifyNoInteractions(webAuthnService);
        verifyNoInteractions(passwordResetService);
    }
}
