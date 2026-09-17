package com.example.expensetracker.config;

import com.example.expensetracker.model.Category;
import com.example.expensetracker.repository.CategoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

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
@Slf4j
@Component
@RequiredArgsConstructor
public class CategoryInitializer {

    private final CategoryRepository categoryRepository;


    @EventListener(ApplicationReadyEvent.class)
    @Order(1)
    @Transactional
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
