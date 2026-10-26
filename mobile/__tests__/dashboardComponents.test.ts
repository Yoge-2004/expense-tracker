import { TransactionRow } from '../components/dashboard/TransactionRow';
import { SearchField } from '../components/dashboard/SearchField';

describe('Dashboard Extracted Components', () => {
  it('TransactionRow exports a valid memo component', () => {
    expect(TransactionRow).toBeDefined();
    expect(typeof TransactionRow).toBe('object'); // React.memo component
  });

  it('SearchField exports a valid memo component', () => {
    expect(SearchField).toBeDefined();
    expect(typeof SearchField).toBe('object'); // React.memo component
  });
});
