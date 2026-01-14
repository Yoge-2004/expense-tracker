package com.example.expensetracker.service.impl;

import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.CategoryRepository;
import com.example.expensetracker.service.CategoryService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class CategoryServiceImpl implements CategoryService {

    private final CategoryRepository categoryRepository;

    public CategoryServiceImpl(CategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
    }

    @Override
    public Category createCategory(String name, User user) {
        if (categoryRepository.existsByNameAndUser(name, user)) {
            throw new IllegalArgumentException("Category already exists for this user");
        }

        Category category = new Category();
        category.setName(name);
        category.setUser(user);

        return categoryRepository.save(category);
    }

    @Override
    public List<Category> getUserCategories(User user) {
        return categoryRepository.findByUser(user);
    }

    @Override
    public List<Category> getGlobalCategories() {
        return categoryRepository.findByUserIsNull();
    }
}
