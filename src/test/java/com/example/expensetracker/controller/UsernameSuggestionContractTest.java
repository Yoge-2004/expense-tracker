package com.example.expensetracker.controller;

import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.security.GoogleIdTokenVerifier;
import com.example.expensetracker.security.UserSecurity;
import com.example.expensetracker.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Contract tests for the public username-suggestion API.
 *
 * These tests protect the product contract rather than the implementation:
 * the UI presents exactly three suggestions, suggestions must be unique, and
 * merely requesting suggestions must never create a user.
 */
@WebMvcTest(UserController.class)
@AutoConfigureMockMvc(addFilters = false)
class UsernameSuggestionContractTest {

    @Autowired MockMvc mockMvc;

    @MockitoBean UserService userService;
    @MockitoBean UserRepository userRepository;
    @MockitoBean UserSecurity userSecurity;
    @MockitoBean org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
    @MockitoBean GoogleIdTokenVerifier googleIdTokenVerifier;

    @Test
    void returnsExactlyThreeSuggestionsAndNeverCreatesUsers() throws Exception {
        when(userRepository.findByUsernameIgnoreCase(anyString())).thenReturn(Optional.empty());

        String body = mockMvc.perform(get("/api/users/suggest-usernames").param("base", "John Doe"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.suggestions").isArray())
                .andReturn().getResponse().getContentAsString();

        com.fasterxml.jackson.databind.JsonNode suggestions =
                new com.fasterxml.jackson.databind.ObjectMapper().readTree(body).get("suggestions");

        assertEquals(3, suggestions.size(), "Signup contract requires exactly three choices");
        assertEquals(3, java.util.stream.StreamSupport.stream(suggestions.spliterator(), false)
                .map(com.fasterxml.jackson.databind.JsonNode::asText).distinct().count());
        for (com.fasterxml.jackson.databind.JsonNode suggestion : suggestions) {
            assertTrue(suggestion.asText().matches("^[a-zA-Z0-9._]{3,30}$"));
        }
        verify(userRepository, never()).save(any());
    }

    @Test
    void filtersTakenCandidatesBeforeReturningSuggestions() throws Exception {
        when(userRepository.findByUsernameIgnoreCase(anyString())).thenAnswer(invocation -> {
            String candidate = invocation.getArgument(0);
            return candidate.equalsIgnoreCase("iam_john")
                    ? Optional.of(new com.example.expensetracker.model.User())
                    : Optional.empty();
        });

        String body = mockMvc.perform(get("/api/users/suggest-usernames").param("base", "john"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        com.fasterxml.jackson.databind.JsonNode suggestions =
                new com.fasterxml.jackson.databind.ObjectMapper().readTree(body).get("suggestions");
        assertEquals(3, suggestions.size());
        assertFalse(java.util.stream.StreamSupport.stream(suggestions.spliterator(), false)
                .anyMatch(n -> n.asText().equalsIgnoreCase("iam_john")));
    }

    @Test
    void normalizesUnsafeBaseWithoutReturningInvalidHandles() throws Exception {
        String body = mockMvc.perform(get("/api/users/suggest-usernames")
                        .param("base", "  Jöhn Doe !!! "))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        com.fasterxml.jackson.databind.JsonNode suggestions =
                new com.fasterxml.jackson.databind.ObjectMapper().readTree(body).get("suggestions");
        assertEquals(3, suggestions.size());
        for (com.fasterxml.jackson.databind.JsonNode suggestion : suggestions) {
            assertTrue(suggestion.asText().matches("^[a-zA-Z0-9._]{3,30}$"));
        }
    }
}
