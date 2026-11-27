/**
 * @file budgetRepository.ts
 * @description Encapsulated repository for budget allocations and status monitoring.
 * Adheres to Dependency Inversion Principle (DIP) and Single Responsibility Principle (SRP).
 */

import { apiRequest } from '../api';
import { BudgetRequest, BudgetStatus } from '../../types/domain';

export const budgetRepository = {
  /**
   * Fetches real-time budget status per category for a user.
   */
  async getStatusByUserId(userId: number | string, options?: { skipCache?: boolean }): Promise<BudgetStatus[]> {
    return apiRequest<BudgetStatus[]>(`/expenses/budget/status/user/${userId}`, options);
  },

  /**
   * Sets or updates a budget allocation for a category.
   */
  async setBudget(userId: number | string, data: BudgetRequest): Promise<BudgetStatus> {
    const resolvedLimit = data.limitAmount ?? data.amount;
    const payload: Record<string, unknown> = {
      categoryId: data.categoryId,
      limitAmount: resolvedLimit,
      ...(data.period !== undefined ? { period: data.period } : {}),
      ...(data.intervalDays !== undefined ? { intervalDays: data.intervalDays } : {}),
      ...(data.startDate !== undefined ? { startDate: data.startDate } : {}),
      ...(data.endDate !== undefined ? { endDate: data.endDate } : {}),
    };
    return apiRequest<BudgetStatus>(`/expenses/budget/user/${userId}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Deletes a budget by budgetId.
   */
  async deleteById(budgetId: number | string): Promise<void> {
    return apiRequest<void>(`/expenses/budget/${budgetId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Deletes a budget by userId and categoryId.
   */
  async deleteByUserAndCategory(userId: number | string, categoryId: number | string): Promise<void> {
    return apiRequest<void>(`/expenses/budget/user/${userId}/category/${categoryId}`, {
      method: 'DELETE',
    });
  },
};
