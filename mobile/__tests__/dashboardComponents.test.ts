import { TransactionRow } from '../components/dashboard/TransactionRow';
import { SearchField } from '../components/dashboard/SearchField';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { DashboardMetricsMatrix } from '../components/dashboard/DashboardMetricsMatrix';
import { DashboardLedger } from '../components/dashboard/DashboardLedger';
import { SavingsGoalsSection } from '../components/dashboard/SavingsGoalsSection';

describe('Dashboard Extracted Components', () => {
  it('TransactionRow exports a valid memo component', () => {
    expect(TransactionRow).toBeDefined();
    expect(typeof TransactionRow).toBe('object'); // React.memo component
  });

  it('SearchField exports a valid memo component', () => {
    expect(SearchField).toBeDefined();
    expect(typeof SearchField).toBe('object'); // React.memo component
  });

  it('DashboardHeader exports a valid memo component', () => {
    expect(DashboardHeader).toBeDefined();
    expect(typeof DashboardHeader).toBe('object');
  });

  it('DashboardMetricsMatrix exports a valid memo component', () => {
    expect(DashboardMetricsMatrix).toBeDefined();
    expect(typeof DashboardMetricsMatrix).toBe('object');
  });

  it('DashboardLedger exports a valid memo component', () => {
    expect(DashboardLedger).toBeDefined();
    expect(typeof DashboardLedger).toBe('object');
  });

  it('SavingsGoalsSection exports a valid memo component', () => {
    expect(SavingsGoalsSection).toBeDefined();
    expect(typeof SavingsGoalsSection).toBe('object');
  });
});
