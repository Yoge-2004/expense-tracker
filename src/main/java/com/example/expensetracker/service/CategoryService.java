package com.example.expensetracker.service;

import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.User;

import java.util.List;

/**
 * Service interface defining the business operations for managing expense categories.
 *
 * <p>This interface abstracts the category management layer, providing methods for
 * creating user-specific categories and retrieving both user-owned and global categories.
 * The concrete implementation is provided by
 * {@link com.example.expensetracker.service.impl.CategoryServiceImpl}.</p>
 *
 * <p>Category rules enforced at this layer:</p>
 * <ul>
 *   <li>Category names must be unique per user.</li>
 *   <li>A {@code null} user field indicates a global (system-level) category.</li>
 * </ul>
 *
 * @author Yogeshwaran
 * @version 1.0
 * @see com.example.expensetracker.service.impl.CategoryServiceImpl
 */
public interface CategoryService {

    /**
     * Creates a new expense category associated with the specified user.
     *
     * <p>The category name must be unique for the given user. If a category with
     * the same name already exists for that user, an {@link IllegalArgumentException}
     * is thrown to prevent duplicates.</p>
     *
     * @param name the name of the category to create; must not be blank
     * @param user the {@link User} who will own this category; must not be {@code null}
     * @return the persisted {@link Category} entity with a generated ID
     * @throws IllegalArgumentException if a category with the same name already
     *                                  exists for the given user
     */
    Category createCategory(String name, User user);

    /**
     * Retrieves all expense categories owned by the specified user.
     *
     * <p>Returns only the categories created by the given user. Global categories
     * (with a {@code null} user field) are not included. Use
     * {@link #getGlobalCategories()} to retrieve those.</p>
     *
     * @param user the {@link User} whose categories are to be retrieved
     * @return a list of {@link Category} entities belonging to the user;
     *         empty list if the user has created no categories
     */
    List<Category> getUserCategories(User user);

    /**
     * Retrieves all global (system-level) expense categories.
     *
     * <p>Global categories are shared across all users and have no associated owner.
     * They typically represent common expense types such as Food, Transport, or Utilities.</p>
     *
     * @return a list of global {@link Category} entities with no user association;
     *         empty list if none are defined
     */
    List<Category> getGlobalCategories();

    /**
     * Deletes a user-owned category, but only if it is not currently in use.
     *
     * <p>A category is considered "in use" if any expense or recurring
     * expense/subscription (for any user, though in practice only its owner
     * could reference it) points to it. Global (system-seeded) categories can
     * never be deleted through this method.</p>
     *
     * @param categoryId the ID of the category to delete
     * @param user       the user attempting the deletion; must own the category
     * @throws IllegalArgumentException if the category doesn't exist, isn't
     *                                  owned by this user, or is a global category
     * @throws IllegalStateException    if the category is currently referenced
     *                                  by one or more expenses
     */
    void deleteCategory(Long categoryId, User user);
}
