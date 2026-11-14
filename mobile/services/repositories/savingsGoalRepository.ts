/**
 * @file savingsGoalRepository.ts
 * @description Encapsulated repository for savings goals and chit-fund deposits.
 * Adheres to Dependency Inversion Principle (DIP) and Single Responsibility Principle (SRP).
 */

import { apiRequest } from '../api';
import { SavingsGoal, SavingsGoalRequest } from '../../types/domain';

export const savingsGoalRepository = {
  /**
   * Fetches all savings goals for a user.
   */
  async getByUserId(userId: number | string, options?: { skipCache?: boolean }): Promise<SavingsGoal[]> {
    return apiRequest<SavingsGoal[]>(`/savings/goals/user/${userId}`, options);
  },

  /**
   * Creates a new savings goal.
   */
  async create(userId: number | string, data: SavingsGoalRequest): Promise<SavingsGoal> {
    return apiRequest<SavingsGoal>(`/savings/goals/user/${userId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Updates an existing savings goal.
   */
  async update(id: number | string, userId: number | string, data: SavingsGoalRequest): Promise<SavingsGoal> {
    return apiRequest<SavingsGoal>(`/savings/goals/${id}/user/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Records a manual deposit towards a savings goal.
   */
  async deposit(goalId: number | string, userId: number | string, amount: number): Promise<SavingsGoal> {
    return apiRequest<SavingsGoal>(`/savings/goals/${goalId}/deposit/user/${userId}?amount=${amount}`, {
      method: 'POST',
    });
  },

  /**
   * Deletes a savings goal.
   */
  async delete(goalId: number | string, userId: number | string): Promise<void> {
    return apiRequest<void>(`/savings/goals/${goalId}/user/${userId}`, {
      method: 'DELETE',
    });
  },
};
