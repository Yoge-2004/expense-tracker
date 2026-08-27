// Automatically detect local development or the deployed API.
const API_BASE_URL = (["localhost", "127.0.0.1", ""].includes(window.location.hostname) || window.location.protocol === "file:")
    ? "http://localhost:8080/api"
    : "https://yoge-2004-expense-tracker-backend.hf.space/api";

let activeRequests = 0;
let loadingTimer;
let isServerOnline = true;

function ensureFeedbackUi() {
    // Previously only checked for #appToastRegion's existence as a proxy for
    // "all three elements are present" — but if #appLoading or
    // #serverStatusBadge ever went missing independently while
    // #appToastRegion remained, this would return early without repairing
    // them, and setLoading()/updateServerStatus() would then throw on the
    // missing element. Checking all three closes that gap — but naively
    // re-injecting the full template when only one is missing would create
    // duplicate-ID elements for whichever ones still exist, since
    // insertAdjacentHTML doesn't check for existing IDs. Removing any
    // partial remnants first avoids that.
    const allPresent = document.getElementById("appToastRegion")
        && document.getElementById("appLoading")
        && document.getElementById("serverStatusBadge");
    if (allPresent) return;

    document.getElementById("appLoading")?.remove();
    document.getElementById("serverStatusBadge")?.remove();
    document.getElementById("appToastRegion")?.remove();
    document.body.insertAdjacentHTML("beforeend", `
        <div id="appLoading" class="app-loading" aria-live="polite" aria-busy="true">
            <span class="spinner" aria-hidden="true"></span><span id="loadingText">Connecting to the server…</span>
        </div>
        <div id="serverStatusBadge" class="server-status-badge online" title="Server Status">
            <span class="status-dot"></span><span id="statusText">Connected</span>
        </div>
        <div id="appToastRegion" class="toast-region" aria-live="polite" aria-atomic="true"></div>`);
}

function updateServerStatus(online, message = "Connected") {
    ensureFeedbackUi();
    const badge = document.getElementById("serverStatusBadge");
    const text = document.getElementById("statusText");
    if (!badge || !text) return;

    if (online) {
        badge.className = "server-status-badge online";
        text.textContent = "Connected";
    } else {
        badge.className = "server-status-badge offline";
        text.textContent = message;
    }
}

function setLoading(isLoading, customText = "Connecting to the server…") {
    ensureFeedbackUi();
    const loader = document.getElementById("appLoading");
    const loadingText = document.getElementById("loadingText");
    if (loadingText) loadingText.textContent = customText;
    clearTimeout(loadingTimer);
    if (!loader) return;
    if (isLoading) {
        loadingTimer = setTimeout(() => loader.classList.add("visible"), 200);
    } else {
        loader.classList.remove("visible");
    }
}

function showToast(message, type = "info") {
    ensureFeedbackUi();
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.setAttribute("role", type === "error" ? "alert" : "status");
    toast.innerHTML = `<span>${message}</span><button class="toast-close" onclick="this.parentElement.remove()">✕</button>`;
    document.getElementById("appToastRegion").appendChild(toast);
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add("leaving");
            // The "leaving" state is driven by a CSS animation (toastOut), not a
            // transition, so this must listen for animationend. A setTimeout
            // fallback is kept as a safety net in case CSS changes again and
            // neither event fires — without it, toasts silently pile up in the
            // DOM forever and end up blocking clicks on real UI underneath them.
            const remove = () => toast.remove();
            toast.addEventListener("animationend", remove, { once: true });
            toast.addEventListener("transitionend", remove, { once: true });
            setTimeout(remove, 500);
        }
    }, 5000);
}

const apiCache = new Map();
const CACHE_TTL_MS = 15000;

async function checkHealth() {
    try {
        const res = await fetch(`${API_BASE_URL}/health`, { cache: 'no-store' });
        if (res.ok) {
            const data = await res.json();
            if (data.status === "UP" || data.database === "UP") {
                isServerOnline = true;
                updateServerStatus(true, "Connected");
                return true;
            }
        }
        isServerOnline = false;
        updateServerStatus(false, "Waking up server...");
        return false;
    } catch (e) {
        isServerOnline = false;
        updateServerStatus(false, "Waking up server...");
        return false;
    }
}

// Automatically check server health on load and periodically
if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", checkHealth);
    } else {
        checkHealth();
    }
    setInterval(checkHealth, 15000);
}

