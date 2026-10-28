package com.example.expensetracker.service.impl;

/**
 * Decides whether replacing the stored database snapshot with a fresh export would throw data away.
 *
 * <p>The backup job overwrites the single snapshot in the Hugging Face Space. If the live database
 * is older or emptier than the snapshot (a restart that comes up on a stale primary, a failed
 * restore), an unconditional overwrite replaces good data with less data, and history compaction
 * can erase the earlier copy. A large drop in row count is treated as that situation and the
 * overwrite is refused until someone forces it.
 */
final class SnapshotShrinkGuard {

    /** Below this many rows a few deletions are a big percentage; the guard stays out of the way. */
    static final int MIN_ROWS_FOR_GUARD = 50;

    private SnapshotShrinkGuard() {
    }

    /**
     * @param knownRows        rows in the snapshot that is currently stored (0 when unknown)
     * @param newRows          rows in the export that would replace it
     * @param maxShrinkPercent largest allowed drop in percent; a negative value or 100+ disables the check
     * @return true when the export is so much smaller that replacing the snapshot looks like data loss
     */
    static boolean isSuspiciousShrink(int knownRows, int newRows, int maxShrinkPercent) {
        if (knownRows < MIN_ROWS_FOR_GUARD || maxShrinkPercent < 0 || maxShrinkPercent >= 100) {
            return false;
        }
        long smallestAllowed = Math.round(knownRows * (100 - maxShrinkPercent) / 100.0);
        return newRows < smallestAllowed;
    }
}
