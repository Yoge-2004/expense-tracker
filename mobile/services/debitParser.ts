/**
 * @file debitParser.ts
 * @description Robust parsing and normalization engine for financial debit/credit messages
 * (SMS, push notifications, bank alerts).
 * 
 * Supports standard formats from Indian (UPI, NEFT, IMPS, Cards) and global banking institutions:
 * - HDFC, SBI, ICICI, Axis, Kotak, PayTM, PhonePe, GooglePay, Citi, Chase, Amex, Standard Chartered.
 * - Extracts amount, currency, direction (DEBIT/CREDIT), merchant/beneficiary, account ref, and date.
 */

export interface ParsedTransaction {
  rawText: string;
  isFinancial: boolean;
  direction: "DEBIT" | "CREDIT" | "UNKNOWN";
  amount: number | null;
  currency: string;
  merchant: string | null;
  accountTail: string | null;
  referenceNumber: string | null;
  timestamp: number;
}

// Regex patterns for debit and credit keywords
const DEBIT_REGEX = /\b(debited|spent|paid|withdrawn|charged|purchase|txn of|sent|deducted|dr)\b/i;
const CREDIT_REGEX = /\b(credited|received|refunded|deposited|reversal|cashback|cr)\b/i;

// Regex patterns for currency and amounts (e.g. INR 500, Rs. 1,200.50, ₹450, $15.99)
// Global flag: a message can contain more than one currency-tagged number
// (the transaction amount AND the account balance), so every occurrence
// needs to be considered rather than just the first.
const AMOUNT_REGEX = /(?:(?:Rs\.?|INR|₹|\$|EUR|€|GBP|£)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:Rs\.?|INR|₹|\$|EUR|€|GBP|£))/gi;

// Secondary fallback amount matcher if currency symbol is separate
const FALLBACK_AMOUNT_REGEX = /\b(?:amount|amt|for|of)\s*(?:is|:)?\s*(?:Rs\.?|INR|₹|\$)?\s*([\d,]+(?:\.\d{1,2})?)\b/i;

// Last-resort anchor: a bare number (no currency token attached) near the
// debit/credit keyword — for messages that state the amount before any
// currency word appears at all (e.g. "500 debited from your account...").
const BARE_NUMBER_REGEX = /\b\d[\d,]*(?:\.\d{1,2})?\b/g;

// A number preceded by these words is an account balance, not the
// transaction amount, and should be skipped.
const BALANCE_CONTEXT_REGEX = /\b(avl|avbl|available|bal|balance)\b/i;

// A bare number preceded by these words is an account/card/reference digit
// or a date component, not an amount.
const NUMBER_EXCLUSION_CONTEXT_REGEX =
  /\b(ending|a\/c|acct|account|card|no\.|ref|utr|rrn|txn|id|reference|on|dated|xx)\s*$/i;

// Regex for merchant/vendor identification
const MERCHANT_PATTERNS = [
  /(?:at|to|vpa|towards|for)\s+([A-Za-z0-9\s&\x27.-]{2,30}?)(?:\s+(?:on|using|via|ref|bal|avbl|avl|dated|through|card|ac|ending|\.|\,)|$)/i,
  /(?:paid to|transferred to)\s+([A-Za-z0-9\s&\x27.-]{2,30}?)(?:\s+(?:on|via|ref|bal|\.|\,)|$)/i,
  /(?:vpa\s+)([a-zA-Z0-9.\-_]+@[a-zA-Z0-9]+)/i,
];

// Regex for account / card last 3 or 4 digits
const ACCOUNT_PATTERNS = [
  /(?:ending(?:\s+with|\s+in)?|ending)\s*(?:xx*|[*]+)?([0-9]{3,4})\b/i,
  /(?:a\/c|acct|account|card|no\.)\s*(?:xx*|[*]+|ending(?:\s+with|\s+in)?\s*)?([0-9]{3,4})\b/i,
  /\b(?:xx*|[*]+)([0-9]{3,4})\b/i
];

// Regex for transaction reference or UTR
const REF_REGEX = /(?:ref|utr|rrn|txn|id|reference)\s*(?:no\.?|id|:)?\s*([A-Za-z0-9]{6,22})/i;

/**
 * Parses financial notification or SMS text into a structured transaction event.
 */
