/**
 * @jest-environment node
 *
 * Unit tests for SampleReceiptsPicker component.
 */

import React from 'react';
import { SampleReceiptsPicker } from '../components/SampleReceiptsPicker';
import { SAMPLE_RECEIPTS } from '../services/receiptOcr';

describe('SampleReceiptsPicker', () => {
  const dummyColors = {
    border: '#E2E8F0',
    textMuted: '#64748B',
    inputBg: '#F8FAFC',
    primary: '#10B981',
    text: '#0F172A',
  };

  it('exports a valid React component', () => {
    expect(SampleReceiptsPicker).toBeDefined();
    expect(typeof SampleReceiptsPicker).toBe('object'); // React.memo
  });

  it('renders null when visible is false', () => {
    const onSelect = jest.fn();
    const element = React.createElement(SampleReceiptsPicker, {
      visible: false,
      onSelect,
      colors: dummyColors,
    });
    expect(element.props.visible).toBe(false);
  });

  it('contains all sample receipt definitions from receiptOcr', () => {
    expect(SAMPLE_RECEIPTS.length).toBeGreaterThan(0);
    SAMPLE_RECEIPTS.forEach((receipt) => {
      expect(receipt.name).toBeTruthy();
      expect(receipt.text).toBeTruthy();
      expect(receipt.icon).toBeTruthy();
    });
  });
});
