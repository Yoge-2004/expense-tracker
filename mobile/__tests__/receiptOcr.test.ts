import { parseReceiptText, SAMPLE_RECEIPTS } from '../services/receiptOcr';

describe('Receipt OCR Service', () => {
  it('correctly parses supermarket grocery receipt text', () => {
    const parsed = parseReceiptText(SAMPLE_RECEIPTS[0].text);

    expect(parsed.amount).toBe(551.70);
    expect(parsed.merchant).toContain("TRADER JOE'S");
    expect(parsed.category).toBe('Groceries');
    expect(parsed.date).toBe('2026-10-14');
    expect(parsed.breakdown.subtotal).toBe(554.00);
    expect(parsed.breakdown.totalTax).toBe(27.70);
    expect(parsed.breakdown.discount).toBe(30.00);
  });

  it('correctly parses coffee shop receipt text', () => {
    const parsed = parseReceiptText(SAMPLE_RECEIPTS[1].text);

    expect(parsed.amount).toBe(645.76);
    expect(parsed.merchant).toBe('STARBUCKS COFFEE');
    expect(parsed.category).toBe('Food & Dining');
    expect(parsed.date).toBe('2026-10-15');
  });

  it('correctly parses petrol station bill', () => {
    const parsed = parseReceiptText(SAMPLE_RECEIPTS[2].text);

    expect(parsed.amount).toBe(2552.90);
    expect(parsed.merchant).toContain('SHELL');
    expect(parsed.category).toBe('Transportation');
  });

  it('correctly parses Indian Rupee pharmacy bill with Rs. prefix', () => {
    const parsed = parseReceiptText(SAMPLE_RECEIPTS[3].text);

    expect(parsed.amount).toBe(452.80);
    expect(parsed.merchant).toBe('APOLLO PHARMACY');
    expect(parsed.category).toBe('Health & Medical');
  });

  it('correctly parses integer amounts without decimals', () => {
    const raw = `SWIGGY FOOD ORDER\nDate: 2026-10-18\nBiryani Combo: Rs 450\nTotal: Rs 450`;
    const parsed = parseReceiptText(raw);

    expect(parsed.amount).toBe(450);
    expect(parsed.merchant).toBe('SWIGGY FOOD ORDER');
    expect(parsed.category).toBe('Food & Dining');
  });

  it('handles empty or malformed text gracefully', () => {
    const parsed = parseReceiptText('');
    expect(parsed.amount).toBe(0);
    expect(parsed.merchant).toBe('Receipt Purchase');
  });
});
