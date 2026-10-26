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
        const symbol = typeof window.getCurrencySymbol === "function" ? window.getCurrencySymbol() : "₹";
        const isAlpha = /^[A-Z]{3}$/.test(symbol);
        const numStr = Number(amount || 0).toFixed(2);
        return isAlpha ? `${symbol} ${numStr}` : `${symbol}${numStr}`;
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

    function getCategorySvg(name, size = 16) {
        const value = String(name || "").toLowerCase();
        const svgAttrs = `width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:-2px;"`;
        if (value.includes("saving") || value.includes("deposit") || value.includes("invest")) {
            return `<svg ${svgAttrs}><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a8 8 0 0 1-16 0V6"/><circle cx="12" cy="14" r="2"/></svg>`;
        }
        if (value.includes("loan") || value.includes("debt") || value.includes("borrow") || value.includes("lend") || value.includes("adjust")) {
            return `<svg ${svgAttrs}><path d="m11 17 2 2a1 1 0 0 0 1.4 0l4.3-4.3a1 1 0 0 0 0-1.4L16 11"/><path d="m13 7 1.3-1.3a1 1 0 0 1 1.4 0L19 9"/><path d="m2 14 6 6"/><path d="M20 22l2-2"/><path d="m3 7 5.7 5.7a1 1 0 0 0 1.4 0L15 8"/><path d="m8 2 2 2"/></svg>`;
        }
        if (value.includes("food") || value.includes("dining") || value.includes("restaurant") || value.includes("meal") || value.includes("cafe")) {
            return `<svg ${svgAttrs}><path d="M18 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3ZM7 2v20M3 2v6a4 4 0 0 0 4 4h0a4 4 0 0 0 4-4V2"/></svg>`;
        }
        if (value.includes("transport") || value.includes("travel") || value.includes("uber") || value.includes("fuel") || value.includes("car")) {
            return `<svg ${svgAttrs}><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H7.5a1 1 0 0 0-.8.4L4 11l-5.16.86a1 1 0 0 0-.84.99V16h3"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>`;
        }
        if (value.includes("shop") || value.includes("cloth") || value.includes("amazon") || value.includes("retail") || value.includes("apparel")) {
            return `<svg ${svgAttrs}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`;
        }
        if (value.includes("util") || value.includes("electric") || value.includes("water") || value.includes("bill") || value.includes("power")) {
            return `<svg ${svgAttrs}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
        }
        if (value.includes("entertain") || value.includes("movie") || value.includes("netflix") || value.includes("music") || value.includes("stream")) {
            return `<svg ${svgAttrs}><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>`;
        }
        if (value.includes("health") || value.includes("medical") || value.includes("gym") || value.includes("pharmacy") || value.includes("doctor")) {
            return `<svg ${svgAttrs}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`;
        }
        if (value.includes("edu") || value.includes("course") || value.includes("book") || value.includes("school") || value.includes("study")) {
            return `<svg ${svgAttrs}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`;
        }
        if (value.includes("subscribe") || value.includes("saas") || value.includes("software") || value.includes("cloud") || value.includes("tech")) {
            return `<svg ${svgAttrs}><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="20" x2="22" y2="20"/></svg>`;
        }
        if (value.includes("grocer") || value.includes("market") || value.includes("super") || value.includes("mart")) {
            return `<svg ${svgAttrs}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`;
        }
        return `<svg ${svgAttrs}><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`;
    }

    function getCategoryEmoji(name) {
        return getCategorySvg(name, 16);
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
        getCategorySvg,
        debounce
    });
    window.escapeHtml = escapeHtml;
    window.debounce = debounce;
})();
