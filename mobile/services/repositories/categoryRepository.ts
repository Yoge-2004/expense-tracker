/**
 * @file categoryRepository.ts
 * @description Encapsulated repository for category retrieval and management.
 * Adheres to Dependency Inversion Principle (DIP) and Single Responsibility Principle (SRP).
 */

import { apiRequest } from '../api';
import { Category, CategoryRequest } from '../../types/domain';

export const categoryRepository = {
  /**
   * Fetches system global categories.
   */
  async getGlobal(): Promise<Category[]> {
    return apiRequest<Category[]>('/categories/global');
  },

  /**
   * Fetches user custom categories.
   */
  async getByUserId(userId: number | string): Promise<Category[]> {
    return apiRequest<Category[]>(`/categories/user/${userId}`);
  },

  /**
   * Fetches combined global and user categories.
   */
  async getAllForUser(userId: number | string): Promise<Category[]> {
    const [globalList, userList] = await Promise.all([
      this.getGlobal().catch(() => []),
      this.getByUserId(userId).catch(() => []),
    ]);

    const combined: Category[] = [
      ...globalList.map((g) => ({ ...g, isCustom: false })),
      ...userList.map((u) => ({ ...u, isCustom: true })),
    ];
    return combined;
  },

  /**
   * Creates a custom category for the user.
   */
  async create(userId: number | string, data: CategoryRequest): Promise<Category> {
    return apiRequest<Category>(`/categories/user/${userId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Deletes a user custom category.
   */
  async delete(id: number | string, userId: number | string): Promise<void> {
    return apiRequest<void>(`/categories/${id}/user/${userId}`, {
      method: 'DELETE',
    });
  },
};
