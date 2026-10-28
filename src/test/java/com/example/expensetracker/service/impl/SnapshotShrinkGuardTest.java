package com.example.expensetracker.service.impl;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SnapshotShrinkGuardTest {

    @Test
    void aSnapshotHalfTheSizeIsRefused() {
        assertTrue(SnapshotShrinkGuard.isSuspiciousShrink(2_000, 1_000, 30));
    }

    @Test
    void theRealIncidentShapeIsRefused() {
        // a ~254 KB snapshot replaced by a ~119 KB export is roughly 53% smaller
        assertTrue(SnapshotShrinkGuard.isSuspiciousShrink(1_800, 840, 30));
    }

    @Test
    void ordinaryChurnIsAllowed() {
        assertFalse(SnapshotShrinkGuard.isSuspiciousShrink(1_000, 1_020, 30), "growth");
        assertFalse(SnapshotShrinkGuard.isSuspiciousShrink(1_000, 1_000, 30), "unchanged");
        assertFalse(SnapshotShrinkGuard.isSuspiciousShrink(1_000, 950, 30), "a few deletions");
        assertFalse(SnapshotShrinkGuard.isSuspiciousShrink(1_000, 700, 30), "exactly at the limit");
    }

    @Test
    void justBeyondTheLimitIsRefused() {
        assertTrue(SnapshotShrinkGuard.isSuspiciousShrink(1_000, 699, 30));
    }

    @Test
    void anUnknownStoredSnapshotNeverBlocks() {
        assertFalse(SnapshotShrinkGuard.isSuspiciousShrink(0, 5, 30));
    }

    @Test
    void tinyDatabasesAreLeftAlone() {
        assertFalse(SnapshotShrinkGuard.isSuspiciousShrink(40, 10, 30));
        assertTrue(SnapshotShrinkGuard.isSuspiciousShrink(SnapshotShrinkGuard.MIN_ROWS_FOR_GUARD, 10, 30));
    }

    @Test
    void theCheckCanBeSwitchedOff() {
        assertFalse(SnapshotShrinkGuard.isSuspiciousShrink(1_000, 1, -1));
        assertFalse(SnapshotShrinkGuard.isSuspiciousShrink(1_000, 1, 100));
    }

    @Test
    void aZeroPercentLimitBlocksAnyShrink() {
        assertTrue(SnapshotShrinkGuard.isSuspiciousShrink(1_000, 999, 0));
        assertFalse(SnapshotShrinkGuard.isSuspiciousShrink(1_000, 1_000, 0));
    }
}
