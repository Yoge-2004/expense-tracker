package com.example.expensetracker.config;

import com.example.expensetracker.model.Category;
import com.example.expensetracker.repository.CategoryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Seeds the five system-wide default categories (Food, Transport, Utilities,
 * Entertainment, Health) on startup if they don't already exist, so every
 * new deployment has a baseline category set without manual setup.
 *
 * <p>Global categories are represented as {@link Category} rows with a
 * {@code null} user — this is the same flag {@link
 * com.example.expensetracker.service.impl.CategoryServiceImpl#deleteCategory}
 * checks to refuse deleting them: a global category can never be removed
 * through the user-facing delete endpoint, only these five ever exist as
 * global, and this is where they're created.</p>
 */
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
