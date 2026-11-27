package com.example.expensetracker.infrastructure.resilience;

/**
 * Lifecycle callback invoked after a failover database snapshot is restored or verified on startup.
 */
@FunctionalInterface
public interface PostRestoreHook {

    /**
     * Runs post-restore synchronization or verification against the restored database state.
     */
    void onDatabaseRestored();
}
