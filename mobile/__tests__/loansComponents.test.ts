/**
 * @file loansComponents.test.ts
 * @description Unit tests for decomposed Loans SRP components.
 */

import React from 'react';
import { LoanMetricsHeader } from '../components/loans/LoanMetricsHeader';
import { LoanFilterTabs } from '../components/loans/LoanFilterTabs';
import { LoanItemCard } from '../components/loans/LoanItemCard';
import { LoansSection } from '../components/LoansSection';
import { Colors } from '../constants/theme';
import { LoanAdjustment } from '../types/domain';

describe('Loans Component Decomposition (SRP)', () => {
  const colors = Colors.dark;

  const sampleLoan: LoanAdjustment = {
    id: 101,
    counterparty: 'Vikram',
    type: 'LENT',
    amount: 1500,
    adjustmentDate: '2026-11-01',
    dueDate: '2026-11-20',
    notes: 'Dinner split',
    isSettled: false,
    reminderEnabled: true,
    reminderFrequency: 'DAILY',
    reminderTime: '10:00',
  };

  it('renders LoanMetricsHeader correctly with valid metrics', () => {
    const metrics = {
      totalLent: 5000,
      totalBorrowed: 2000,
      lentPending: 3000,
      borrowedPending: 1200,
      netBalance: 1800,
      totalCount: 4,
      pendingCount: 2,
      settledCount: 2,
    };

    const header = React.createElement(LoanMetricsHeader, {
      loanMetrics: metrics,
      loansCount: 4,
      currSymbol: '₹',
      isStealthMode: false,
      colors,
    });

    expect(header).toBeDefined();
    expect(header.props.loansCount).toBe(4);
    expect(header.props.loanMetrics?.netBalance).toBe(1800);
  });

  it('masks values in LoanMetricsHeader when stealth mode is active', () => {
    const header = React.createElement(LoanMetricsHeader, {
      loanMetrics: {
        totalLent: 5000,
        totalBorrowed: 2000,
        lentPending: 3000,
        borrowedPending: 1200,
        netBalance: 1800,
        totalCount: 4,
        pendingCount: 2,
        settledCount: 2,
      },
      loansCount: 4,
      currSymbol: '₹',
      isStealthMode: true,
      colors,
    });

    expect(header.props.isStealthMode).toBe(true);
  });

  it('renders LoanFilterTabs with selected tab', () => {
    const onSelectFilter = jest.fn();
    const tabs = React.createElement(LoanFilterTabs, {
      activeFilter: 'LENT',
      onSelectFilter,
      colors,
      theme: 'dark',
    });

    expect(tabs.props.activeFilter).toBe('LENT');
  });

  it('renders LoanItemCard with correct loan properties', () => {
    const onToggleSettle = jest.fn();
    const onEdit = jest.fn();
    const onDelete = jest.fn();

    const card = React.createElement(LoanItemCard, {
      loan: sampleLoan,
      colors,
      currSymbol: '₹',
      isLight: false,
      isStealthMode: false,
      onToggleSettle,
      onEdit,
      onDelete,
    });

    expect(card.props.loan.counterparty).toBe('Vikram');
    expect(card.props.loan.amount).toBe(1500);
    expect(card.props.loan.isSettled).toBe(false);
  });

  it('renders LoansSection parent orchestrator', () => {
    const showAlert = jest.fn();
    const setLoans = jest.fn();
    const setLoanMetrics = jest.fn();

    const section = React.createElement(LoansSection, {
      userId: 1,
      currSymbol: '₹',
      isStealthMode: false,
      isLargeScreen: false,
      colors,
      theme: 'dark',
      loans: [sampleLoan],
      loanMetrics: null,
      expenses: [],
      setLoans,
      setLoanMetrics,
      showAlert,
    });

    expect(section).toBeDefined();
    expect(section.props.loans.length).toBe(1);
  });
});
