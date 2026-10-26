import { ThemeColors } from '../../constants/theme';

export interface UnifiedTxItem {
  id: number;
  uniqueKey: string;
  type: 'expense' | 'income';
  title: string;
  categoryOrSource: string;
  amount: number;
  date: string;
  isRecurring: boolean;
  expenseRaw?: any;
  incomeRaw?: any;
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
