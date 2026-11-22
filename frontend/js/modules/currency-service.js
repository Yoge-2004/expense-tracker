/**
 * Currency Service (Single Responsibility Principle)
 * Manages currency catalog, geo/locale detection, and formatted currency outputs.
 */
(function(global) {
    "use strict";

    const WORLD_CURRENCIES = [
        { code: 'INR', symbol: '₹', name: 'Indian Rupee', flag: '🇮🇳', locale: 'en-IN' },
        { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸', locale: 'en-US' },
        { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺', locale: 'de-DE' },
        { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧', locale: 'en-GB' },
        { code: 'JPY', symbol: '¥', name: 'Japanese Yen', flag: '🇯🇵', locale: 'ja-JP' },
        { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', flag: '🇨🇦', locale: 'en-CA' },
        { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', flag: '🇦🇺', locale: 'en-AU' },
        { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', flag: '🇸🇬', locale: 'en-SG' },
        { code: 'AED', symbol: 'AED', name: 'UAE Dirham', flag: '🇦🇪', locale: 'ar-AE' },
        { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', flag: '🇨🇭', locale: 'de-CH' },
        { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', flag: '🇨🇳', locale: 'zh-CN' },
        { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', flag: '🇳🇿', locale: 'en-NZ' },
        { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', flag: '🇧🇷', locale: 'pt-BR' },
        { code: 'KRW', symbol: '₩', name: 'South Korean Won', flag: '🇰🇷', locale: 'ko-KR' },
        { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', flag: '🇸🇪', locale: 'sv-SE' },
        { code: 'ZAR', symbol: 'R', name: 'South African Rand', flag: '🇿🇦', locale: 'en-ZA' }
    ];

    function detectLikelyCurrencyCode() {
        try {
            const timeZone = (Intl.DateTimeFormat && Intl.DateTimeFormat().resolvedOptions().timeZone) || '';
            if (timeZone) {
                if (timeZone.startsWith('Asia/Kolkata') || timeZone.startsWith('Asia/Calcutta')) return 'INR';
                if (timeZone.startsWith('Europe/London')) return 'GBP';
                if (timeZone.startsWith('Asia/Tokyo')) return 'JPY';
                if (timeZone.startsWith('Asia/Singapore')) return 'SGD';
                if (timeZone.startsWith('Asia/Dubai')) return 'AED';
                if (timeZone.startsWith('Australia/')) return 'AUD';
                if (timeZone.startsWith('America/Toronto') || timeZone.startsWith('America/Vancouver')) return 'CAD';
                if (timeZone.startsWith('America/')) return 'USD';
                if (timeZone.startsWith('Europe/')) return 'EUR';
            }
            const browserLocale = (navigator.languages && navigator.languages[0]) || navigator.language || '';
            const region = browserLocale.split(/[-_]/)[1]?.toUpperCase();
            if (region) {
                const match = WORLD_CURRENCIES.find(c => c.locale && c.locale.split('-')[1]?.toUpperCase() === region);
                if (match) return match.code;
            }
            return null;
        } catch { return null; }
    }

    async function detectClientLocationCurrency() {
        const fastCode = detectLikelyCurrencyCode();
        if (fastCode) return fastCode;
        try {
            const res = await fetch('https://ipapi.co/currency/', { signal: AbortSignal.timeout(2000) });
            if (res.ok) {
                const code = (await res.text()).trim().toUpperCase();
                if (code && WORLD_CURRENCIES.some(c => c.code === code)) return code;
            }
        } catch (e) {
            console.debug("[CurrencyService] IP location fallback:", e.message);
        }
        return null;
    }

    function getSelectedCurrency() {
        return localStorage.getItem("userCurrency") || "INR";
    }

    function getCurrencyInfo(code) {
        const c = code || getSelectedCurrency();
        return WORLD_CURRENCIES.find(item => item.code === c) || WORLD_CURRENCIES[0];
    }

    function getCurrencySymbol() {
        return getCurrencyInfo().symbol;
    }

    function formatGlobalCurrency(amt) {
        const info = getCurrencyInfo();
        try {
            const str = new Intl.NumberFormat(info.locale, {
                style: 'currency',
                currency: info.code,
                maximumFractionDigits: 2
            }).format(amt || 0);
            return str.replace(/([^\w\s])\s+([\d,.-]+)/, '$1$2');
        } catch {
            const isAlpha = /^[A-Z]{3}$/.test(info.symbol);
            const value = new Intl.NumberFormat(info.locale, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(Number(amt || 0));
            return isAlpha ? `${info.symbol} ${value}` : `${info.symbol}${value}`;
        }
    }

    function formatGlobalCompactCurrency(amt) {
        const info = getCurrencyInfo();
        try {
            const str = new Intl.NumberFormat(info.locale, {
                style: 'currency',
                currency: info.code,
                notation: 'compact',
                maximumFractionDigits: 1
            }).format(amt || 0);
            return str.replace(/([^\w\s])\s+([\d,.-]+)/, '$1$2');
        } catch {
            const isAlpha = /^[A-Z]{3}$/.test(info.symbol);
            const value = new Intl.NumberFormat(info.locale, { maximumFractionDigits: 0 })
                .format(Number(amt || 0));
            return isAlpha ? `${info.symbol} ${value}` : `${info.symbol}${value}`;
        }
    }

    const CurrencyService = {
        WORLD_CURRENCIES,
        detectLikelyCurrencyCode,
        detectClientLocationCurrency,
        getSelectedCurrency,
        getCurrencyInfo,
        getCurrencySymbol,
        formatGlobalCurrency,
        formatGlobalCompactCurrency
    };

    // Export both on service object and backward-compatible globals
    global.CurrencyService = CurrencyService;
    global.WORLD_CURRENCIES = WORLD_CURRENCIES;
    global.detectLikelyCurrencyCode = detectLikelyCurrencyCode;
    global.detectClientLocationCurrency = detectClientLocationCurrency;
    global.getSelectedCurrency = getSelectedCurrency;
    global.getCurrencyInfo = getCurrencyInfo;
    global.getCurrencySymbol = getCurrencySymbol;
    global.formatGlobalCurrency = formatGlobalCurrency;
    global.formatGlobalCompactCurrency = formatGlobalCompactCurrency;

})(typeof window !== "undefined" ? window : globalThis);
