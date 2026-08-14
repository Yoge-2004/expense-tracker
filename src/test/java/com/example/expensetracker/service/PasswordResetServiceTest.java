package com.example.expensetracker.service;

import com.example.expensetracker.model.PasswordResetOtp;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.PasswordResetOtpRepository;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.service.impl.PasswordResetServiceImpl;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PasswordResetServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordResetOtpRepository otpRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private ObjectProvider<JavaMailSender> mailSenderProvider;

    @Mock
    private ObjectProvider<OtpDeliveryListener> otpDeliveryListenerProvider;

    @Mock
    private JavaMailSender mailSender;

    @Mock
    private OtpDeliveryListener otpDeliveryListener;

    @Mock
    private MimeMessage mimeMessage;

    private PasswordResetServiceImpl service;
    private User testUser;

    @BeforeEach
    void setUp() {
        service = new PasswordResetServiceImpl(
                userRepository,
                otpRepository,
                passwordEncoder,
                mailSenderProvider,
                otpDeliveryListenerProvider
        );

        testUser = new User();
        testUser.setId(1L);
        testUser.setName("Yogeshwaran");
        testUser.setEmail("yoge@example.com");
        testUser.setPassword("encodedOldPassword");
        testUser.setCurrency("INR");

        lenient().when(passwordEncoder.encode(anyString())).thenAnswer(inv -> "hashed:" + inv.getArgument(0));
    }

    @Test
    @DisplayName("sendSignupOtp → Returns true for new email and issues SIGNUP OTP")
    void sendSignupOtp_newEmail_returnsTrueAndSavesOtp() {
        when(userRepository.existsByEmail("new@example.com")).thenReturn(false);

        boolean result = service.sendSignupOtp("new@example.com", "New User");

        assertTrue(result);
        ArgumentCaptor<PasswordResetOtp> captor = ArgumentCaptor.forClass(PasswordResetOtp.class);
        verify(otpRepository).save(captor.capture());

        PasswordResetOtp saved = captor.getValue();
        assertEquals("new@example.com", saved.getEmail());
        assertEquals("SIGNUP", saved.getPurpose());
        assertFalse(saved.isUsed());
        assertNotNull(saved.getExpiresAt());
    }

    @Test
    @DisplayName("sendSignupOtp → Returns false for existing email")
    void sendSignupOtp_existingEmail_returnsFalse() {
        when(userRepository.existsByEmail("yoge@example.com")).thenReturn(true);

        boolean result = service.sendSignupOtp("yoge@example.com", "Yogeshwaran");

        assertFalse(result);
        verify(otpRepository, never()).save(any());
    }

    @Test
    @DisplayName("verifySignupOtp → Succeeds with matching OTP")
    void verifySignupOtp_validOtp_marksUsed() {
        PasswordResetOtp otpRecord = new PasswordResetOtp();
        otpRecord.setEmail("yoge@example.com");
        otpRecord.setPurpose("SIGNUP");
        otpRecord.setOtpHash("hashed:123456");
        otpRecord.setExpiresAt(LocalDateTime.now().plusMinutes(10));
        otpRecord.setAttempts(0);
        otpRecord.setUsed(false);

        when(otpRepository.findFirstByEmailAndPurposeAndUsedFalseOrderByCreatedAtDesc("yoge@example.com", "SIGNUP"))
                .thenReturn(Optional.of(otpRecord));
        when(passwordEncoder.matches("123456", "hashed:123456")).thenReturn(true);

        assertDoesNotThrow(() -> service.verifySignupOtp("yoge@example.com", "123456"));
        assertTrue(otpRecord.isUsed());
        verify(otpRepository).save(otpRecord);
    }

    @Test
    @DisplayName("verifySignupOtp → Throws BadCredentialsException on wrong code and increments attempt counter")
    void verifySignupOtp_wrongCode_incrementsAttempts() {
        PasswordResetOtp otpRecord = new PasswordResetOtp();
        otpRecord.setEmail("yoge@example.com");
        otpRecord.setPurpose("SIGNUP");
        otpRecord.setOtpHash("hashed:123456");
        otpRecord.setExpiresAt(LocalDateTime.now().plusMinutes(10));
        otpRecord.setAttempts(0);
        otpRecord.setUsed(false);

        when(otpRepository.findFirstByEmailAndPurposeAndUsedFalseOrderByCreatedAtDesc("yoge@example.com", "SIGNUP"))
                .thenReturn(Optional.of(otpRecord));
        when(passwordEncoder.matches("000000", "hashed:123456")).thenReturn(false);

        assertThrows(BadCredentialsException.class, () -> service.verifySignupOtp("yoge@example.com", "000000"));
        assertEquals(1, otpRecord.getAttempts());
        verify(otpRepository).save(otpRecord);
    }

    @Test
    @DisplayName("requestReset & sendOtpEmail → Triggers HTML email delivery when mail host configured")
    void requestReset_withMailConfigured_sendsHtmlMimeMessage() {
        ReflectionTestUtils.setField(service, "configuredMailHost", "smtp.example.com");
        ReflectionTestUtils.setField(service, "mailEnabled", true);
        when(userRepository.findByEmail("yoge@example.com")).thenReturn(Optional.of(testUser));
        when(mailSenderProvider.getIfAvailable()).thenReturn(mailSender);
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        service.requestReset("yoge@example.com");

        verify(mailSender).createMimeMessage();
        verify(mailSender).send(mimeMessage);
        verify(otpRepository).save(any(PasswordResetOtp.class));
    }
}
