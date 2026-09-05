package com.example.expensetracker.service;

import com.example.expensetracker.model.PasswordResetOtp;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.PasswordResetOtpRepository;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.service.impl.PasswordResetServiceImpl;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PasswordResetServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private PasswordResetOtpRepository otpRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private ObjectProvider<JavaMailSender> mailSenderProvider;
    @Mock private ObjectProvider<OtpDeliveryListener> otpDeliveryListenerProvider;
    @Mock private JavaMailSender mailSender;
    @Mock private MimeMessage mimeMessage;

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

        lenient().when(passwordEncoder.encode(anyString()))
                .thenAnswer(invocation -> "hashed:" + invocation.getArgument(0));
    }

    @Test
    void sendSignupOtp_usesCaseInsensitiveEmailUniqueness() {
        when(userRepository.existsByEmailIgnoreCase("new@example.com")).thenReturn(false);

        assertThat(service.sendSignupOtp("  new@example.com  ", " New User ")).isTrue();

        ArgumentCaptor<PasswordResetOtp> captor = ArgumentCaptor.forClass(PasswordResetOtp.class);
        verify(otpRepository).save(captor.capture());
        assertThat(captor.getValue().getEmail()).isEqualTo("new@example.com");
        assertThat(captor.getValue().getPurpose()).isEqualTo("SIGNUP");
        assertThat(captor.getValue().isUsed()).isFalse();
    }

    @Test
    void sendSignupOtp_rejectsEmailAlreadyRegisteredRegardlessOfCase() {
        when(userRepository.existsByEmailIgnoreCase("yoge@example.com")).thenReturn(true);

        assertThat(service.sendSignupOtp("YOGE@EXAMPLE.COM", "Yogeshwaran")).isFalse();
        verify(otpRepository, never()).save(any());
    }

    @Test
    void verifySignupOtp_validOtp_marksItUsed() {
        PasswordResetOtp otpRecord = otp("SIGNUP", "hashed:123456", LocalDateTime.now().plusMinutes(10));
        when(otpRepository.findFirstByEmailAndPurposeAndUsedFalseOrderByCreatedAtDesc("yoge@example.com", "SIGNUP"))
                .thenReturn(Optional.of(otpRecord));
        when(passwordEncoder.matches("123456", "hashed:123456")).thenReturn(true);

        service.verifySignupOtp("yoge@example.com", "123456");

        assertThat(otpRecord.isUsed()).isTrue();
        verify(otpRepository).save(otpRecord);
    }

    @Test
    void verifySignupOtp_wrongCode_incrementsAndConsumesOnFifthAttempt() {
        PasswordResetOtp otpRecord = otp("SIGNUP", "hashed:123456", LocalDateTime.now().plusMinutes(10));
        otpRecord.setAttempts(4);
        when(otpRepository.findFirstByEmailAndPurposeAndUsedFalseOrderByCreatedAtDesc("yoge@example.com", "SIGNUP"))
                .thenReturn(Optional.of(otpRecord));
        when(passwordEncoder.matches("000000", "hashed:123456")).thenReturn(false);

        assertThrows(BadCredentialsException.class,
                () -> service.verifySignupOtp("yoge@example.com", "000000"));

        assertThat(otpRecord.getAttempts()).isEqualTo(5);
        assertThat(otpRecord.isUsed()).isTrue();
        verify(otpRepository).save(otpRecord);
    }

    @Test
    void requestReset_withMailConfigured_sendsHtmlEmailAndPersistsHashedOtp() {
        ReflectionTestUtils.setField(service, "configuredMailHost", "smtp.example.com");
        ReflectionTestUtils.setField(service, "mailEnabled", true);
        when(userRepository.findByEmailIgnoreCase("yoge@example.com")).thenReturn(Optional.of(testUser));
        when(mailSenderProvider.getIfAvailable()).thenReturn(mailSender);
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        service.requestReset("YOGE@EXAMPLE.COM");

        verify(mailSender).createMimeMessage();
        verify(mailSender).send(mimeMessage);
        verify(otpRepository).save(any(PasswordResetOtp.class));

        ArgumentCaptor<PasswordResetOtp> captor = ArgumentCaptor.forClass(PasswordResetOtp.class);
        verify(otpRepository, atLeastOnce()).save(captor.capture());
        PasswordResetOtp created = captor.getAllValues().stream()
                .filter(record -> "PASSWORD_RESET".equals(record.getPurpose()) && !record.isUsed())
                .findFirst()
                .orElseThrow();
        assertThat(created.getEmail()).isEqualTo("yoge@example.com");
        assertThat(created.getOtpHash()).startsWith("hashed:");
    }

    @Test
    void resetPassword_rejectsDeprecatedBypassToken() {
        assertThrows(BadCredentialsException.class,
                () -> service.resetPassword("yoge@example.com", "BYPASS", "newPassword123"));
        verify(userRepository, never()).save(any());
    }

    @Test
    void resetPassword_validSecurityPin_consumesOutstandingEmailOtp() {
        testUser.setSecurityPinHash("hashed:654321");
        PasswordResetOtp outstandingOtp = otp("PASSWORD_RESET", "hashed:111111", LocalDateTime.now().plusMinutes(9));

        when(userRepository.findByEmailIgnoreCase("yoge@example.com")).thenReturn(Optional.of(testUser));
        when(passwordEncoder.matches("654321", "hashed:654321")).thenReturn(true);
        when(otpRepository.findFirstByEmailAndPurposeAndUsedFalseOrderByCreatedAtDesc("yoge@example.com", "PASSWORD_RESET"))
                .thenReturn(Optional.of(outstandingOtp));

        service.resetPassword("yoge@example.com", "654321", "newSecret999");

        assertThat(testUser.getPassword()).isEqualTo("hashed:newSecret999");
        assertThat(outstandingOtp.isUsed()).isTrue();
        assertThat(testUser.getFailedPinAttempts()).isZero();
        assertThat(testUser.getPinLockedUntil()).isNull();
        verify(otpRepository).save(outstandingOtp);
        verify(userRepository).save(testUser);
    }

    @Test
    void resetPassword_validEmailOtp_consumesExactOtp() {
        PasswordResetOtp otpRecord = otp("PASSWORD_RESET", "hashed:654321", LocalDateTime.now().plusMinutes(10));
        when(userRepository.findByEmailIgnoreCase("yoge@example.com")).thenReturn(Optional.of(testUser));
        when(otpRepository.findFirstByEmailAndPurposeAndUsedFalseOrderByCreatedAtDesc("yoge@example.com", "PASSWORD_RESET"))
                .thenReturn(Optional.of(otpRecord));
        when(passwordEncoder.matches("654321", "hashed:654321")).thenReturn(false);
        when(passwordEncoder.matches("654321", "hashed:654321")).thenReturn(true);

        service.resetPassword("yoge@example.com", "654321", "newSecret999");

        assertThat(otpRecord.isUsed()).isTrue();
        assertThat(testUser.getPassword()).isEqualTo("hashed:newSecret999");
        verify(otpRepository).save(otpRecord);
        verify(userRepository).save(testUser);
    }

    @Test
    void resetPassword_doesNotAcceptExpiredEmailOtp() {
        PasswordResetOtp expired = otp("PASSWORD_RESET", "hashed:654321", LocalDateTime.now().minusSeconds(1));
        when(userRepository.findByEmailIgnoreCase("yoge@example.com")).thenReturn(Optional.of(testUser));
        when(otpRepository.findFirstByEmailAndPurposeAndUsedFalseOrderByCreatedAtDesc("yoge@example.com", "PASSWORD_RESET"))
                .thenReturn(Optional.of(expired));
        when(passwordEncoder.matches("654321", "hashed:654321")).thenReturn(false);

        assertThrows(BadCredentialsException.class,
                () -> service.resetPassword("yoge@example.com", "654321", "newSecret999"));

        assertThat(expired.isUsed()).isTrue();
        verify(otpRepository).save(expired);
        verify(userRepository).save(testUser);
    }

    @Test
    void resetPassword_blocksRecoveryWhileLocked() {
        testUser.setPinLockedUntil(LocalDateTime.now().plusMinutes(10));
        when(userRepository.findByEmailIgnoreCase("yoge@example.com")).thenReturn(Optional.of(testUser));

        assertThrows(BadCredentialsException.class,
                () -> service.resetPassword("yoge@example.com", "654321", "newSecret999"));
        verify(userRepository, never()).save(any());
    }

    @Test
    void resetPassword_locksAfterFiveFailedRecoveryAttempts() {
        testUser.setSecurityPinHash("hashed:654321");
        testUser.setFailedPinAttempts(4);
        when(userRepository.findByEmailIgnoreCase("yoge@example.com")).thenReturn(Optional.of(testUser));
        when(passwordEncoder.matches("000000", "hashed:654321")).thenReturn(false);
        when(otpRepository.findFirstByEmailAndPurposeAndUsedFalseOrderByCreatedAtDesc("yoge@example.com", "PASSWORD_RESET"))
                .thenReturn(Optional.empty());

        assertThrows(BadCredentialsException.class,
                () -> service.resetPassword("yoge@example.com", "000000", "newSecret999"));

        assertThat(testUser.getFailedPinAttempts()).isEqualTo(5);
        assertThat(testUser.getPinLockedUntil()).isNotNull();
        verify(userRepository).save(testUser);
    }

    private PasswordResetOtp otp(String purpose, String hash, LocalDateTime expiresAt) {
        PasswordResetOtp record = new PasswordResetOtp();
        record.setEmail("yoge@example.com");
        record.setPurpose(purpose);
        record.setOtpHash(hash);
        record.setExpiresAt(expiresAt);
        record.setAttempts(0);
        record.setUsed(false);
        return record;
    }
}
