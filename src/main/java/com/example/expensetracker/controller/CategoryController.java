package com.example.expensetracker.controller;

import com.example.expensetracker.dto.CategoryDto;
import com.example.expensetracker.dto.CategoryRequest;
import com.example.expensetracker.mapper.CategoryMapper;
import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.User;
import com.example.expensetracker.service.CategoryService;
import com.example.expensetracker.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/categories")
public class CategoryController {

    private final CategoryService categoryService;
    private final UserService userService;

    public CategoryController(CategoryService categoryService,
                              UserService userService) {
        this.categoryService = categoryService;
        this.userService = userService;
    }

    @PostMapping("/user/{userId}")
    public ResponseEntity<CategoryDto> createCategory(
            @PathVariable Long userId,
            @Valid @RequestBody CategoryRequest request) {

        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        Category category = categoryService.createCategory(
                request.getName(),
                user
        );

        return new ResponseEntity<>(
                CategoryMapper.toDto(category),
                HttpStatus.CREATED
        );
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<CategoryDto>> getUserCategories(
            @PathVariable Long userId) {

        User user = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        List<CategoryDto> categories = categoryService
                .getUserCategories(user)
                .stream()
                .map(CategoryMapper::toDto)
                .collect(Collectors.toList());

        return ResponseEntity.ok(categories);
    }

    @GetMapping("/global")
    public ResponseEntity<List<CategoryDto>> getGlobalCategories() {

        List<CategoryDto> categories = categoryService
                .getGlobalCategories()
                .stream()
                .map(CategoryMapper::toDto)
                .collect(Collectors.toList());

        return ResponseEntity.ok(categories);
    }
}
