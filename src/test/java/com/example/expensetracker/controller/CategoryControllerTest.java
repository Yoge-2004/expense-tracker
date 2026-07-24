package com.example.expensetracker.controller;

import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.User;
import com.example.expensetracker.security.CustomUserDetailsService;
import com.example.expensetracker.security.JwtService;
import com.example.expensetracker.service.CategoryService;
import com.example.expensetracker.service.UserService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Unit tests for {@link CategoryController}.
 *
 * <p>Endpoints covered:</p>
 * <ul>
 *   <li>POST  /api/categories/user/{userId}</li>
 *   <li>GET   /api/categories/user/{userId}</li>
 *   <li>GET   /api/categories/global</li>
 * </ul>
 *
 * @author Yogeshwaran
 */
@WebMvcTest(CategoryController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("CategoryController Tests")
class CategoryControllerTest {

    @Autowired MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());

    @MockitoBean CategoryService categoryService;
    @MockitoBean UserService userService;
    @MockitoBean JwtService jwtService;
    @MockitoBean CustomUserDetailsService customUserDetailsService;

    private User sampleUser;
    private Category foodCategory;
    private Category transportCategory;

    @BeforeEach
    void setUp() {
        sampleUser = new User();
        sampleUser.setId(1L);
        sampleUser.setName("Yogeshwaran");
        sampleUser.setEmail("yoge@example.com");
        sampleUser.setEnabled(true);

        when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));

        foodCategory = new Category();
        foodCategory.setId(1L);
        foodCategory.setName("Food");

        transportCategory = new Category();
        transportCategory.setId(2L);
        transportCategory.setName("Transport");
    }

    // ─────────────── POST /api/categories/user/{userId} ───────────────

    @Test
    @WithMockUser
    @DisplayName("POST /api/categories/user/{userId} → 201 Created on valid request")
    void createCategory_validRequest_returns201() throws Exception {
        when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
        when(categoryService.createCategory("Food", sampleUser)).thenReturn(foodCategory);

        mockMvc.perform(post("/api/categories/user/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "Food"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.name").value("Food"));
    }

    @Test
    @WithMockUser
    @DisplayName("POST /api/categories/user/{userId} → 400 Bad Request on duplicate name")
    void createCategory_duplicateName_returns400() throws Exception {
        when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
        when(categoryService.createCategory(eq("Food"), any(User.class)))
                .thenThrow(new IllegalArgumentException("Category 'Food' already exists for this user"));

        mockMvc.perform(post("/api/categories/user/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "Food"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Category 'Food' already exists for this user"));
    }

    @Test
    @WithMockUser
    @DisplayName("POST /api/categories/user/{userId} → 400 Bad Request when name is blank")
    void createCategory_blankName_returns400() throws Exception {
        mockMvc.perform(post("/api/categories/user/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", ""))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser
    @DisplayName("POST /api/categories/user/{userId} → 400 Bad Request when user not found")
    void createCategory_userNotFound_returns400() throws Exception {
        when(userService.findById(99L)).thenReturn(Optional.empty());

        mockMvc.perform(post("/api/categories/user/99")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "Food"))))
                .andExpect(status().isBadRequest());
    }

    // ─────────────── GET /api/categories/user/{userId} ───────────────

    @Test
    @WithMockUser
    @DisplayName("GET /api/categories/user/{userId} → 200 OK with list of user categories")
    void getUserCategories_returns200WithList() throws Exception {
        when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
        when(categoryService.getUserCategories(sampleUser))
                .thenReturn(List.of(foodCategory, transportCategory));

        mockMvc.perform(get("/api/categories/user/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].name").value("Food"))
                .andExpect(jsonPath("$[1].name").value("Transport"));
    }

    @Test
    @WithMockUser
    @DisplayName("GET /api/categories/user/{userId} → 200 OK with empty list when no categories")
    void getUserCategories_noCategories_returnsEmptyList() throws Exception {
        when(userService.findById(1L)).thenReturn(Optional.of(sampleUser));
        when(categoryService.getUserCategories(sampleUser)).thenReturn(List.of());

        mockMvc.perform(get("/api/categories/user/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    @WithMockUser
    @DisplayName("GET /api/categories/user/{userId} → 400 Bad Request when user not found")
    void getUserCategories_userNotFound_returns400() throws Exception {
        when(userService.findById(99L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/categories/user/99"))
                .andExpect(status().isBadRequest());
    }

    // ─────────────── GET /api/categories/global ───────────────

    @Test
    @WithMockUser
    @DisplayName("GET /api/categories/global → 200 OK with global categories")
    void getGlobalCategories_returns200WithList() throws Exception {
        Category utilitiesCategory = new Category();
        utilitiesCategory.setId(3L);
        utilitiesCategory.setName("Utilities");

        when(categoryService.getGlobalCategories())
                .thenReturn(List.of(foodCategory, transportCategory, utilitiesCategory));

        mockMvc.perform(get("/api/categories/global"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].name").value("Food"))
                .andExpect(jsonPath("$[1].name").value("Transport"))
                .andExpect(jsonPath("$[2].name").value("Utilities"));
    }

    @Test
    @WithMockUser
    @DisplayName("GET /api/categories/global → 200 OK with empty list when none defined")
    void getGlobalCategories_empty_returnsEmptyList() throws Exception {
        when(categoryService.getGlobalCategories()).thenReturn(List.of());

        mockMvc.perform(get("/api/categories/global"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }
}
