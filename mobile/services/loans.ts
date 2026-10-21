/**
 * @file loans.ts
 * @description API service and data models for managing peer loans, friend adjustments,
 * connected expenses, reminder schedules, debt positions, and settlements in the mobile app.
 */

import { apiRequest } from './api';

export type LoanType = 'LENT' | 'BORROWED';

export interface LoanAdjustment {
  id: number;
  counterparty: string;
  type: LoanType;
  amount: number;
  adjustmentDate: string;
  dueDate?: string | null;
  notes?: string | null;
  isSettled: boolean;
  settledDate?: string | null;
  expenseId?: number | null;
  expenseDescription?: string | null;
  expenseAmount?: number | null;
  reminderEnabled?: boolean;
  reminderDate?: string | null;
  reminderTime?: string | null;
  reminderFrequency?: string | null;
  createdAt?: string;
}

export interface LoanAdjustmentRequest {
  counterparty: string;
  type: LoanType;
  amount: number;
  adjustmentDate: string;
  dueDate?: string | null;
  notes?: string | null;
  isSettled?: boolean;
  expenseId?: number | null;
  reminderEnabled?: boolean;
  reminderDate?: string | null;
  reminderTime?: string | null;
  reminderFrequency?: string | null;
}

export interface LoanMetrics {
  totalLent: number;
  totalBorrowed: number;
  lentPending: number;
  borrowedPending: number;
  netBalance: number;
  totalCount: number;
  pendingCount: number;
  settledCount: number;
}

export async function getLoans(userId: number | string): Promise<LoanAdjustment[]> {
  return apiRequest(`/loans/user/${userId}`);
}

export async function getLoanMetrics(userId: number | string): Promise<LoanMetrics> {
  return apiRequest(`/loans/metrics/user/${userId}`);
}

export async function createLoan(
  userId: number | string,
  data: LoanAdjustmentRequest
): Promise<LoanAdjustment> {
  return apiRequest(`/loans/user/${userId}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateLoan(
  id: number,
  userId: number | string,
  data: LoanAdjustmentRequest
): Promise<LoanAdjustment> {
  return apiRequest(`/loans/${id}/user/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function toggleSettleLoan(
  id: number,
  userId: number | string
): Promise<LoanAdjustment> {
  return apiRequest(`/loans/${id}/settle/user/${userId}`, {
    method: 'PUT',
  });
}

export async function deleteLoan(
  id: number,
  userId: number | string
): Promise<void> {
  return apiRequest(`/loans/${id}/user/${userId}`, {
    method: 'DELETE',
  });
}
