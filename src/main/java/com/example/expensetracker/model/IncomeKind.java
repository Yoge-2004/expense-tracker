package com.example.expensetracker.model;

/**
 * What an income record means for monthly accounting.
 *
 * <p>Stored as text on {@link Income#getKind()}; rows created before this
 * existed have no value and are classified from their source (see
 * {@code IncomeRules.effectiveKind}).</p>
 */
public enum IncomeKind {
    /** Regular pay. Counts as income and drives the salary-coverage figures. */
    SALARY,
    /** Any other money earned: freelance, interest, gifts, bonuses. Counts as income. */
    OTHER,
    /**
     * Money handed back for something the user already paid for (a friend repaying a bill,
     * a refund). It is NOT income: it reduces what was spent that month.
     */
    REIMBURSEMENT
}
