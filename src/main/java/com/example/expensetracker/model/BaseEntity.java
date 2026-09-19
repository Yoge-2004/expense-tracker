package com.example.expensetracker.model;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Abstract base entity that provides automatic audit timestamp fields
 * for all JPA entities in the Expense Tracker application.
 *
 * <p>All persistent entities that extend this class automatically receive
 * {@code createdAt} and {@code updatedAt} timestamp fields managed by JPA
 * lifecycle callbacks. This eliminates the need to manually set these fields
 * in each entity class.</p>
 *
 * <p>This class is annotated with {@code @MappedSuperclass}, meaning it is
 * not mapped to its own database table. Instead, its fields are included
 * in the table of each concrete subclass (e.g., {@link Expense}, {@link Category}).</p>
 *
 * @author Yogeshwaran
 * @version 1.0
 */
@Getter
@Setter
@MappedSuperclass
public abstract class BaseEntity {

    /**
     * The timestamp at which this entity was first persisted to the database.
     * Set automatically by {@link #onCreate()}. Non-nullable and non-updatable.
     */
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    /**
     * The timestamp at which this entity was most recently updated.
     * Set on first persist by {@link #onCreate()} and refreshed on every
     * subsequent save by {@link #onUpdate()}.
     */
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    /**
     * JPA lifecycle callback invoked automatically before the entity is first persisted.
     */
    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * JPA lifecycle callback invoked automatically before an existing entity is updated.
     */
    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
