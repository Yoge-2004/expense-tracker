// Automatically detect local development or the deployed API.
const API_BASE_URL = (["localhost", "127.0.0.1", ""].includes(window.location.hostname) || window.location.protocol === "file:")
    ? "http://localhost:8080/api"
    : "https://yoge-2004-expense-tracker-backend.hf.space/api";

let activeRequests = 0;
let loadingTimer;
let isServerOnline = true;

function ensureFeedbackUi() {
    if (document.getElementById("appToastRegion")) return;
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
            toast.addEventListener("transitionend", () => toast.remove(), { once: true });
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
            } else {
                isServerOnline = false;
                updateServerStatus(false, "Database Down");
                return false;
            }
        } else {
            isServerOnline = false;
            updateServerStatus(false, "Service Unavailable");
            return false;
        }
    } catch (e) {
        isServerOnline = false;
        updateServerStatus(false, "Server Offline");
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
    setInterval(checkHealth, 30000);
}

async function apiRequest(endpoint, options = {}) {
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
    setLoading(true);
    let response;
    try {
        response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
        updateServerStatus(true, "Connected");
    } catch (error) {
        updateServerStatus(false, "Server Offline");
        throw new Error("We couldn't reach the server. Please check your connection or server status.");
    } finally {
        activeRequests -= 1;
        if (activeRequests === 0) setLoading(false);
    }

    if (response.status === 503) {
        updateServerStatus(false, "Database Unavailable");
        const text = await response.text();
        let msg = "Database service is unavailable. Please try again later.";
        try {
            const err = JSON.parse(text);
            if (err.message) msg = err.message;
        } catch (e) {}
        showToast(msg, "error");
        throw new Error(msg);
    }

    if (response.status === 401 && !endpoint.includes("/auth/login")) {
        localStorage.clear();
        window.location.href = "index.html";
        throw new Error("Your session has expired. Please sign in again.");
    }

    if (response.status === 204) return null;

    const text = await response.text();
    if (!response.ok) {
        try {
            const error = JSON.parse(text);
            throw new Error(error.message || error.error || "Request failed.");
        } catch (error) {
            if (error.message && !error.message.includes("JSON")) throw error;
            throw new Error("The server is temporarily unavailable. Please try again in a moment.");
        }
    }

    const data = text ? JSON.parse(text) : null;

    if (method === "GET") {
        apiCache.set(endpoint, { data, timestamp: Date.now() });
    }

    return data;
}

// Global Theme Handler
function initGlobalTheme() {
    const savedTheme = localStorage.getItem("theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
    document.body.setAttribute("data-theme", savedTheme);
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
    document.documentElement.setAttribute("data-theme", nextTheme);
    document.body.setAttribute("data-theme", nextTheme);
    localStorage.setItem("theme", nextTheme);
    updateAllThemeIcons(nextTheme);
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
    { code: 'RON', symbol: 'lei', name: 'Romanian Leu', flag: '🇷🇴', locale: 'ro-RO' }
];

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
    checkHealth();
    setInterval(checkHealth, 30000);

    document.addEventListener("click", (e) => {
        const toggleBtn = e.target.closest(".theme-toggle-btn, #themeToggle");
        if (toggleBtn) {
            toggleGlobalTheme();
        }
    });
});

