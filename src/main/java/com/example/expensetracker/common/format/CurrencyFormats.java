package com.example.expensetracker.common.format;

import java.util.Currency;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Shared currency metadata and formatting rules for report renderers.
 */
public final class CurrencyFormats {

    private static final Map<String, Metadata> CURRENCIES = new HashMap<>();

    static {
        register("USD", "$", true);
        register("EUR", "€", true);
        register("GBP", "£", true);
        register("INR", "₹", true);
        register("JPY", "¥", false);
        register("CAD", "C$", true);
        register("AUD", "A$", true);
        register("CHF", "Fr", true);
        register("CNY", "¥", true);
        register("BRL", "R$", true);
        register("AED", "AED", true);
        register("SGD", "S$", true);
        register("KRW", "₩", false);
        register("RUB", "₽", true);
        register("MXN", "$", true);
        register("ZAR", "R", true);
        register("NZD", "NZ$", true);
        register("SEK", "kr", true);
        register("NOK", "kr", true);
        register("DKK", "kr", true);
        register("PLN", "zł", true);
        register("THB", "฿", true);
        register("IDR", "Rp", false);
        register("MYR", "RM", true);
        register("PHP", "₱", true);
        register("VND", "₫", false);
        register("HKD", "HK$", true);
        register("TWD", "NT$", true);
        register("SAR", "SR", true);
        register("QAR", "QR", true);
        register("KWD", "KD", true);
        register("BHD", "BD", true);
        register("OMR", "OMR", true);
        register("EGP", "E£", true);
        register("TRY", "₺", true);
        register("ILS", "₪", true);
        register("CLP", "$", false);
        register("COP", "$", true);
        register("ARS", "$", true);
        register("PEN", "S/", true);
        register("PKR", "Rs", true);
        register("BDT", "৳", true);
        register("LKR", "Rs", true);
        register("NPR", "Rs", true);
        register("NGN", "₦", true);
        register("KES", "KSh", true);
        register("GHS", "GH₵", true);
        register("CZK", "Kč", true, true);
        register("HUF", "Ft", false, true);
        register("RON", "lei", true, true);
        register("UAH", "₴", true);
        register("BGN", "лв", true, true);
        register("ISK", "kr", true, true);
        register("RSD", "дин", true, true);
        register("HRK", "kn", true, true);
        register("BAM", "KM", true, true);
        register("ALL", "L", true, true);
        register("MKD", "ден", true, true);
    }

    private CurrencyFormats() {
    }

    /**
     * Resolves currency formatting metadata for {@code preferredCurrency}, falling back to
     * {@code fallbackCurrency} or {@code INR} if neither is set.
     *
     * @param preferredCurrency explicit currency override
     * @param fallbackCurrency  profile/default currency code
     * @return resolved formatting metadata
     */
    public static Metadata resolve(String preferredCurrency, String fallbackCurrency) {
        String code = preferredCurrency;
        if (code == null || code.isBlank()) {
            code = fallbackCurrency;
        }
        code = code == null || code.isBlank() ? "INR" : code.strip().toUpperCase(Locale.ROOT);

        Metadata configured = CURRENCIES.get(code);
        if (configured != null) {
            return configured;
        }
        try {
            Currency currency = Currency.getInstance(code);
            return new Metadata(code, currency.getSymbol(Locale.US), currency.getDefaultFractionDigits() > 0);
        } catch (IllegalArgumentException _) {
            return new Metadata(code, code, true);
        }
    }

    /**
     * Resolves currency formatting metadata for {@code currencyCode}, defaulting to {@code INR}.
     *
     * @param currencyCode ISO 4217 currency code
     * @return resolved formatting metadata
     */
    public static Metadata resolve(String currencyCode) {
        return resolve(currencyCode, null);
    }

    /**
     * Returns an ASCII/WinAnsi-safe currency label for OpenPDF tables.
     *
     * @param currency resolved currency metadata
     * @return PDF-renderable currency prefix
     */
    public static String pdfSymbol(Metadata currency) {
        if (currency == null) {
            return "Rs.";
        }
        if ("INR".equalsIgnoreCase(currency.code())) {
            return "Rs.";
        }
        String symbol = currency.symbol();
        if ("$".equals(symbol) || "€".equals(symbol) || "£".equals(symbol) || "¥".equals(symbol)) {
            return symbol;
        }
        return currency.code() != null ? currency.code() : "Rs.";
    }

    private static void register(String code, String symbol, boolean decimals) {
        register(code, symbol, decimals, false);
    }

    private static void register(String code, String symbol, boolean decimals, boolean symbolAfter) {
        CURRENCIES.put(code, new Metadata(code, symbol, decimals, symbolAfter));
    }

    /**
     * Currency code, display symbol, decimal precision, and Excel format configuration.
     */
    public record Metadata(String code, String symbol, boolean decimals, boolean symbolAfter) {
        public Metadata(String code, String symbol, boolean decimals) {
            this(code, symbol, decimals, false);
        }

        public String excelFormat() {
            if (!decimals) {
                return symbolAfter
                        ? "#,##0 \"" + symbol + "\";(#,##0 \"" + symbol + "\");\"-\""
                        : "\"" + symbol + " \"#,##0;(\"" + symbol + " \"#,##0);\"-\"";
            }
            return symbolAfter
                    ? "#,##0.00 \"" + symbol + "\";(#,##0.00 \"" + symbol + "\");\"-\""
                    : "\"" + symbol + " \"#,##0.00;(\"" + symbol + " \"#,##0.00);\"-\"";
        }
    }
}
