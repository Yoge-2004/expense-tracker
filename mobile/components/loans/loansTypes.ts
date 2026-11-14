/**
 * @file loansTypes.ts
 * @description Types and contracts for the decomposed Loans & Friend Adjustments module.
 */

import { ThemeColors } from '../../constants/theme';
import { LoanAdjustment, LoanMetrics } from '../../types/domain';
import { AlertButton, AlertType } from '../../context/AlertContext';

export interface LoanExpenseCandidate {
  id: number;
  amount: number;
  description: string;
  categoryName?: string;
  expenseDate?: string;
}

export type LoanFilterTab = 'ALL' | 'LENT' | 'BORROWED' | 'PENDING';
export type ReminderFrequency = 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface LoansSectionProps {
  userId: string | number | null;
  currSymbol: string;
  isStealthMode: boolean;
  isLargeScreen: boolean;
  colors: ThemeColors;
  theme: 'light' | 'dark';
  loans: LoanAdjustment[];
  loanMetrics: LoanMetrics | null;
  expenses?: LoanExpenseCandidate[];
  setLoans: React.Dispatch<React.SetStateAction<LoanAdjustment[]>>;
  setLoanMetrics: React.Dispatch<React.SetStateAction<LoanMetrics | null>>;
  showAlert: (title: string, message: string, buttons?: AlertButton[], type?: AlertType) => void;
}