async function apiRequest(endpoint, options = {}, retriesLeft = 2) {
    const method = (options.method || "GET").toUpperCase();

    if (method !== "GET") {
        apiCache.clear();
    }

    if (method === "GET") {
        const cached = apiCache.get(endpoint);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
            return cached.data;
        }
    }

    const token = localStorage.getItem("token");
    const headers = {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers
    };

    activeRequests += 1;
    setLoading(true, retriesLeft < 2 ? "Waking up server (cold start)..." : "Connecting to server...");
    let response;
    try {
        response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
    } catch (error) {
        if (retriesLeft > 0) {
            updateServerStatus(false, "Connecting to server...");
            await new Promise(r => setTimeout(r, 2500));
            // Do not decrement activeRequests here — the `finally` block
            // below always runs exactly once per call (including this one),
            // so decrementing here too was double-counting on every retry
            // and could hide the loading overlay while another concurrent
            // request was still genuinely in flight.
            return apiRequest(endpoint, options, retriesLeft - 1);
        }
        updateServerStatus(false, "Connecting...");
        throw new Error("Unable to connect to the server. Please check your connection and try again.");
    } finally {
        activeRequests -= 1;
        if (activeRequests === 0) setLoading(false);
    }

    if (response.status === 503) {
        if (retriesLeft > 0) {
            updateServerStatus(false, "Connecting to server...");
            await new Promise(r => setTimeout(r, 2500));
            return apiRequest(endpoint, options, retriesLeft - 1);
        }
        updateServerStatus(false, "Connecting...");
        throw new Error("The server is currently connecting. Please try again in a few moments.");
    }

    updateServerStatus(true, "Connected");

    if (response.status === 401 && !endpoint.includes("/auth/login")) {
        localStorage.clear();
        window.location.href = "index.html";
        throw new Error("Your session has expired. Please sign in again.");
    }

    if (response.status === 204) return null;

    const text = await response.text();
    if (!response.ok) {
        // Previously this parsed the JSON body inside a try block and threw
        // from there, relying on that throw being caught by the very next
        // catch clause as an ad-hoc control-flow trick. It happened to work
        // when the backend returned valid JSON, but any non-JSON or empty
        // body (which is exactly what Spring Security's filter chain used to
        // return for 401/403s before it reached our own error handler) made
        // JSON.parse's own "Unexpected end of JSON input" message match the
        // `.includes("JSON")` check, so it silently fell back to "Unable to
        // connect to the server" — a misleading message for what was often a
        // permissions or validation error, not a connectivity problem.
        let msg = null;
        try {
            const parsed = JSON.parse(text);
            msg = parsed.message || parsed.error || null;
        } catch (_) {
            // Body wasn't JSON; fall through to a status-based message below.
        }

        if (msg && msg.toLowerCase().includes("database")) {
            msg = "Unable to connect to the server. Please try again in a moment.";
        }

        if (!msg) {
            const statusMessages = {
                400: "That request wasn't valid. Please check your input and try again.",
                403: "You don't have permission to do that.",
                404: "The requested resource couldn't be found.",
                409: "This conflicts with existing data.",
                422: "That request wasn't valid. Please check your input and try again.",
                500: "Something went wrong on the server. Please try again.",
                502: "The server is temporarily unavailable. Please try again shortly.",
                503: "The server is temporarily unavailable. Please try again shortly.",
            };
            msg = statusMessages[response.status] || `Request failed (${response.status}).`;
        }

        throw new Error(msg);
    }

    const data = text ? JSON.parse(text) : null;

    if (method === "GET") {
        apiCache.set(endpoint, { data, timestamp: Date.now() });
    }

    return data;
}

// Global Theme Handler

// Browser chrome (tab bar / PWA title bar) color per theme — kept in sync
// with the --bg-dark value each theme sets in css/style.css so the tab
// color actually matches the page instead of staying fixed on dark.
const THEME_COLOR_MAP = { dark: "#10120E", light: "#F8F9FA" };

function updateThemeColorMeta(theme) {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", "theme-color");
        document.head.appendChild(meta);
    }
    meta.setAttribute("content", THEME_COLOR_MAP[theme] || THEME_COLOR_MAP.dark);
}

