/**
 * @file receiptOcr.ts
 * @description Mobile Receipt OCR and Document Scanning Engine for Expense Tracker.
 * Parses receipts, bills, invoices, and payment confirmations to extract:
 * - Grand Total, Subtotal, Taxes (GST/VAT), Discounts, Charges
 * - Transaction Date
 * - Merchant / Vendor identification
 * - Automated Expense Category prediction
 *
 * Supports both on-device regex intelligence and backend OCR (/api/expenses/ocr) integration,
 * with built-in realistic sample receipts for immediate one-tap testing.
 */

import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { API_BASE_URL, safeStorageGet } from './api';

export interface ReceiptBreakdown {
  grandTotal?: number | null;
  subtotal?: number | null;
  cgst?: number | null;
  sgst?: number | null;
  igst?: number | null;
  vat?: number | null;
  totalTax?: number | null;
  discount?: number | null;
  charges?: number | null;
}

export interface ParsedReceipt {
  rawText: string;
  amount: number;
  date: string;
  merchant: string;
  category: string;
  confidence: number;
  breakdown: ReceiptBreakdown;
}

export const SAMPLE_RECEIPTS: Array<{ name: string; icon: string; text: string }> = [
  {
    name: 'Supermarket Grocery Bill',
    icon: 'cart-outline',
    text: `TRADER JOE'S MARKET
Store #542 - 1200 Market Street
Date: 2026-10-14
Fresh Organic Milk 1L       ₹64.00
Farm Brown Eggs (12pk)      ₹120.00
Whole Wheat Sourdough Bread ₹75.00
Ripe Avocados (4pk)         ₹160.00
Greek Yogurt 500g           ₹135.00
Sub Total: ₹554.00
CGST @ 2.5%: ₹13.85
SGST @ 2.5%: ₹13.85
Total Tax: ₹27.70
Discount Coupon: -₹30.00
Grand Total: ₹551.70
Paid by Credit Card: ₹551.70
Thank you for shopping local!`,
  },
  {
    name: 'Coffee & Cafe Receipt',
    icon: 'cafe-outline',
    text: `STARBUCKS COFFEE
Terminal 2 Concourse B
Date: 2026-10-15
1x Grande Caramel Macchiato  ₹375.00
1x Blueberry Cream Muffin    ₹240.00
Subtotal: ₹615.00
CGST (2.5%): ₹15.38
SGST (2.5%): ₹15.38
Total Tax: ₹30.76
Grand Total: ₹645.76
Merchant: Starbucks Coffee Pvt Ltd`,
  },
  {
    name: 'Fuel / Petrol Station',
    icon: 'car-outline',
    text: `SHELL PETROLEUM STATION
NH-48 Highway Express
Invoice Date: 2026-10-13
Product: Shell V-Power Petrol
Quantity: 24.50 L @ ₹104.20/L
Fuel Amount: ₹2,552.90
VAT (inclusive): ₹380.00
Total Amount Payable: ₹2,552.90
Vehicle Reg: KA-01-MJ-4021
Have a safe journey!`,
  },
  {
    name: 'Pharmacy / Health Bill',
    icon: 'medkit-outline',
    text: `APOLLO PHARMACY
Healthcare & Diagnostics
Date: 2026-10-12
Paracetamol 650mg (15 tab)   Rs. 45.00
Vitamin C + Zinc Chewable    Rs. 280.00
Cough Relief Syrup 100ml     Rs. 115.00
Sub Total: Rs. 440.00
GST @ 12%: Rs. 52.80
Discount: -Rs. 40.00
Net Amount Payable: Rs. 452.80
Payment Mode: UPI Approved`,
  },
  {
    name: 'Apparel & Shopping Invoice',
    icon: 'shirt-outline',
    text: `ZARA FASHION RETAIL
City Center Mall, Level 1
Invoice No: ZR-884210
Date: 2026-10-10
Slim Fit Chino Trousers     ₹2,490.00
Cotton Linen Casual Shirt   ₹1,890.00
Subtotal: ₹4,380.00
CGST 6%: ₹262.80
SGST 6%: ₹262.80
Total Taxes: ₹525.60
Special Promotion Discount: -₹500.00
Grand Total: ₹4,405.60
Thank you for shopping at ZARA`,
  },
];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Food & Dining': ['restaurant', 'cafe', 'coffee', 'bistro', 'burger', 'pizza', 'swiggy', 'zomato', 'dining', 'bar', 'bakery', 'kitchen', 'grill', 'starbucks', 'subway', 'mcdonald'],
  'Groceries': ['supermarket', 'grocery', 'mart', 'store', 'provisions', 'reliance', 'dmart', 'spencer', 'vegetables', 'fruits', 'milk', 'dairy', 'trader joe', 'whole foods', 'walmart', 'costco'],
  'Transportation': ['fuel', 'petrol', 'diesel', 'gas', 'shell', 'hpcl', 'bpcl', 'ioc', 'uber', 'ola', 'metro', 'auto', 'rail', 'parking', 'toll', 'chevron', 'exxon'],
  'Shopping': ['clothing', 'apparel', 'retail', 'mall', 'fashion', 'zara', 'h&m', 'uniqlo', 'lifestyle', 'westside', 'amazon', 'flipkart', 'target', 'nike', 'adidas'],
  'Utilities': ['electricity', 'power', 'water', 'gas bill', 'broadband', 'wifi', 'internet', 'airtel', 'jio', 'vodafone', 'telecom', 'utility'],
  'Health & Medical': ['pharmacy', 'chemist', 'drug', 'hospital', 'clinic', 'medical', 'apollo', 'medplus', 'healthcare', 'diagnostic', 'lab', 'walgreens', 'cvs'],
  'Entertainment': ['cinema', 'movie', 'theatre', 'imax', 'pvr', 'inox', 'concert', 'game', 'bowling', 'netflix', 'spotify'],
};

