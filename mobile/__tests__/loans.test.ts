import {
  getLoans,
  getLoanMetrics,
  createLoan,
  toggleSettleLoan,
  deleteLoan,
  LoanAdjustment,
  LoanMetrics,
} from '../services/loans';
import { apiRequest } from '../services/api';

jest.mock('../services/api', () => ({
  apiRequest: jest.fn(),
}));

describe('Loans Service', () => {
  const mockApiRequest = apiRequest as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches all loans for user', async () => {
    const mockLoans: LoanAdjustment[] = [
      {
        id: 1,
        counterparty: 'Rahul',
        type: 'LENT',
        amount: 1500,
        adjustmentDate: '2026-10-20',
        isSettled: false,
      },
    ];
    mockApiRequest.mockResolvedValueOnce(mockLoans);

    const result = await getLoans(7);
    expect(mockApiRequest).toHaveBeenCalledWith('/loans/user/7');
    expect(result).toEqual(mockLoans);
  });

  it('fetches loan metrics for user', async () => {
    const mockMetrics: LoanMetrics = {
      totalLent: 5000,
      totalBorrowed: 2000,
      lentPending: 3000,
      borrowedPending: 1200,
      netBalance: 1800,
      totalCount: 4,
      pendingCount: 2,
      settledCount: 2,
    };
    mockApiRequest.mockResolvedValueOnce(mockMetrics);

    const result = await getLoanMetrics(7);
    expect(mockApiRequest).toHaveBeenCalledWith('/loans/metrics/user/7');
    expect(result.netBalance).toBe(1800);
    expect(result.pendingCount).toBe(2);
  });

  it('creates a new loan / adjustment', async () => {
    const created: LoanAdjustment = {
      id: 10,
      counterparty: 'Priya',
      type: 'BORROWED',
      amount: 800,
      adjustmentDate: '2026-10-21',
      isSettled: false,
    };
    mockApiRequest.mockResolvedValueOnce(created);

    const result = await createLoan(7, {
      counterparty: 'Priya',
      type: 'BORROWED',
      amount: 800,
      adjustmentDate: '2026-10-21',
    });

    expect(mockApiRequest).toHaveBeenCalledWith('/loans/user/7', {
      method: 'POST',
      body: JSON.stringify({
        counterparty: 'Priya',
        type: 'BORROWED',
        amount: 800,
        adjustmentDate: '2026-10-21',
      }),
    });
    expect(result.id).toBe(10);
  });

  it('toggles loan settlement', async () => {
    const updated: LoanAdjustment = {
      id: 10,
      counterparty: 'Priya',
      type: 'BORROWED',
      amount: 800,
      adjustmentDate: '2026-10-21',
      isSettled: true,
      settledDate: '2026-10-21',
    };
    mockApiRequest.mockResolvedValueOnce(updated);

    const result = await toggleSettleLoan(10, 7);
    expect(mockApiRequest).toHaveBeenCalledWith('/loans/10/settle/user/7', {
      method: 'PUT',
    });
    expect(result.isSettled).toBe(true);
  });

  it('deletes a loan record', async () => {
    mockApiRequest.mockResolvedValueOnce(undefined);
    await deleteLoan(10, 7);
    expect(mockApiRequest).toHaveBeenCalledWith('/loans/10/user/7', {
      method: 'DELETE',
    });
  });
});
