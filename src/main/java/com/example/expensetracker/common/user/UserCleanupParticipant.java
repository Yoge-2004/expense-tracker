package com.example.expensetracker.common.user;

/**
 * Participant in ordered cascading user deletion across domain modules.
 *
 * <p>Decouples {@code domain.user} from every other domain module (Dependency Inversion
 * and Open/Closed Principles): each module owns cleanup of its own tables in a
 * Spring-discovered bean sorted by {@link #order()}.</p>
 */
@FunctionalInterface
public interface UserCleanupParticipant {

    /**
     * Execution priority (ascending). Modules with foreign keys pointing to other
     * domain tables (for example loans -> expenses, or expenses/budgets -> categories)
     * must return a smaller value than the referenced owner's cleanup participant.
     *
     * @return relative execution order
     */
    default int order() {
        return 0;
    }

    /**
     * Deletes all records belonging to the user inside the caller's active transaction.
     *
     * @param userId primary key of the user being deleted
     * @param email  user's normalized email (may be {@code null})
     */
    void cleanupForUser(Long userId, String email);
}
