/**
 * @file index.ts
 * @description Central export gateway for all domain repositories.
 * Promotes DIP by decoupling UI screens from lower-level HTTP endpoints.
 */

import { expenseRepository } from './expenseRepository';
import { incomeRepository } from './incomeRepository';
import { categoryRepository } from './categoryRepository';
import { budgetRepository } from './budgetRepository';
import { savingsGoalRepository } from './savingsGoalRepository';
import { mlRepository } from './mlRepository';

export {
  expenseRepository,
  incomeRepository,
  categoryRepository,
  budgetRepository,
  savingsGoalRepository,
  mlRepository,
};

export const Repositories = {
  expense: expenseRepository,
  income: incomeRepository,
  category: categoryRepository,
  budget: budgetRepository,
  savingsGoal: savingsGoalRepository,
  ml: mlRepository,
};

