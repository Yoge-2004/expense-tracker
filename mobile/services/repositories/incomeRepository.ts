/**
 * @file incomeRepository.ts
 * @description Encapsulated repository for income and recurring income operations.
 * Adheres to Dependency Inversion Principle (DIP) and Single Responsibility Principle (SRP).
 */

import { apiRequest } from '../api';
import { Income, IncomeRequest } from '../../types/domain';

export const incomeRepository = {
  /**
   * Fetches all incomes for a user.
   */
  async getByUserId(userId: number | string, options?: { skipCache?: boolean }): Promise<Income[]> {
    return apiRequest<Income[]>(`/incomes/user/${userId}`, options);
  },

  /**
   * Creates a new income record.
   */
  async create(userId: number | string, data: IncomeRequest): Promise<Income> {
    return apiRequest<Income>(`/incomes/user/${userId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Updates an existing income record.
   */
  async update(id: number | string, userId: number | string, data: IncomeRequest): Promise<Income> {
    return apiRequest<Income>(`/incomes/${id}/user/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Deletes an income record.
   */
  async delete(id: number | string, userId: number | string): Promise<void> {
    return apiRequest<void>(`/incomes/${id}/user/${userId}`, {
      method: 'DELETE',
    });
  },
};
