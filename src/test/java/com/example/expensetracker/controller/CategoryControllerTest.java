package com.example.expensetracker.controller;

import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.User;
import com.example.expensetracker.security.CustomUserDetailsService;
import com.example.expensetracker.security.JwtAuthenticationFilter;
import com.example.expensetracker.security.JwtService;
import com.example.expensetracker.security.UserSecurity;
import com.example.expensetracker.service.CategoryService;
import com.example.expensetracker.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(
        controllers = CategoryController.class,
        excludeFilters = @ComponentScan.Filter(
                type = org.springframework.context.annotation.FilterType.ASSIGNABLE_TYPE,
                classes = JwtAuthenticationFilter.class))
@AutoConfigureMockMvc(addFilters = false)
class CategoryControllerTest {

    @Autowired MockMvc mockMvc;

    @MockitoBean CategoryService categoryService;
    @MockitoBean UserService userService;
    @MockitoBean UserSecurity userSecurity;
    @MockitoBean JwtService jwtService;
    @MockitoBean CustomUserDetailsService customUserDetailsService;

    private User user;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setId(7L);
        user.setName("Jane Doe");
    }

    @Test
    void createCategoryReturnsCreatedDtoAndPassesOwner() throws Exception {
        Category created = category(6L, "Petrol", user);
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(categoryService.createCategory("Petrol", user)).thenReturn(created);

        mockMvc.perform(post("/api/categories/user/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Petrol\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(6))
                .andExpect(jsonPath("$.name").value("Petrol"));

        verify(userSecurity).validateUserAccess(7L);
        verify(categoryService).createCategory("Petrol", user);
    }

    @Test
    void createCategoryRejectsBlankNameBeforeLookup() throws Exception {
        mockMvc.perform(post("/api/categories/user/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"   \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));

        verifyNoInteractions(userSecurity, userService, categoryService);
    }

    @Test
    void createCategoryReturnsBadRequestWhenUserMissing() throws Exception {
        when(userService.findById(7L)).thenReturn(Optional.empty());

        mockMvc.perform(post("/api/categories/user/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Petrol\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("User not found"));

        verify(categoryService, never()).createCategory(any(), any(User.class));
    }

    @Test
    void getUserCategoriesMapsOnlyPersonalCategories() throws Exception {
        Category first = category(6L, "Petrol", user);
        Category second = category(7L, "Gym", user);
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(categoryService.getUserCategories(user)).thenReturn(List.of(first, second));

        mockMvc.perform(get("/api/categories/user/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(6))
                .andExpect(jsonPath("$[0].name").value("Petrol"))
                .andExpect(jsonPath("$[1].name").value("Gym"));

        verify(userSecurity).validateUserAccess(7L);
        verify(categoryService).getUserCategories(user);
    }

    @Test
    void getUserCategoriesReturnsEmptyArrayForNewUser() throws Exception {
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(categoryService.getUserCategories(user)).thenReturn(List.of());

        mockMvc.perform(get("/api/categories/user/7"))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));
    }

    @Test
    void getUserCategoriesReturnsBadRequestForMissingUser() throws Exception {
        when(userService.findById(7L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/categories/user/7"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("User not found"));

        verify(categoryService, never()).getUserCategories(any(User.class));
    }

    @Test
    void getGlobalCategoriesDoesNotRequireUserLookup() throws Exception {
        Category food = category(1L, "Food", null);
        Category transport = category(2L, "Transport", null);
        when(categoryService.getGlobalCategories()).thenReturn(List.of(food, transport));

        mockMvc.perform(get("/api/categories/global"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].name").value("Food"))
                .andExpect(jsonPath("$[1].name").value("Transport"));

        verify(categoryService).getGlobalCategories();
        verifyNoInteractions(userService, userSecurity);
    }

    @Test
    void deleteCategoryValidatesOwnerAndDelegates() throws Exception {
        when(userService.findById(7L)).thenReturn(Optional.of(user));

        mockMvc.perform(delete("/api/categories/6/user/7"))
                .andExpect(status().isNoContent())
                .andExpect(content().string(""));

        verify(userSecurity).validateUserAccess(7L);
        verify(categoryService).deleteCategory(6L, user);
    }

    @Test
    void deleteCategoryReturnsBadRequestWhenUserMissing() throws Exception {
        when(userService.findById(7L)).thenReturn(Optional.empty());

        mockMvc.perform(delete("/api/categories/6/user/7"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("User not found"));

        verify(categoryService, never()).deleteCategory(anyLong(), any(User.class));
    }

    @Test
    void categoryServiceConflictPropagatesAsHttpConflict() throws Exception {
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        doThrow(new IllegalStateException("Category is still in use")).when(categoryService).deleteCategory(6L, user);

        mockMvc.perform(delete("/api/categories/6/user/7"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Category is still in use"));
    }

    private static Category category(Long id, String name, User user) {
        Category category = new Category();
        category.setId(id);
        category.setName(name);
        category.setUser(user);
        return category;
    }
}