const CURRENCY_PREFIX = '[\\s:₹$€£]*(?:rs\\.?|inr)?[\\s]*';
const AMOUNT_PATTERN = '([0-9]{1,3}(?:[,\\s][0-9]{3})*(?:\\.[0-9]{1,2})?|[0-9]+(?:[.,][0-9]{1,2})?)';

const SUBTOTAL_REGEX = new RegExp(`(?:sub\\s*total|item\\s*total|sub-total|items?\\s*value|base\\s*(?:amount|total)|taxable\\s*value|gross\\s*(?:amount|total))${CURRENCY_PREFIX}${AMOUNT_PATTERN}`, 'i');
const CGST_REGEX = new RegExp(`(?:cgst|central\\s*gst)(?:\\s*@?\\s*\\d+(?:\\.\\d+)?%?)?${CURRENCY_PREFIX}${AMOUNT_PATTERN}`, 'i');
const SGST_REGEX = new RegExp(`(?:sgst|state\\s*gst|utgst)(?:\\s*@?\\s*\\d+(?:\\.\\d+)?%?)?${CURRENCY_PREFIX}${AMOUNT_PATTERN}`, 'i');
const IGST_REGEX = new RegExp(`(?:igst|integrated\\s*gst)(?:\\s*@?\\s*\\d+(?:\\.\\d+)?%?)?${CURRENCY_PREFIX}${AMOUNT_PATTERN}`, 'i');
const VAT_REGEX = new RegExp(`(?:vat|value\\s*added\\s*tax)(?:\\s*@?\\s*\\d+(?:\\.\\d+)?%?)?${CURRENCY_PREFIX}${AMOUNT_PATTERN}`, 'i');
const GEN_TAX_REGEX = new RegExp(`(?:service\\s*tax|cess|total\\s*tax|tax\\s*amount|\\bgst(?:\\s*@?\\s*\\d+(?:\\.\\d+)?%?)?|taxes)${CURRENCY_PREFIX}${AMOUNT_PATTERN}`, 'i');
const DISCOUNT_REGEX = new RegExp(`(?:discount|coupon|promo|instant\\s*savings?|less)(?:\\s*\\([^)]*\\))?[\\s:₹$€£\\-]*(?:rs\\.?|inr)?[\\s]*${AMOUNT_PATTERN}`, 'i');
const CHARGES_REGEX = new RegExp(`(?:delivery(?:\\s*fee|\\s*charge)?|packing(?:\\s*charge)?|service\\s*charge|tip|gratuity|convenience\\s*fee)(?:\\s*\\([^)]*\\))?[\\s:₹$€£+]*${AMOUNT_PATTERN}`, 'i');
const GRAND_TOTAL_REGEX = new RegExp(`(?:grand\\s*total|net\\s*(?:amount\\s*)?payable|total\\s*payable|amount\\s*payable|invoice\\s*total|final\\s*(?:amount|total)|bill\\s*total|total\\s*amount|amount\\s*due|total\\s*due|total\\s*paid|paid\\s*amount)${CURRENCY_PREFIX}${AMOUNT_PATTERN}`, 'i');
const GENERIC_TOTAL_REGEX = new RegExp(`(?:^|\\s)total${CURRENCY_PREFIX}${AMOUNT_PATTERN}`, 'i');
const DATE_REGEX = /\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})\b|\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b/;

