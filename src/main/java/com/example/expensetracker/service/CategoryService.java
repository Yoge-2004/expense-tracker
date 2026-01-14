package com.example.expensetracker.service;

import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.User;

import java.util.List;

public interface CategoryService {

    Category createCategory(String name, User user);

    List<Category> getUserCategories(User user);

    List<Category> getGlobalCategories();
}
