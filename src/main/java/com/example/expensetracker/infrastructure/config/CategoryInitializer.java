package com.example.expensetracker.infrastructure.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

import com.example.expensetracker.domain.expense.model.Category;
import com.example.expensetracker.domain.expense.repository.CategoryRepository;
import com.example.expensetracker.domain.expense.service.CategoryServiceImpl;



/**
 * Seeds the system-wide default categories (Food, Transport, Utilities,
 * Entertainment, Health, Shopping, Finance, Savings, Loan) on startup if they don't already exist, so every
 * new deployment has a baseline category set without manual setup.
 *
 * <p>Global categories are represented as {@link Category} rows with a
 * {@code null} user — this is the same flag {@link
 * com.example.expensetracker.domain.expense.service.CategoryServiceImpl#deleteCategory}
 * checks to refuse deleting them: a global category can never be removed
 * through the user-facing delete endpoint, only these ever exist as
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
        List<String> defaultCategories = List.of(
                // Baseline categories
                "Food", "Transport", "Utilities", "Entertainment",
                "Health", "Shopping", "Finance", "Savings", "Loan",
                // Canonical ML taxonomy display categories
                "Food & Dining", "Transportation", "Shopping & Retail",
                "Entertainment & Recreation", "Healthcare & Medical",
                "Utilities & Services", "Financial Services", "Income",
                "Government & Legal", "Charity & Donations",
                // Extended financial taxonomy categories
                "Housing", "Groceries", "Education", "Personal Care",
                "Travel", "Insurance", "Investments", "General"
        );
        for (String catName : defaultCategories) {
            try {
                if (categoryRepository.findByUserIsNullAndNameIgnoreCase(catName).isEmpty()) {
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