const IGNORED_HEADERS = [
  'tax invoice', 'retail invoice', 'bill', 'cash memo', 'receipt', 'welcome',
  'customer copy', 'tax invoice/bill of supply', 'original for recipient'
];

function extractNumber(line: string, regex: RegExp): number | null {
  const match = line.match(regex);
  if (!match) return null;
  const numStr = match[1].replace(/[\s,]/g, '');
  const val = Number.parseFloat(numStr);
  return !Number.isNaN(val) && val > 0 ? val : null;
}

/**
 * Intelligent client-side receipt parser extracting structured financial breakdown.
 */
export function parseReceiptText(text: string): ParsedReceipt {
  if (!text || typeof text !== 'string') {
    return {
      rawText: '',
      amount: 0,
      date: new Date().toISOString().slice(0, 10),
      merchant: 'Receipt Purchase',
      category: 'Miscellaneous',
      confidence: 0,
      breakdown: {},
    };
  }

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const breakdown: ReceiptBreakdown = {};

  for (const line of lines) {
    if (!breakdown.grandTotal) breakdown.grandTotal = extractNumber(line, GRAND_TOTAL_REGEX);
    if (!breakdown.subtotal) breakdown.subtotal = extractNumber(line, SUBTOTAL_REGEX);
    if (!breakdown.cgst) breakdown.cgst = extractNumber(line, CGST_REGEX);
    if (!breakdown.sgst) breakdown.sgst = extractNumber(line, SGST_REGEX);
    if (!breakdown.igst) breakdown.igst = extractNumber(line, IGST_REGEX);
    if (!breakdown.vat) breakdown.vat = extractNumber(line, VAT_REGEX);
    if (!breakdown.totalTax) breakdown.totalTax = extractNumber(line, GEN_TAX_REGEX);
    if (!breakdown.discount) breakdown.discount = extractNumber(line, DISCOUNT_REGEX);
    if (!breakdown.charges) breakdown.charges = extractNumber(line, CHARGES_REGEX);
  }

  // Combined itemized taxes
  const itemizedTaxes = (breakdown.cgst || 0) + (breakdown.sgst || 0) + (breakdown.igst || 0) + (breakdown.vat || 0);
  if (itemizedTaxes > 0 && !breakdown.totalTax) {
    breakdown.totalTax = Math.round(itemizedTaxes * 100) / 100;
  }

  // Reverse search for generic total
  if (!breakdown.grandTotal) {
    for (let i = lines.length - 1; i >= 0; i--) {
      const val = extractNumber(lines[i], GENERIC_TOTAL_REGEX);
      if (val) {
        breakdown.grandTotal = val;
        break;
      }
    }
  }

  // Mathematical reconciliation
  if (!breakdown.grandTotal && breakdown.subtotal && breakdown.totalTax) {
    const calc = breakdown.subtotal + breakdown.totalTax + (breakdown.charges || 0) - (breakdown.discount || 0);
    breakdown.grandTotal = Math.round(calc * 100) / 100;
  }

  // Final amount assignment
  let amount = breakdown.grandTotal || breakdown.subtotal || 0;
  if (!amount) {
    const currencyMatches = text.match(/(?:[₹$€£]|\brs\.?|\binr)\s*([0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/gi);
    if (currencyMatches && currencyMatches.length > 0) {
      const nums = currencyMatches
        .map(s => Number.parseFloat(s.replace(/[^0-9.]/g, '')))
        .filter(n => !Number.isNaN(n));
      if (nums.length > 0) {
        amount = Math.max(...nums);
        breakdown.grandTotal = amount;
      }
    }
  }

  // Date extraction
  let parsedDate = new Date().toISOString().slice(0, 10);
  for (const line of lines) {
    const match = line.match(DATE_REGEX);
    if (match) {
      const rawDate = match[0];
      const parts = rawDate.split(/[-/]/);
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        parsedDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        break;
      } else if (parts[2].length === 4 || parts[2].length === 2) {
        const yr = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
        parsedDate = `${yr}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        break;
      }
    }
  }

  // Merchant detection
  let merchant = 'Receipt Purchase';
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const candidate = lines[i];
    const lower = candidate.toLowerCase();
    if (!IGNORED_HEADERS.some(h => lower.includes(h)) && candidate.length >= 3 && !/^\d+$/.test(candidate)) {
      merchant = candidate.replace(/[^A-Za-z0-9\s&'-]/g, '').trim();
      if (merchant) break;
    }
  }

  // Category prediction
  let category = 'Miscellaneous';
  const lowerAll = text.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lowerAll.includes(kw))) {
      category = cat;
      break;
    }
  }

  const confidence = amount > 0 && merchant !== 'Receipt Purchase' ? 92 : 75;

  return {
    rawText: text,
    amount,
    date: parsedDate,
    merchant,
    category,
    confidence,
    breakdown,
  };
}

/** Phone photos are 3-8 MB; the receipt text is readable at this width and the upload is ~10x smaller. */
export const OCR_MAX_IMAGE_WIDTH = 1600;
/** The server may run tesseract up to three times (15 s each) on a cold, shared CPU. */
export const OCR_TIMEOUT_MS = 60_000;

function imageWidth(uri: string): Promise<number | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 3000);
    try {
      Image.getSize(
        uri,
        (width) => {
          clearTimeout(timer);
          resolve(width);
        },
        () => {
          clearTimeout(timer);
          resolve(null);
        }
      );
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

/**
 * Shrinks and re-encodes a photo as JPEG before upload. Re-encoding also applies the camera's EXIF
 * rotation, which the server's image reader ignores (a sideways receipt reads as gibberish).
 * Falls back to the original file if the image cannot be processed.
 */
async function prepareImageForUpload(
  uri: string,
  name: string,
  mimeType: string
): Promise<{ uri: string; name: string; type: string }> {
  if (!mimeType.toLowerCase().startsWith('image/')) return { uri, name, type: mimeType };
  try {
    const width = await imageWidth(uri);
    const actions = width && width > OCR_MAX_IMAGE_WIDTH ? [{ resize: { width: OCR_MAX_IMAGE_WIDTH } }] : [];
    const out = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: 0.8,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    const base = name.replace(/\.[A-Za-z0-9]{2,5}$/, '') || 'receipt';
    return { uri: out.uri, name: `${base}.jpg`, type: 'image/jpeg' };
  } catch (err) {
    console.warn('[ReceiptOCR] Could not shrink the image, uploading the original:', err);
    return { uri, name, type: mimeType };
  }
}

/**
 * Scans a receipt image through the backend OCR (/api/expenses/ocr).
 *
 * Failures are reported, never disguised: an earlier version returned a built-in sample receipt when
 * the call failed, so a failed scan looked like a scan of somebody else's receipt.
 * @throws Error with a message that says what went wrong and what to do about it.
 */
export async function scanReceiptWithOcr(
  fileUri: string,
  fileName: string = 'receipt.png',
  mimeType: string = 'image/png'
): Promise<ParsedReceipt> {
  const token = await safeStorageGet('auth_token');
  const file = await prepareImageForUpload(fileUri, fileName, mimeType);

  const formData = new FormData();
  formData.append('file', { uri: file.uri, name: file.name, type: file.type } as any);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/expenses/ocr`, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('The scan took too long and was stopped. Check your connection and try again.');
    }
    throw new Error("Couldn't reach the server to scan the receipt. Check your connection and try again.");
  } finally {
    clearTimeout(timeout);
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error('Your session has expired. Sign in again to scan receipts.');
  }
  if (res.status === 413) {
    throw new Error('That file is too large for the server. Try a smaller photo.');
  }
  if (!res.ok) {
    throw new Error(`The server could not scan this receipt (error ${res.status}). Try again in a moment.`);
  }

  const data = await res.json().catch(() => null);
  if (!data || !data.success) {
    throw new Error(
      (data && data.message) || 'No readable text was found on this receipt. Try a clearer, well-lit photo.'
    );
  }

  return {
    rawText: data.rawText || '',
    amount: typeof data.amount === 'number' ? data.amount : 0,
    date: data.date || new Date().toISOString().slice(0, 10),
    merchant: data.merchant || 'Receipt Purchase',
    category: data.category || 'Miscellaneous',
    confidence: data.confidence || 88,
    breakdown: data.breakdown || {},
  };
}
