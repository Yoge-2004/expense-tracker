package com.example.expensetracker.security;

import io.jsonwebtoken.MalformedJwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;

import java.io.IOException;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class JwtAuthenticationFilterTest {

    @Mock
    private JwtService jwtService;
    @Mock
    private CustomUserDetailsService userDetailsService;
    @Mock
    private FilterChain filterChain;

    private JwtAuthenticationFilter filter;
    private MockHttpServletRequest request;
    private MockHttpServletResponse response;

    @BeforeEach
    void setUp() {
        filter = new JwtAuthenticationFilter(jwtService, userDetailsService);
        request = new MockHttpServletRequest();
        response = new MockHttpServletResponse();
        SecurityContextHolder.clearContext();
        MDC.clear();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        MDC.clear();
    }

    @Test
    @DisplayName("doFilterInternal skips authentication when Authorization header is absent")
    void doFilterInternal_noHeader_skipsAuth() throws ServletException, IOException {
        filter.doFilterInternal(request, response, filterChain);

        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(filterChain).doFilter(request, response);
        verifyNoInteractions(jwtService, userDetailsService);
    }

    @Test
    @DisplayName("doFilterInternal skips authentication when Authorization header lacks Bearer prefix")
    void doFilterInternal_nonBearerHeader_skipsAuth() throws ServletException, IOException {
        request.addHeader("Authorization", "Basic dXNlcjpwYXNz");

        filter.doFilterInternal(request, response, filterChain);

        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(filterChain).doFilter(request, response);
        verifyNoInteractions(jwtService, userDetailsService);
    }

    @Test
    @DisplayName("doFilterInternal gracefully handles MalformedJwtException and continues filter chain unauthenticated")
    void doFilterInternal_malformedJwt_continuesUnauthenticated() throws ServletException, IOException {
        request.addHeader("Authorization", "Bearer invalid-garbage-token");
        when(jwtService.extractUsername("invalid-garbage-token"))
                .thenThrow(new MalformedJwtException("Malformed token"));

        filter.doFilterInternal(request, response, filterChain);

        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(filterChain).doFilter(request, response);
        verifyNoInteractions(userDetailsService);
    }

    @Test
    @DisplayName("doFilterInternal populates SecurityContext and MDC when JWT is valid")
    void doFilterInternal_validToken_authenticatesUser() throws ServletException, IOException {
        String token = "valid-token";
        String email = "john@example.com";
        request.addHeader("Authorization", "Bearer " + token);

        UserDetails userDetails = new User(email, "password", List.of(new SimpleGrantedAuthority("ROLE_USER")));

        when(jwtService.extractUsername(token)).thenReturn(email);
        when(userDetailsService.loadUserByUsername(email)).thenReturn(userDetails);
        when(jwtService.isTokenValid(token, userDetails)).thenReturn(true);

        filter.doFilterInternal(request, response, filterChain);

        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
        assertEquals(email, SecurityContextHolder.getContext().getAuthentication().getName());
        verify(filterChain).doFilter(request, response);
    }

    @Test
    @DisplayName("doFilterInternal leaves SecurityContext empty when isTokenValid returns false")
    void doFilterInternal_invalidToken_doesNotAuthenticate() throws ServletException, IOException {
        String token = "revoked-or-expired-token";
        String email = "john@example.com";
        request.addHeader("Authorization", "Bearer " + token);

        UserDetails userDetails = new User(email, "password", List.of(new SimpleGrantedAuthority("ROLE_USER")));

        when(jwtService.extractUsername(token)).thenReturn(email);
        when(userDetailsService.loadUserByUsername(email)).thenReturn(userDetails);
        when(jwtService.isTokenValid(token, userDetails)).thenReturn(false);

        filter.doFilterInternal(request, response, filterChain);

        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(filterChain).doFilter(request, response);
    }

    @Test
    @DisplayName("doFilterInternal continues unauthenticated when the JWT subject no longer exists")
    void doFilterInternal_deletedUser_continuesUnauthenticated() throws ServletException, IOException {
        String token = "token-for-deleted-user";
        String email = "gone@example.com";
        request.addHeader("Authorization", "Bearer " + token);

        when(jwtService.extractUsername(token)).thenReturn(email);
        when(userDetailsService.loadUserByUsername(email))
                .thenThrow(new org.springframework.security.core.userdetails.UsernameNotFoundException(
                        "User not found with email or username: " + email));

        // Must NOT throw: a deleted account turns into anonymous access (401/403
        // downstream), never a 500 from the filter chain.
        assertDoesNotThrow(() -> filter.doFilterInternal(request, response, filterChain));

        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(filterChain).doFilter(request, response);
    }
}
