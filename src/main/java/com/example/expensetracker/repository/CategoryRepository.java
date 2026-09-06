package com.example.expensetracker.repository;

import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

/**
 * Spring Data JPA repository for {@link Category} entities.
 *
 * <p>Provides standard CRUD operations via {@link JpaRepository} along with
 * custom query methods for retrieving user-specific and global categories,
 * as well as uniqueness checks used during category creation.</p>
 *
 * <p>Used by {@link com.example.expensetracker.service.impl.CategoryServiceImpl}
 * and {@link com.example.expensetracker.service.impl.UserServiceImpl} (for cascade delete).</p>
 *
 * @author Yogeshwaran
 * @version 1.0
 * @see Category
 */
public interface CategoryRepository extends JpaRepository<Category, Long> {

    /**
     * Retrieves all categories created by a specific user.
     *
     * <p>Returns only user-scoped categories (where {@code user} is non-null).
     * Global categories (where {@code user} is {@code null}) are excluded.</p>
     *
     * @param user the {@link User} whose categories are to be retrieved
     * @return a list of {@link Category} records belonging to the user;
     *         empty list if none exist
     */
    List<Category> findByUser(User user);

    /**
     * Retrieves all global (system-level) categories.
     *
     * <p>Global categories have no associated user ({@code user_id IS NULL})
     * and are available to all users as shared expense classification options.</p>
     *
     * @return a list of {@link Category} records with no associated user;
     *         empty list if none are defined
     */
    List<Category> findByUserIsNull();

    /**
     * Checks whether a category with the given name already exists for the specified user.
     *
     * <p>Used in {@link com.example.expensetracker.service.impl.CategoryServiceImpl#createCategory}
     * to enforce per-user category name uniqueness before persisting a new category.</p>
     *
     * @param name the category name to check
     * @param user the {@link User} for whom the check is scoped
     * @return {@code true} if a category with that name exists for the user;
     *         {@code false} otherwise
     */
    boolean existsByNameAndUser(String name, User user);

    Optional<Category> findByNameIgnoreCase(String name);

    /**
     * Deletes all categories owned by the specified user.
     *
     * @param userId the ID of the owning user
     */
    @Modifying
    @Query("DELETE FROM Category c WHERE c.user.id = :userId")
    void deleteByUserId(@Param("userId") Long userId);
}
