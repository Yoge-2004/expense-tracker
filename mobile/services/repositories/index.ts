/**
 * @file index.ts
 * @description Central export gateway for all domain repositories.
 * Promotes DIP by decoupling UI screens from lower-level HTTP endpoints.
 */

export { expenseRepository } from './expenseRepository';
export { incomeRepository } from './incomeRepository';
export { categoryRepository } from './categoryRepository';
export { budgetRepository } from './budgetRepository';
export { savingsGoalRepository } from './savingsGoalRepository';
