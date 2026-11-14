/**
 * @file repositories.test.ts
 * @description Unit tests for domain repositories adhering to DIP and SRP.
 */

import {
  expenseRepository,
  incomeRepository,
  categoryRepository,
  budgetRepository,
  savingsGoalRepository,
  mlRepository,
} from '../services/repositories';
import { apiRequest } from '../services/api';

jest.mock('../services/api', () => ({
  apiRequest: jest.fn(),
}));

describe('Domain Repositories (DIP)', () => {
  const mockApiRequest = apiRequest as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('expenseRepository', () => {
    it('fetches expenses by userId', async () => {
      const mockExpenses = [{ id: 1, description: 'Coffee', amount: 150 }];
      mockApiRequest.mockResolvedValueOnce(mockExpenses);

      const result = await expenseRepository.getByUserId(10);
      expect(mockApiRequest).toHaveBeenCalledWith('/expenses/user/10', undefined);
      expect(result).toEqual(mockExpenses);
    });

    it('creates an expense', async () => {
      const payload = { description: 'Dinner', amount: 500, expenseDate: '2026-11-14' };
      mockApiRequest.mockResolvedValueOnce({ id: 2, ...payload });

      const result = await expenseRepository.create(10, payload);
      expect(mockApiRequest).toHaveBeenCalledWith('/expenses/user/10', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      expect(result.id).toBe(2);
    });

    it('updates an expense', async () => {
      const payload = { description: 'Dinner Edited', amount: 550, expenseDate: '2026-11-14' };
      mockApiRequest.mockResolvedValueOnce({ id: 2, ...payload });

      const result = await expenseRepository.update(2, 10, payload);
      expect(mockApiRequest).toHaveBeenCalledWith('/expenses/2/user/10', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      expect(result.amount).toBe(550);
    });

    it('deletes an expense', async () => {
      mockApiRequest.mockResolvedValueOnce(undefined);

      await expenseRepository.delete(2, 10);
      expect(mockApiRequest).toHaveBeenCalledWith('/expenses/2/user/10', {
        method: 'DELETE',
      });
    });
  });

  describe('incomeRepository', () => {
    it('fetches incomes by userId', async () => {
      const mockIncomes = [{ id: 1, source: 'Salary', amount: 75000 }];
      mockApiRequest.mockResolvedValueOnce(mockIncomes);

      const result = await incomeRepository.getByUserId(10);
      expect(mockApiRequest).toHaveBeenCalledWith('/incomes/user/10', undefined);
      expect(result).toEqual(mockIncomes);
    });

    it('creates an income', async () => {
      const payload = { source: 'Bonus', amount: 10000, incomeDate: '2026-11-14' };
      mockApiRequest.mockResolvedValueOnce({ id: 3, ...payload });

      const result = await incomeRepository.create(10, payload);
      expect(mockApiRequest).toHaveBeenCalledWith('/incomes/user/10', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      expect(result.id).toBe(3);
    });
  });

  describe('categoryRepository', () => {
    it('fetches combined categories for user', async () => {
      const globalCats = [{ id: 1, name: 'Food' }];
      const userCats = [{ id: 2, name: 'Gadgets' }];
      mockApiRequest
        .mockResolvedValueOnce(globalCats)
        .mockResolvedValueOnce(userCats);

      const result = await categoryRepository.getAllForUser(10);
      expect(mockApiRequest).toHaveBeenCalledWith('/categories/global');
      expect(mockApiRequest).toHaveBeenCalledWith('/categories/user/10');
      expect(result.length).toBe(2);
      expect(result[0].isCustom).toBe(false);
      expect(result[1].isCustom).toBe(true);
    });
  });

  describe('budgetRepository', () => {
    it('fetches budget status by userId', async () => {
      const mockStatus = [{ categoryId: 1, categoryName: 'Food', budgetAmount: 10000, currentSpending: 6000, percentageSpent: 60, status: 'SAFE', remaining: 4000 }];
      mockApiRequest.mockResolvedValueOnce(mockStatus);

      const result = await budgetRepository.getStatusByUserId(10);
      expect(mockApiRequest).toHaveBeenCalledWith('/expenses/budget/status/user/10', undefined);
      expect(result).toEqual(mockStatus);
    });

    it('sets budget cap', async () => {
      const payload = { categoryId: 1, amount: 12000, period: 'MONTHLY' };
      mockApiRequest.mockResolvedValueOnce({ categoryId: 1, budgetAmount: 12000 });

      await budgetRepository.setBudget(10, payload);
      expect(mockApiRequest).toHaveBeenCalledWith('/expenses/budget/user/10', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    });
  });

  describe('savingsGoalRepository', () => {
    it('fetches goals and deposits money', async () => {
      const mockGoals = [{ id: 5, name: 'New Laptop', targetAmount: 80000, currentAmount: 20000 }];
      mockApiRequest.mockResolvedValueOnce(mockGoals);

      const result = await savingsGoalRepository.getByUserId(10);
      expect(mockApiRequest).toHaveBeenCalledWith('/savings/goals/user/10', undefined);
      expect(result).toEqual(mockGoals);

      mockApiRequest.mockResolvedValueOnce({ id: 5, currentAmount: 25000 });
      const updated = await savingsGoalRepository.deposit(5, 10, 5000);
      expect(mockApiRequest).toHaveBeenCalledWith('/savings/goals/5/deposit/user/10?amount=5000', {
        method: 'POST',
      });
      expect(updated.currentAmount).toBe(25000);
    });
  });

  describe('mlRepository', () => {
    it('fetches live ML health status', async () => {
      const mockHealth = {
        status: 'healthy',
        active_model: 'DualGram_SGD',
        model_revision: 'v2.5.0',
        auxiliary_models: {
          merchant_matcher: { status: 'ready', metrics: { accuracy: 0.981 } },
        },
      };
      mockApiRequest.mockResolvedValueOnce(mockHealth);

      const result = await mlRepository.getHealth();
      expect(mockApiRequest).toHaveBeenCalledWith('/ml/health');
      expect(result.status).toBe('healthy');
      expect(result.auxiliary_models?.merchant_matcher?.status).toBe('ready');
    });

    it('falls back gracefully to offline state when health check throws', async () => {
      mockApiRequest.mockRejectedValueOnce(new Error('Network error'));

      const result = await mlRepository.getHealth();
      expect(result.status).toBe('offline');
      expect(result.active_model).toContain('Offline');
    });

    it('classifies expense description', async () => {
      const mockResp = {
        predictions: [{ category: 'Food & Dining', confidence: 0.92 }],
      };
      mockApiRequest.mockResolvedValueOnce(mockResp);

      const result = await mlRepository.classify('Starbucks Latte', 3);
      expect(mockApiRequest).toHaveBeenCalledWith('/ml/classify', {
        method: 'POST',
        body: JSON.stringify({ description: 'Starbucks Latte', top_n: 3 }),
      });
      expect(result.predictions[0].category).toBe('Food & Dining');
    });

    it('matches merchant string to canonical brand', async () => {
      const mockResp = { canonical_merchant: 'Uber', confidence: 0.97 };
      mockApiRequest.mockResolvedValueOnce(mockResp);

      const result = await mlRepository.matchMerchant('UBER *TRIP 123');
      expect(mockApiRequest).toHaveBeenCalledWith('/ml/merchants/match', {
        method: 'POST',
        body: JSON.stringify({ raw_merchant: 'UBER *TRIP 123', top_k: 5 }),
      });
      expect(result.canonical_merchant).toBe('Uber');
    });
  });
});

