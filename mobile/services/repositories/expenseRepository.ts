/**
 * @file expenseRepository.ts
 * @description Encapsulated repository for expense data access operations.
 * Adheres to Dependency Inversion Principle (DIP) and Single Responsibility Principle (SRP).
 */

import { apiRequest } from '../api';
import { Expense, ExpenseRequest, RecurringExpense } from '../../types/domain';

export const expenseRepository = {
  /**
   * Fetches all expenses for a user.
   */
  async getByUserId(userId: number | string, options?: { skipCache?: boolean }): Promise<Expense[]> {
    return apiRequest<Expense[]>(`/expenses/user/${userId}`, options);
  },

  /**
   * Creates a new expense record.
   */
  async create(userId: number | string, data: ExpenseRequest): Promise<Expense> {
    return apiRequest<Expense>(`/expenses/user/${userId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Updates an existing expense record.
   */
  async update(id: number | string, userId: number | string, data: ExpenseRequest): Promise<Expense> {
    return apiRequest<Expense>(`/expenses/${id}/user/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Deletes an expense record.
   */
  async delete(id: number | string, userId: number | string): Promise<void> {
    return apiRequest<void>(`/expenses/${id}/user/${userId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Fetches recurring expense subscriptions for a user.
   */
  async getRecurring(userId: number | string, options?: { skipCache?: boolean }): Promise<RecurringExpense[]> {
    return apiRequest<RecurringExpense[]>(`/expenses/recurring/user/${userId}`, options);
  },

  /**
   * Updates an existing recurring expense subscription.
   */
  async updateRecurring(id: number | string, data: Partial<RecurringExpense>): Promise<RecurringExpense> {
    return apiRequest<RecurringExpense>(`/expenses/recurring/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Deletes an existing recurring expense subscription.
   */
  async deleteRecurring(id: number | string): Promise<void> {
    return apiRequest<void>(`/expenses/recurring/${id}`, {
      method: 'DELETE',
    });
  },
};
