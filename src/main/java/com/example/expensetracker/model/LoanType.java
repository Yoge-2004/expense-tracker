package com.example.expensetracker.model;

/**
 * Direction of a peer loan or casual friend adjustment.
 *
 * <ul>
 *   <li>{@link #LENT}: You gave money to a friend or covered an adjustment / bill split.
 *       This is an asset / receivable — money owed to you.</li>
 *   <li>{@link #BORROWED}: You took a loan or borrowed money from someone.
 *       This is a liability / payable — money you owe to others.</li>
 * </ul>
 *
 * @author Yogeshwaran
 */
public enum LoanType {
    /** Money given to a friend or colleague; they owe you (Receivable / Owed to You). */
    LENT,

    /** Money borrowed from a friend or lender; you owe them (Payable / You Owe). */
    BORROWED
}
