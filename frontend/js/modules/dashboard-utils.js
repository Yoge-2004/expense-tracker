/* Shared, dependency-free dashboard utilities. */
(function () {
    "use strict";

    function getLocalDateString(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    function parseLocalDate(value) {
        if (!value) return new Date();
        if (value instanceof Date) return value;
        const parts = String(value).split("T")[0].split("-");
        if (parts.length === 3) {
            return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        }
        return new Date(value);
    }

    function escapeHtml(value) {
        if (value == null) return "";
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // For a value embedded inside a single-quoted JS string literal that is
    // itself inside an inline onclick="..." HTML attribute. Order matters:
    // the JS-string escape must run BEFORE the HTML escape. Doing it in the
    // other order (as duplicated in three places before this fix) makes the
    // quote-escape a no-op, since escapeHtml() has already turned every "'"
    // into "&#039;" by the time it runs — so a name/description containing
    // an apostrophe broke the click handler with a JS syntax error once the
    // browser HTML-decoded the attribute back into source.
    function jsAttrEscape(value) {
        const jsSafe = String(value ?? "")
            .replace(/\\/g, "\\\\")
            .replace(/'/g, "\\'");
        return escapeHtml(jsSafe);
    }

    function formatCurrency(amount) {
        if (typeof window.formatGlobalCurrency === "function") {
            return window.formatGlobalCurrency(amount);
        }
        const symbol = typeof window.getCurrencySymbol === "function" ? window.getCurrencySymbol() : "$";
        return `${symbol} ${Number(amount || 0).toFixed(2)}`;
    }

    const CATEGORY_PALETTE = [
        { bg: "rgba(199,154,62,0.12)", color: "#C79A3E" }, // 1. Imperial Gold
        { bg: "rgba(162,62,50,0.12)", color: "#A23E32" },  // 2. Oxblood Crimson
        { bg: "rgba(76,122,120,0.12)", color: "#4C7A78" }, // 3. Emerald Teal
        { bg: "rgba(91,140,90,0.12)", color: "#5B8C5A" },  // 4. Sage Olive
        { bg: "rgba(139,94,52,0.12)", color: "#8B5E34" },  // 5. Warm Umber
        { bg: "rgba(176,107,92,0.12)", color: "#B06B5C" }, // 6. Terracotta
        { bg: "rgba(201,147,46,0.12)", color: "#C9932E" }, // 7. Ochre Mustard
        { bg: "rgba(107,114,128,0.12)", color: "#6B7280" },// 8. Slate Gray
        { bg: "rgba(59,130,246,0.12)", color: "#3B82F6" }, // 9. Cobalt Sapphire
        { bg: "rgba(139,92,246,0.12)", color: "#8B5CF6" }, // 10. Royal Amethyst
        { bg: "rgba(236,72,153,0.12)", color: "#EC4899" }, // 11. Vivid Rose
        { bg: "rgba(20,184,166,0.12)", color: "#14B8A6" }, // 12. Cyan Jade
        { bg: "rgba(245,158,11,0.12)", color: "#F59E0B" }, // 13. Bright Amber
        { bg: "rgba(99,102,241,0.12)", color: "#6366F1" }, // 14. Deep Indigo
        { bg: "rgba(16,185,129,0.12)", color: "#10B981" }, // 15. Forest Mint
        { bg: "rgba(239,68,68,0.12)", color: "#EF4444" },  // 16. Scarlet Flame
        { bg: "rgba(168,85,247,0.12)", color: "#A855F7" }, // 17. Electric Violet
        { bg: "rgba(6,182,212,0.12)", color: "#06B6D4" },  // 18. Aqua Marine
        { bg: "rgba(217,119,6,0.12)", color: "#D97706" },  // 19. Burnt Copper
        { bg: "rgba(79,70,229,0.12)", color: "#4F46E5" },  // 20. Royal Iris
        { bg: "rgba(13,148,136,0.12)", color: "#0D9488" }, // 21. Persian Teal
        { bg: "rgba(190,24,93,0.12)", color: "#BE185D" },  // 22. Magenta Wine
        { bg: "rgba(101,163,13,0.12)", color: "#65A30D" }, // 23. Lime Citron
        { bg: "rgba(100,116,139,0.12)", color: "#64748B" } // 24. Mineral Steel
    ];

    function getCategoryColor(name, index) {
        if (index !== undefined && index >= 0 && index < CATEGORY_PALETTE.length) {
            return CATEGORY_PALETTE[index];
        }
        if (!name) return CATEGORY_PALETTE[0];
        const clean = String(name).trim().toLowerCase();
        let hash = 0;
        for (let i = 0; i < clean.length; i++) {
            hash = (hash * 31 + clean.charCodeAt(i)) & 0xffffffff;
        }
        const absHash = Math.abs(hash);
        const paletteIndex = absHash % CATEGORY_PALETTE.length;
        return CATEGORY_PALETTE[paletteIndex];
    }

    function getCategoryEmoji(name) {
        const value = String(name || "").toLowerCase();
        if (value.includes("food") || value.includes("dining") || value.includes("restaurant")) return "🍔";
        if (value.includes("transport") || value.includes("travel") || value.includes("uber")) return "🚗";
        if (value.includes("shop") || value.includes("cloth") || value.includes("amazon")) return "🛍️";
        if (value.includes("util") || value.includes("electric") || value.includes("water") || value.includes("bill")) return "⚡";
        if (value.includes("entertain") || value.includes("movie") || value.includes("netflix")) return "🎬";
        if (value.includes("health") || value.includes("medical") || value.includes("gym")) return "💊";
        if (value.includes("edu") || value.includes("course") || value.includes("book")) return "📚";
        if (value.includes("subscribe") || value.includes("saas") || value.includes("software")) return "💻";
        if (value.includes("grocer") || value.includes("market") || value.includes("super")) return "🛒";
        return "💳";
    }

    function debounce(fn, delay) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn(...args), delay);
        };
    }

    function formatDate(value) {
        if (!value) return "";
        return parseLocalDate(value).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric"
        });
    }

    window.DashboardUtils = Object.freeze({
        getLocalDateString,
        parseLocalDate,
        escapeHtml,
        jsAttrEscape,
        formatCurrency,
        formatDate,
        getCategoryColor,
        getCategoryEmoji,
        debounce
    });
    window.escapeHtml = escapeHtml;
    window.debounce = debounce;
})();