export function parseFinancialMessage(text: string): ParsedTransaction {
  const result: ParsedTransaction = {
    rawText: text,
    isFinancial: false,
    direction: "UNKNOWN",
    amount: null,
    currency: "INR",
    merchant: null,
    accountTail: null,
    referenceNumber: null,
    timestamp: Date.now()
  };

  if (!text || typeof text !== "string") {
    return result;
  }

  const cleanText = text.trim();

  // 1. Determine direction
  const isDebit = DEBIT_REGEX.test(cleanText);
  const isCredit = CREDIT_REGEX.test(cleanText);

  if (isDebit && !isCredit) {
    result.direction = "DEBIT";
  } else if (isCredit && !isDebit) {
    result.direction = "CREDIT";
  } else if (isDebit && isCredit) {
    const debitIdx = cleanText.search(DEBIT_REGEX);
    const creditIdx = cleanText.search(CREDIT_REGEX);
    result.direction = debitIdx < creditIdx ? "DEBIT" : "CREDIT";
  }

  // 2. Extract Amount and Currency
  // A message often contains more than one currency-tagged number (the
  // transaction amount AND the running account balance). Prefer whichever
  // currency-tagged number is closest to the debit/credit keyword and isn't
  // immediately preceded by a balance-context word ("Avl Bal", "Balance").
  const keywordIndex =
    result.direction === "DEBIT" ? cleanText.search(DEBIT_REGEX)
    : result.direction === "CREDIT" ? cleanText.search(CREDIT_REGEX)
    : -1;

  const isBalanceContext = (idx: number) =>
    BALANCE_CONTEXT_REGEX.test(cleanText.slice(Math.max(0, idx - 20), idx));

  const taggedMatches = [...cleanText.matchAll(AMOUNT_REGEX)];
  let chosen: RegExpMatchArray | null = null;

  if (keywordIndex >= 0) {
    const nonBalanceMatches = taggedMatches.filter((m) => !isBalanceContext(m.index ?? 0));
    if (nonBalanceMatches.length > 0) {
      nonBalanceMatches.sort(
        (a, b) => Math.abs((a.index ?? 0) - keywordIndex) - Math.abs((b.index ?? 0) - keywordIndex)
      );
      chosen = nonBalanceMatches[0];
    }
  } else if (taggedMatches.length > 0) {
    chosen = taggedMatches[0];
  }

  if (chosen) {
    const rawAmt = chosen[1] || chosen[2];
    if (rawAmt) {
      const parsedVal = parseFloat(rawAmt.replace(/,/g, ""));
      if (!isNaN(parsedVal) && parsedVal > 0) {
        result.amount = parsedVal;
      }
    }
  } else if (keywordIndex >= 0) {
    // No currency-tagged number survived — the amount may be stated before
    // any currency word appears (e.g. "500 debited..."). Fall back to the
    // bare number nearest the debit/credit keyword, skipping account/card/
    // reference/date digits and balance figures.
    const bareCandidates = [...cleanText.matchAll(BARE_NUMBER_REGEX)].filter((m) => {
      const idx = m.index ?? 0;
      const before = cleanText.slice(Math.max(0, idx - 15), idx);
      return !NUMBER_EXCLUSION_CONTEXT_REGEX.test(before) && !isBalanceContext(idx);
    });
    if (bareCandidates.length > 0) {
      bareCandidates.sort(
        (a, b) => Math.abs((a.index ?? 0) - keywordIndex) - Math.abs((b.index ?? 0) - keywordIndex)
      );
      const parsedVal = parseFloat(bareCandidates[0][0].replace(/,/g, ""));
      if (!isNaN(parsedVal) && parsedVal > 0) {
        result.amount = parsedVal;
      }
    }
  }

  if (result.amount === null) {
    const fallbackMatch = cleanText.match(FALLBACK_AMOUNT_REGEX);
    if (fallbackMatch && fallbackMatch[1]) {
      const parsedVal = parseFloat(fallbackMatch[1].replace(/,/g, ""));
      if (!isNaN(parsedVal) && parsedVal > 0) {
        result.amount = parsedVal;
      }
    }
  }

  // Detect currency if explicitly specified
  if (/(\$|USD)/i.test(cleanText)) {
    result.currency = "USD";
  } else if (/(€|EUR)/i.test(cleanText)) {
    result.currency = "EUR";
  } else if (/(£|GBP)/i.test(cleanText)) {
    result.currency = "GBP";
  } else {
    result.currency = "INR";
  }

  // 3. Extract Merchant
  for (const pattern of MERCHANT_PATTERNS) {
    const m = cleanText.match(pattern);
    if (m && m[1]) {
      let candidate = m[1].trim();
      candidate = candidate.replace(/^(the|a|an)\s+/i, "");
      if (candidate.length > 1 && !/^(your|my|account|bank|branch)$/i.test(candidate)) {
        result.merchant = candidate;
        break;
      }
    }
  }

  // 4. Extract Account Tail
  for (const pattern of ACCOUNT_PATTERNS) {
    const accMatch = cleanText.match(pattern);
    if (accMatch && accMatch[1]) {
      result.accountTail = accMatch[1];
      break;
    }
  }

  // 5. Extract Reference / UTR
  const refMatch = cleanText.match(REF_REGEX);
  if (refMatch && refMatch[1]) {
    result.referenceNumber = refMatch[1];
  }

  if (result.amount !== null && (result.direction === "DEBIT" || result.direction === "CREDIT")) {
    result.isFinancial = true;
  }

  return result;
}
