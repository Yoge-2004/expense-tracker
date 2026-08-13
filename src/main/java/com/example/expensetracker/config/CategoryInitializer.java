package com.example.expensetracker.config;

import com.example.expensetracker.model.Category;
import com.example.expensetracker.repository.CategoryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class CategoryInitializer {

    private static final Logger log = LoggerFactory.getLogger(CategoryInitializer.class);
    private final CategoryRepository categoryRepository;

    public CategoryInitializer(CategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void initGlobalCategories() {
        List<String> defaultCategories = List.of("Food", "Transport", "Utilities", "Entertainment", "Health");
        for (String catName : defaultCategories) {
            try {
                if (categoryRepository.findByNameIgnoreCase(catName).isEmpty()) {
                    Category cat = new Category();
                    cat.setName(catName);
                    cat.setUser(null); // Global category
                    categoryRepository.save(cat);
                    log.info("Initialized global category: {}", catName);
                }
            } catch (Exception e) {
                log.warn("Could not initialize default category {}: {}", catName, e.getMessage());
            }
        }
    }
}
