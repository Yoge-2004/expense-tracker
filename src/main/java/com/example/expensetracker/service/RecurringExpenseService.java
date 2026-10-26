package com.example.expensetracker.service;

import com.example.expensetracker.dto.ExpenseDto;

import java.util.List;
import java.util.Map;

/**
 * Service interface for recurring subscription and automated billing management.
 *
 * @author Yogeshwaran
 */
public interface RecurringExpenseService {

    /**
     * Registers a recurring expense subscription and records the first immediate payment expense.
     *
     * @param userId the owning user ID
     * @param dto    the expense details including frequency, intervalDays, and category
     */
    void createRecurringExpense(Long userId, ExpenseDto dto);

    /**
     * Retrieves all active recurring subscriptions for a user.
     *
     * @param userId the owning user ID
     * @return list of serialized subscription data
     */
    List<Map<String, Object>> getUserSubscriptions(Long userId);

    /**
     * Partially updates an existing subscription's properties.
     *
     * @param recId   the recurring expense ID
     * @param updates key-value map of updated fields
     */
    void updateSubscription(Long recId, Map<String, Object> updates);

    /**
     * Permanently cancels and deletes a subscription.
     *
     * @param recId the recurring expense ID to cancel
     */
    void deleteSubscription(Long recId);
}
