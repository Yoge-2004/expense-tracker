// Authentication-page presentation helpers.
// Keeps the login page markup declarative while reusing the shared currency
// helpers from api.js for locale-aware formatting.

(() => {
    "use strict";

    const SAVINGS_TABLE = Object.freeze({
        INR: { amount: 24810, word: "rupee" },
        USD: { amount: 2480, word: "dollar" },
        EUR: { amount: 2350, word: "euro" },
        GBP: { amount: 1980, word: "pound" },
        JPY: { amount: 320000, word: "yen" },
        CAD: { amount: 3100, word: "dollar" },
        AUD: { amount: 3400, word: "dollar" },
        CHF: { amount: 2200, word: "franc" },
        AED: { amount: 8800, word: "dirham" },
        SGD: { amount: 3150, word: "dollar" },
        CNY: { amount: 16800, word: "yuan" },
        BRL: { amount: 12400, word: "real" },
        KRW: { amount: 3100000, word: "won" },
        MXN: { amount: 42000, word: "peso" },
        SEK: { amount: 24500, word: "krona" },
        NOK: { amount: 25200, word: "krone" },
        DKK: { amount: 16400, word: "krone" },
        PLN: { amount: 9600, word: "złoty" },
        ZAR: { amount: 42000, word: "rand" },
        RUB: { amount: 215000, word: "ruble" },
        IDR: { amount: 36000000, word: "rupiah" },
        VND: { amount: 58000000, word: "dong" },
        THB: { amount: 84000, word: "baht" },
        PHP: { amount: 135000, word: "peso" },
        MYR: { amount: 10800, word: "ringgit" },
        NZD: { amount: 3800, word: "dollar" },
        SAR: { amount: 9200, word: "riyal" },
        TRY: { amount: 78000, word: "lira" },
        PKR: { amount: 680000, word: "rupee" },
        BDT: { amount: 285000, word: "taka" },
        NGN: { amount: 3400000, word: "naira" }
    });

    function applyHeroCurrency(code) {
        if (!code) return;

        const amountElement = document.getElementById("heroSavedAmount");
        const wordElement = document.getElementById("heroCurrencyWord");
        if (!amountElement) return;

        const currencyCode = String(code).toUpperCase();
        const info = (typeof getCurrencyInfo === "function" && getCurrencyInfo(currencyCode)) || {
            code: currencyCode,
            locale: "en-US",
            symbol: "$"
        };
        const entry = SAVINGS_TABLE[currencyCode];
        const amount = entry?.amount ?? 2480;
        const word = entry?.word ?? "penny";

        try {
            amountElement.textContent = new Intl.NumberFormat(info.locale || "en-US", {
                style: "currency",
                currency: info.code,
                maximumFractionDigits: 0
            }).format(amount);
        } catch (error) {
            amountElement.textContent = `${info.symbol || "$"}${amount.toLocaleString()}`;
        }

        if (wordElement) wordElement.textContent = word;
    }

    function initializeHeroCurrency() {
        let detected = null;
        const stored = localStorage.getItem("userCurrency");

        if (stored && stored !== "None") {
            detected = stored;
        } else if (typeof detectLikelyCurrencyCode === "function") {
            detected = detectLikelyCurrencyCode();
        }

        if (detected) applyHeroCurrency(detected);

        if (!stored && typeof detectClientLocationCurrency === "function") {
            detectClientLocationCurrency()
                .then((locationCurrency) => {
                    if (locationCurrency && locationCurrency !== detected) {
                        applyHeroCurrency(locationCurrency);
                    }
                })
                .catch(() => {
                    // Location-based enhancement is optional; keep the local
                    // or browser-derived currency when the lookup fails.
                });
        }
    }

    initializeHeroCurrency();
})();
