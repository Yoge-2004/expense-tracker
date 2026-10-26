import { ExpenseFormTab } from '../components/forms/ExpenseFormTab';
import { IncomeFormTab } from '../components/forms/IncomeFormTab';
import { SavingsGoalFormTab } from '../components/forms/SavingsGoalFormTab';
import { BudgetFormTab } from '../components/forms/BudgetFormTab';

describe('Modular Form Components', () => {
  it('ExpenseFormTab exports a valid component', () => {
    expect(ExpenseFormTab).toBeDefined();
    expect(typeof ExpenseFormTab).toBe('object'); // React.memo component
  });

  it('IncomeFormTab exports a valid component', () => {
    expect(IncomeFormTab).toBeDefined();
    expect(typeof IncomeFormTab).toBe('object'); // React.memo component
  });

  it('SavingsGoalFormTab exports a valid component', () => {
    expect(SavingsGoalFormTab).toBeDefined();
    expect(typeof SavingsGoalFormTab).toBe('object');
  });

  it('BudgetFormTab exports a valid component', () => {
    expect(BudgetFormTab).toBeDefined();
    expect(typeof BudgetFormTab).toBe('object');
  });
});
