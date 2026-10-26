import AsyncStorage from '@react-native-async-storage/async-storage';
/**
 * @file currency.ts
 * @description International currency definitions and formatting utilities.
 * Supports standard ISO-4217 currencies worldwide with symbol mapping, flags, and localized formatting.
 */

export interface CurrencyItem {
  code: string;
  symbol: string;
  name: string;
  flag: string;
}

/**
 * Comprehensive registry of supported global currencies (65+ currencies).
 */
export const WORLD_CURRENCIES: CurrencyItem[] = [
  // Major Global Currencies
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', flag: '🇮🇳' },
  { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
  { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', flag: '🇯🇵' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', flag: '🇦🇺' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', flag: '🇨🇦' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', flag: '🇨🇭' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', flag: '🇨🇳' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', flag: '🇭🇰' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', flag: '🇳🇿' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', flag: '🇸🇬' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won', flag: '🇰🇷' },

  // Middle East & North Africa (MENA)
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham', flag: '🇦🇪' },
  { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal', flag: '🇸🇦' },
  { code: 'QAR', symbol: 'QR', name: 'Qatari Riyal', flag: '🇶🇦' },
  { code: 'KWD', symbol: 'KD', name: 'Kuwaiti Dinar', flag: '🇰🇼' },
  { code: 'BHD', symbol: 'BD', name: 'Bahraini Dinar', flag: '🇧🇭' },
  { code: 'OMR', symbol: 'OMR', name: 'Omani Rial', flag: '🇴🇲' },
  { code: 'JOD', symbol: 'JD', name: 'Jordanian Dinar', flag: '🇯🇴' },
  { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound', flag: '🇪🇬' },
  { code: 'MAD', symbol: 'MAD', name: 'Moroccan Dirham', flag: '🇲🇦' },
  { code: 'ILS', symbol: '₪', name: 'Israeli Shekel', flag: '🇮🇱' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira', flag: '🇹🇷' },

  // South & South-East Asia
  { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee', flag: '🇵🇰' },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', flag: '🇧🇩' },
  { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan Rupee', flag: '🇱🇰' },
  { code: 'NPR', symbol: 'Rs', name: 'Nepalese Rupee', flag: '🇳🇵' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', flag: '🇲🇾' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht', flag: '🇹🇭' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', flag: '🇮🇩' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso', flag: '🇵🇭' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong', flag: '🇻🇳' },

  // Europe & Scandinavia
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', flag: '🇸🇪' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', flag: '🇳🇴' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone', flag: '🇩🇰' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Zloty', flag: '🇵🇱' },
  { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna', flag: '🇨🇿' },
  { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint', flag: '🇭🇺' },
  { code: 'RON', symbol: 'lei', name: 'Romanian Leu', flag: '🇷🇴' },
  { code: 'BGN', symbol: 'лв', name: 'Bulgarian Lev', flag: '🇧🇬' },
  { code: 'HRK', symbol: 'kn', name: 'Croatian Kuna', flag: '🇭🇷' },
  { code: 'ISK', symbol: 'kr', name: 'Icelandic Krona', flag: '🇮🇸' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble', flag: '🇷🇺' },
  { code: 'UAH', symbol: '₴', name: 'Ukrainian Hryvnia', flag: '🇺🇦' },

  // Americas (North, Central, South)
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', flag: '🇧🇷' },
  { code: 'MXN', symbol: 'Mex$', name: 'Mexican Peso', flag: '🇲🇽' },
  { code: 'ARS', symbol: 'AR$', name: 'Argentine Peso', flag: '🇦🇷' },
  { code: 'CLP', symbol: 'CLP$', name: 'Chilean Peso', flag: '🇨🇱' },
  { code: 'COP', symbol: 'COL$', name: 'Colombian Peso', flag: '🇨🇴' },
  { code: 'PEN', symbol: 'S/.', name: 'Peruvian Sol', flag: '🇵🇪' },
  { code: 'UYU', symbol: '$U', name: 'Uruguayan Peso', flag: '🇺🇾' },
  { code: 'CRC', symbol: '₡', name: 'Costa Rican Colón', flag: '🇨🇷' },
  { code: 'DOP', symbol: 'RD$', name: 'Dominican Peso', flag: '🇩🇴' },
  { code: 'GTQ', symbol: 'Q', name: 'Guatemalan Quetzal', flag: '🇬🇹' },
  { code: 'PAB', symbol: 'B/.', name: 'Panamanian Balboa', flag: '🇵🇦' },

  // Africa
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', flag: '🇿🇦' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', flag: '🇳🇬' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', flag: '🇰🇪' },
  { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi', flag: '🇬🇭' },
  { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling', flag: '🇹🇿' },
  { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling', flag: '🇺🇬' },
  { code: 'ETB', symbol: 'Br', name: 'Ethiopian Birr', flag: '🇪🇹' },
  { code: 'MUR', symbol: 'Rs', name: 'Mauritian Rupee', flag: '🇲🇺' },

  // Central & East Asia
  { code: 'TWD', symbol: 'NT$', name: 'New Taiwan Dollar', flag: '🇹🇼' },
  { code: 'KZT', symbol: '₸', name: 'Kazakhstani Tenge', flag: '🇰🇿' },
  { code: 'UZS', symbol: 'soʻm', name: 'Uzbekistani Som', flag: '🇺🇿' },
];

/**
 * Resolves the currency symbol corresponding to an ISO 4217 code.
 *
 * @param code - 3-letter currency code (e.g., "USD", "INR").
 * @returns Formatted currency symbol or uppercase code fallback.
 */
export function getCurrencySymbol(code?: string | null): string {
  if (!code || typeof code !== 'string') return '₹';
  const cleanCode = code.trim().toUpperCase();
  const match = WORLD_CURRENCIES.find((c) => c.code === cleanCode);
  return match ? match.symbol : cleanCode;
}

/**
 * Formats a numeric monetary amount with localized grouping and currency symbol.
 *
 * @param amount - The numeric expense value.
 * @param currencyCode - Optional currency code (defaults to INR).
 * @param decimals - Maximum decimal places to display (default 0 for whole units).
 * @returns Formatted string (e.g. "₹24,800").
 */
export function formatCurrencyAmount(
  amount: number | string | null | undefined,
  currencyCode = 'INR',
  decimals = 0
): string {
  try {
    const numericValue = typeof amount === 'number' ? amount : Number.parseFloat(String(amount || 0));
    const safeNum = Number.isNaN(numericValue) ? 0 : numericValue;
    const symbol = getCurrencySymbol(currencyCode);
    const locale = currencyCode && currencyCode.trim().toUpperCase() === 'INR' ? 'en-IN' : 'en-US';
    const formattedNum = safeNum.toLocaleString(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return `${symbol}${formattedNum}`;
  } catch (error) {
    console.warn('[Currency] Error formatting currency amount:', error);
    return `₹${amount || 0}`;
  }
}

const RATES_CACHE_PREFIX = '@expense_tracker_fx_rates_';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export const FALLBACK_TO_INR: Record<string, number> = {
  INR: 1,
  USD: 83.5,
  EUR: 90.8,
  GBP: 106.2,
  AED: 22.7,
  SAR: 22.25,
  QAR: 22.9,
  KWD: 271.5,
  BHD: 221.4,
  OMR: 216.8,
  JPY: 0.55,
  CAD: 61.2,
  AUD: 55.4,
  SGD: 62.1,
  CHF: 94.2,
  CNY: 11.5,
  NZD: 50.8,
  BRL: 16.5,
  ZAR: 4.5,
  THB: 2.3,
  MYR: 17.8,
  IDR: 0.0053,
  KRW: 0.062,
  TRY: 2.6,
  RUB: 0.91,
};

/**
 * Retrieves daily exchange rate for converting fromCurrency into toCurrency (default INR).
 * Automatically caches daily rates locally for 24 hours with offline fallbacks.
 */
export async function getExchangeRate(fromCurrency: string, toCurrency = 'INR'): Promise<number> {
  const from = (fromCurrency || 'USD').trim().toUpperCase();
  const to = (toCurrency || 'INR').trim().toUpperCase();
  if (from === to) return 1;

  // 1. Check local storage cache
  try {
    const cacheKey = RATES_CACHE_PREFIX + from;
    const raw = await AsyncStorage.getItem(cacheKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.timestamp < CACHE_TTL_MS && parsed.rates && parsed.rates[to]) {
        return Number(parsed.rates[to]);
      }
    }
  } catch (_) {}

  // 2. Network fetch from open central-bank rate endpoint (open.er-api.com)
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/' + from);
    if (res.ok) {
      const data = await res.json();
      if (data && data.rates && data.rates[to]) {
        const rate = Number(data.rates[to]);
        try {
          const cacheKey = RATES_CACHE_PREFIX + from;
          await AsyncStorage.setItem(
            cacheKey,
            JSON.stringify({ timestamp: Date.now(), rates: data.rates })
          );
        } catch (_) {}
        return rate;
      }
    }
  } catch (err) {
    console.warn('[Currency] Live rates fetch error, fallback to static:', err);
  }

  // 3. Fallback matrix: cross rate using INR base
  const fromInr = FALLBACK_TO_INR[from] || (from === 'INR' ? 1 : null);
  const toInr = FALLBACK_TO_INR[to] || (to === 'INR' ? 1 : null);
  if (fromInr && toInr) {
    return fromInr / toInr;
  }
  return 1;
}
