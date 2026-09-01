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
    const numericValue = typeof amount === 'number' ? amount : parseFloat(String(amount || 0));
    const safeNum = isNaN(numericValue) ? 0 : numericValue;
    const symbol = getCurrencySymbol(currencyCode);
    const formattedNum = safeNum.toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return `${symbol}${formattedNum}`;
  } catch (error) {
    console.warn('[Currency] Error formatting currency amount:', error);
    return `₹${amount || 0}`;
  }
}
