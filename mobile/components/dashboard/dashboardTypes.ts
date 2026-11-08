import { ThemeColors } from '../../constants/theme';

export interface RawExpenseCandidate {
  id?: number;
  description?: string;
  amount?: number;
  categoryId?: number | string;
  expenseDate?: string;
  categoryName?: string;
  isRecurring?: boolean;
  recurring?: boolean;
  [key: string]: unknown;
}

export interface RawIncomeCandidate {
  id?: number;
  source?: string;
  amount?: number;
  incomeDate?: string;
  description?: string;
  isRecurring?: boolean;
  frequency?: string;
  intervalDays?: number | string;
  kind?: string | null;
  countsTowardMonth?: string | null;
  reimbursedCategoryId?: number | string;
  [key: string]: unknown;
}

export interface UnifiedTxItem {
  id: number;
  uniqueKey: string;
  type: 'expense' | 'income';
  title: string;
  categoryOrSource: string;
  amount: number;
  date: string;
  isRecurring: boolean;
  expenseRaw?: RawExpenseCandidate;
  incomeRaw?: RawIncomeCandidate;
}

export interface TransactionRowProps {
  tx: UnifiedTxItem;
  colors: ThemeColors;
  currSymbol: string;
  isStealth?: boolean;
  onPress: (tx: UnifiedTxItem) => void;
  onEdit: (tx: UnifiedTxItem) => void;
  onDelete: (tx: UnifiedTxItem) => void;
}
