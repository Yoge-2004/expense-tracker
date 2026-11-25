package com.example.expensetracker.infrastructure.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.expensetracker.domain.user.model.Role;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.domain.user.repository.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;

@DisplayName("AdminBootstrapRunner")
class AdminBootstrapRunnerTest {

    private UserRepository userRepository;
    private PasswordEncoder passwordEncoder;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        passwordEncoder = mock(PasswordEncoder.class);
        when(passwordEncoder.encode(any())).thenAnswer(inv -> "enc:" + inv.getArgument(0));
        when(userRepository.findByEmailIgnoreCase(any())).thenReturn(Optional.empty());
    }

    private AdminBootstrapRunner runnerWith(String password) {
        return new AdminBootstrapRunner(userRepository, passwordEncoder,
                new AdminBootstrapProperties(true, "owner@example.com", "owner", password, ""));
    }

    @Test
    @DisplayName("never creates a Super Admin with a built-in default password")
    void blankPasswordCreatesNoAccount() {
        runnerWith("").run();
        runnerWith(null).run();
        runnerWith("   ").run();

        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("creates the Super Admin with exactly the configured password")
    void configuredPasswordIsUsed() {
        runnerWith("S3cure-Passw0rd!").run();

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(saved.capture());
        assertEquals(Role.ROLE_SUPER_ADMIN, saved.getValue().getRole());
        assertEquals("enc:S3cure-Passw0rd!", saved.getValue().getPassword());
        assertEquals("owner@example.com", saved.getValue().getEmail());
    }
}
