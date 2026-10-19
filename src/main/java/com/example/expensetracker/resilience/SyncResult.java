package com.example.expensetracker.resilience;

/**
 * Outcome of merging the changes made in the local fallback database back into the primary database.
 *
 * @param inserted  rows created in the primary database
 * @param updated   existing primary rows overwritten with the fallback version
 * @param deleted   rows removed from the primary database
 * @param skipped   rows that were already present in the primary database (for example a retry)
 * @param conflicts rows the primary database rejected; kept in the fallback {@code fb_conflicts} table
 * @param millis    time the merge took
 */
public record SyncResult(int inserted, int updated, int deleted, int skipped, int conflicts, long millis) {

    public static SyncResult none() {
        return new SyncResult(0, 0, 0, 0, 0, 0);
    }

    /** True when nothing needed to be merged. */
    public boolean isEmpty() {
        return inserted == 0 && updated == 0 && deleted == 0 && skipped == 0 && conflicts == 0;
    }

    public int changed() {
        return inserted + updated + deleted;
    }
}