function initGlobalTheme() {
    const savedTheme = localStorage.getItem("theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
    document.body.setAttribute("data-theme", savedTheme);
    updateThemeColorMeta(savedTheme);
    updateAllThemeIcons(savedTheme);
}

function updateAllThemeIcons(theme) {
    document.querySelectorAll(".theme-toggle-btn, #themeToggle").forEach(btn => {
        const sun = btn.querySelector(".sun-icon");
        const moon = btn.querySelector(".moon-icon");
        if (sun && moon) {
            if (theme === "dark") {
                sun.style.display = "block";
                moon.style.display = "none";
                btn.setAttribute("title", "Switch to Light Theme");
                btn.setAttribute("aria-label", "Switch to Light Theme");
            } else {
                sun.style.display = "none";
                moon.style.display = "block";
                btn.setAttribute("title", "Switch to Dark Theme");
                btn.setAttribute("aria-label", "Switch to Dark Theme");
            }
        }
    });
}

function toggleGlobalTheme() {
    const currentTheme = document.body.getAttribute("data-theme") === "light" ? "light" : "dark";
    const nextTheme = currentTheme === "dark" ? "light" : "dark";

    // Engage the transition window before the attribute flips, so the
    // very first frame of the color change is already transitioning
    // instead of snapping, then let it settle and clean up.
    document.documentElement.classList.add("theme-transitioning");
    clearTimeout(window.__themeTransitionCleanup);

    document.documentElement.setAttribute("data-theme", nextTheme);
    document.body.setAttribute("data-theme", nextTheme);
    localStorage.setItem("theme", nextTheme);
    updateThemeColorMeta(nextTheme);
    updateAllThemeIcons(nextTheme);
    // Let anything that needs to re-render with the new theme's colors
    // (e.g. canvas-drawn charts, which don't pick up CSS variables on
    // their own) react AFTER the theme has actually been applied, rather
    // than racing a click listener attached directly to the toggle button.
    // Deferred one frame so the (expensive, synchronous) chart re-render
    // this triggers doesn't block the paint of the color transition itself
    // — that block was the main source of the toggle feeling laggy rather
    // than smooth.
    requestAnimationFrame(() => {
        document.dispatchEvent(new CustomEvent("themechange", { detail: { theme: nextTheme } }));
    });

    window.__themeTransitionCleanup = setTimeout(() => {
        document.documentElement.classList.remove("theme-transitioning");
    }, 450);
}

// Global Multi-Currency System (50 World Currencies)
const WORLD_CURRENCIES = [
    { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸', locale: 'en-US' },
    { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺', locale: 'de-DE' },
    { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧', locale: 'en-GB' },
    { code: 'INR', symbol: '₹', name: 'Indian Rupee', flag: '🇮🇳', locale: 'en-IN' },
    { code: 'JPY', symbol: '¥', name: 'Japanese Yen', flag: '🇯🇵', locale: 'ja-JP' },
    { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', flag: '🇨🇦', locale: 'en-CA' },
    { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', flag: '🇦🇺', locale: 'en-AU' },
    { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc', flag: '🇨🇭', locale: 'de-CH' },
    { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', flag: '🇨🇳', locale: 'zh-CN' },
    { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', flag: '🇧🇷', locale: 'pt-BR' },
    { code: 'AED', symbol: 'AED', name: 'UAE Dirham', flag: '🇦🇪', locale: 'ar-AE' },
    { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', flag: '🇸🇬', locale: 'en-SG' },
    { code: 'KRW', symbol: '₩', name: 'South Korean Won', flag: '🇰🇷', locale: 'ko-KR' },
    { code: 'RUB', symbol: '₽', name: 'Russian Ruble', flag: '🇷🇺', locale: 'ru-RU' },
    { code: 'MXN', symbol: '$', name: 'Mexican Peso', flag: '🇲🇽', locale: 'es-MX' },
    { code: 'ZAR', symbol: 'R', name: 'South African Rand', flag: '🇿🇦', locale: 'en-ZA' },
    { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', flag: '🇳🇿', locale: 'en-NZ' },
    { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', flag: '🇸🇪', locale: 'sv-SE' },
    { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', flag: '🇳🇴', locale: 'no-NO' },
    { code: 'DKK', symbol: 'kr', name: 'Danish Krone', flag: '🇩🇰', locale: 'da-DK' },
    { code: 'PLN', symbol: 'zł', name: 'Polish Zloty', flag: '🇵🇱', locale: 'pl-PL' },
    { code: 'THB', symbol: '฿', name: 'Thai Baht', flag: '🇹🇭', locale: 'th-TH' },
    { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', flag: '🇮🇩', locale: 'id-ID' },
    { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', flag: '🇲🇾', locale: 'ms-MY' },
    { code: 'PHP', symbol: '₱', name: 'Philippine Peso', flag: '🇵🇭', locale: 'en-PH' },
    { code: 'VND', symbol: '₫', name: 'Vietnamese Dong', flag: '🇻🇳', locale: 'vi-VN' },
    { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', flag: '🇭🇰', locale: 'zh-HK' },
    { code: 'TWD', symbol: 'NT$', name: 'New Taiwan Dollar', flag: '🇹🇼', locale: 'zh-TW' },
    { code: 'SAR', symbol: 'SR', name: 'Saudi Riyal', flag: '🇸🇦', locale: 'ar-SA' },
    { code: 'QAR', symbol: 'QR', name: 'Qatari Riyal', flag: '🇶🇦', locale: 'ar-QA' },
    { code: 'KWD', symbol: 'KD', name: 'Kuwaiti Dinar', flag: '🇰🇼', locale: 'ar-KW' },
    { code: 'BHD', symbol: 'BD', name: 'Bahraini Dinar', flag: '🇧🇭', locale: 'ar-BH' },
    { code: 'OMR', symbol: 'OMR', name: 'Omani Rial', flag: '🇴🇲', locale: 'ar-OM' },
    { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound', flag: '🇪🇬', locale: 'ar-EG' },
    { code: 'TRY', symbol: '₺', name: 'Turkish Lira', flag: '🇹🇷', locale: 'tr-TR' },
    { code: 'ILS', symbol: '₪', name: 'Israeli New Shekel', flag: '🇮🇱', locale: 'he-IL' },
    { code: 'CLP', symbol: '$', name: 'Chilean Peso', flag: '🇨🇱', locale: 'es-CL' },
    { code: 'COP', symbol: '$', name: 'Colombian Peso', flag: '🇨🇴', locale: 'es-CO' },
    { code: 'ARS', symbol: '$', name: 'Argentine Peso', flag: '🇦🇷', locale: 'es-AR' },
    { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol', flag: '🇵🇪', locale: 'es-PE' },
    { code: 'PKR', symbol: 'Rs', name: 'Pakistani Rupee', flag: '🇵🇰', locale: 'en-PK' },
    { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', flag: '🇧🇩', locale: 'bn-BD' },
    { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan Rupee', flag: '🇱🇰', locale: 'si-LK' },
    { code: 'NPR', symbol: 'Rs', name: 'Nepalese Rupee', flag: '🇳🇵', locale: 'ne-NP' },
    { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', flag: '🇳🇬', locale: 'en-NG' },
    { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', flag: '🇰🇪', locale: 'sw-KE' },
    { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi', flag: '🇬🇭', locale: 'en-GH' },
    { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna', flag: '🇨🇿', locale: 'cs-CZ' },
    { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint', flag: '🇭🇺', locale: 'hu-HU' },
    { code: 'RON', symbol: 'lei', name: 'Romanian Leu', flag: '🇷🇴', locale: 'ro-RO' },
    { code: 'UAH', symbol: '₴', name: 'Ukrainian Hryvnia', flag: '🇺🇦', locale: 'uk-UA' },
    { code: 'BGN', symbol: 'лв', name: 'Bulgarian Lev', flag: '🇧🇬', locale: 'bg-BG' },
    { code: 'ISK', symbol: 'kr', name: 'Icelandic Krona', flag: '🇮🇸', locale: 'is-IS' },
    { code: 'RSD', symbol: 'дин', name: 'Serbian Dinar', flag: '🇷🇸', locale: 'sr-RS' },
    { code: 'HRK', symbol: 'kn', name: 'Croatian Kuna', flag: '🇭🇷', locale: 'hr-HR' },
    { code: 'BAM', symbol: 'KM', name: 'Bosnia-Herzegovina Mark', flag: '🇧🇦', locale: 'bs-BA' },
    { code: 'ALL', symbol: 'L', name: 'Albanian Lek', flag: '🇦🇱', locale: 'sq-AL' },
    { code: 'MKD', symbol: 'ден', name: 'Macedonian Denar', flag: '🇲🇰', locale: 'mk-MK' },
    { code: 'MDL', symbol: 'L', name: 'Moldovan Leu', flag: '🇲🇩', locale: 'ro-MD' },
    { code: 'BYN', symbol: 'Br', name: 'Belarusian Ruble', flag: '🇧🇾', locale: 'be-BY' },
    { code: 'GEL', symbol: '₾', name: 'Georgian Lari', flag: '🇬🇪', locale: 'ka-GE' },
    { code: 'AMD', symbol: '֏', name: 'Armenian Dram', flag: '🇦🇲', locale: 'hy-AM' },
    { code: 'AZN', symbol: '₼', name: 'Azerbaijani Manat', flag: '🇦🇿', locale: 'az-AZ' },
    { code: 'KZT', symbol: '₸', name: 'Kazakhstani Tenge', flag: '🇰🇿', locale: 'kk-KZ' },
    { code: 'UZS', symbol: "so'm", name: 'Uzbekistani Som', flag: '🇺🇿', locale: 'uz-UZ' },
    { code: 'MNT', symbol: '₮', name: 'Mongolian Tugrik', flag: '🇲🇳', locale: 'mn-MN' },
    { code: 'JOD', symbol: 'JD', name: 'Jordanian Dinar', flag: '🇯🇴', locale: 'ar-JO' },
    { code: 'LBP', symbol: 'L£', name: 'Lebanese Pound', flag: '🇱🇧', locale: 'ar-LB' },
    { code: 'IQD', symbol: 'ID', name: 'Iraqi Dinar', flag: '🇮🇶', locale: 'ar-IQ' },
    { code: 'MAD', symbol: 'DH', name: 'Moroccan Dirham', flag: '🇲🇦', locale: 'ar-MA' },
    { code: 'DZD', symbol: 'DA', name: 'Algerian Dinar', flag: '🇩🇿', locale: 'ar-DZ' },
    { code: 'TND', symbol: 'DT', name: 'Tunisian Dinar', flag: '🇹🇳', locale: 'ar-TN' },
    { code: 'AFN', symbol: '؋', name: 'Afghan Afghani', flag: '🇦🇫', locale: 'fa-AF' },
    { code: 'MMK', symbol: 'K', name: 'Myanmar Kyat', flag: '🇲🇲', locale: 'my-MM' },
    { code: 'KHR', symbol: '៛', name: 'Cambodian Riel', flag: '🇰🇭', locale: 'km-KH' },
    { code: 'LAK', symbol: '₭', name: 'Lao Kip', flag: '🇱🇦', locale: 'lo-LA' },
    { code: 'FJD', symbol: 'FJ$', name: 'Fijian Dollar', flag: '🇫🇯', locale: 'en-FJ' },
    { code: 'XOF', symbol: 'CFA', name: 'West African CFA Franc', flag: '🇸🇳', locale: 'fr-SN' },
    { code: 'XAF', symbol: 'FCFA', name: 'Central African CFA Franc', flag: '🇨🇲', locale: 'fr-CM' },
    { code: 'ETB', symbol: 'Br', name: 'Ethiopian Birr', flag: '🇪🇹', locale: 'am-ET' },
    { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling', flag: '🇹🇿', locale: 'sw-TZ' },
    { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling', flag: '🇺🇬', locale: 'en-UG' },
    { code: 'RWF', symbol: 'FRw', name: 'Rwandan Franc', flag: '🇷🇼', locale: 'rw-RW' },
    { code: 'ZMW', symbol: 'ZK', name: 'Zambian Kwacha', flag: '🇿🇲', locale: 'en-ZM' },
    { code: 'MZN', symbol: 'MT', name: 'Mozambican Metical', flag: '🇲🇿', locale: 'pt-MZ' },
    { code: 'BWP', symbol: 'P', name: 'Botswana Pula', flag: '🇧🇼', locale: 'en-BW' },
    { code: 'NAD', symbol: 'N$', name: 'Namibian Dollar', flag: '🇳🇦', locale: 'en-NA' },
    { code: 'MUR', symbol: '₨', name: 'Mauritian Rupee', flag: '🇲🇺', locale: 'en-MU' },
    { code: 'DOP', symbol: 'RD$', name: 'Dominican Peso', flag: '🇩🇴', locale: 'es-DO' },
    { code: 'GTQ', symbol: 'Q', name: 'Guatemalan Quetzal', flag: '🇬🇹', locale: 'es-GT' },
    { code: 'HNL', symbol: 'L', name: 'Honduran Lempira', flag: '🇭🇳', locale: 'es-HN' },
    { code: 'NIO', symbol: 'C$', name: 'Nicaraguan Cordoba', flag: '🇳🇮', locale: 'es-NI' },
    { code: 'CRC', symbol: '₡', name: 'Costa Rican Colon', flag: '🇨🇷', locale: 'es-CR' },
    { code: 'PAB', symbol: 'B/.', name: 'Panamanian Balboa', flag: '🇵🇦', locale: 'es-PA' },
    { code: 'BOB', symbol: 'Bs', name: 'Bolivian Boliviano', flag: '🇧🇴', locale: 'es-BO' },
    { code: 'PYG', symbol: '₲', name: 'Paraguayan Guarani', flag: '🇵🇾', locale: 'es-PY' },
    { code: 'UYU', symbol: '$U', name: 'Uruguayan Peso', flag: '🇺🇾', locale: 'es-UY' },
    { code: 'JMD', symbol: 'J$', name: 'Jamaican Dollar', flag: '🇯🇲', locale: 'en-JM' },
    { code: 'TTD', symbol: 'TT$', name: 'Trinidad & Tobago Dollar', flag: '🇹🇹', locale: 'en-TT' },
    { code: 'BSD', symbol: 'B$', name: 'Bahamian Dollar', flag: '🇧🇸', locale: 'en-BS' }
];

/**
 * Guesses the user's likely currency from their browser locale (e.g. "en-IN"
 * -> the currency whose `locale` field shares the same region, "IN" -> INR).
 * No network/geolocation call and no permission prompt required. Returns null
 * if nothing matches, so callers can fall back to a fixed default.
 */
function detectLikelyCurrencyCode() {
    try {
        const browserLocale = (navigator.languages && navigator.languages[0]) || navigator.language || Intl.NumberFormat().resolvedOptions().locale;
        const region = browserLocale.split(/[-_]/)[1]?.toUpperCase();
        if (!region) return null;
        const match = WORLD_CURRENCIES.find(c => c.locale.split('-')[1]?.toUpperCase() === region);
        return match ? match.code : null;
    } catch (e) {
        return null;
    }
}

/**
 * Returns WORLD_CURRENCIES reordered so the user's likely currency (per
 * detectLikelyCurrencyCode) appears first in currency pickers, without
 * changing the underlying data or any other consumer of WORLD_CURRENCIES.
 */
function getCurrenciesSortedByLikelihood() {
    const detected = detectLikelyCurrencyCode();
    if (!detected) return WORLD_CURRENCIES;
    const detectedItem = WORLD_CURRENCIES.find(c => c.code === detected);
    if (!detectedItem) return WORLD_CURRENCIES;
    return [detectedItem, ...WORLD_CURRENCIES.filter(c => c.code !== detected)];
}

function getSelectedCurrency() {
    return localStorage.getItem("userCurrency") || "USD";
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
        return new Intl.NumberFormat(info.locale, { style: 'currency', currency: info.code, maximumFractionDigits: 2 }).format(amt || 0);
    } catch (e) {
        return `${info.symbol} ${Number(amt || 0).toFixed(2)}`;
    }
}

function formatGlobalCompactCurrency(amt) {
    const info = getCurrencyInfo();
    try {
        return new Intl.NumberFormat(info.locale, { style: 'currency', currency: info.code, notation: 'compact', maximumFractionDigits: 1 }).format(amt || 0);
    } catch (e) {
        return `${info.symbol} ${Number(amt || 0).toFixed(0)}`;
    }
}

// Run immediately for zero flash of unthemed content
initGlobalTheme();

// Attach listeners on DOM ready
document.addEventListener("DOMContentLoaded", () => {
    initGlobalTheme();

    document.addEventListener("click", (e) => {
        const toggleBtn = e.target.closest(".theme-toggle-btn, #themeToggle");
        if (toggleBtn) {
            toggleGlobalTheme();
        }
    });

    // Global Interactive Multi-Color Fluid Click Ripple Effect
    document.addEventListener("click", (e) => {
        const targetBtn = e.target.closest(".btn-primary, .btn-secondary, .btn-oauth, .pill-chip, .preset-btn, .btn-icon, button[type='submit']");
        if (!targetBtn) return;

        const rect = targetBtn.getBoundingClientRect();
        const ripple = document.createElement("span");
        ripple.className = "ripple-effect";
        const size = Math.max(rect.width, rect.height);
        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
        ripple.style.top = `${e.clientY - rect.top - size / 2}px`;

        const oldPos = window.getComputedStyle(targetBtn).position;
        if (oldPos === 'static') targetBtn.style.position = 'relative';
        targetBtn.style.overflow = 'hidden';

        targetBtn.appendChild(ripple);
        ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
        setTimeout(() => ripple.remove(), 600);
    });
});

