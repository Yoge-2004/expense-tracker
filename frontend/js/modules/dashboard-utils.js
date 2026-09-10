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

    function formatCurrency(amount) {
        if (typeof window.formatGlobalCurrency === "function") {
            return window.formatGlobalCurrency(amount);
        }
        const symbol = typeof window.getCurrencySymbol === "function" ? window.getCurrencySymbol() : "$";
        return `${symbol} ${Number(amount || 0).toFixed(2)}`;
    }

    const CATEGORY_PALETTE = [
        { bg: "rgba(199,154,62,0.12)", color: "#C79A3E" },
        { bg: "rgba(162,62,50,0.12)", color: "#A23E32" },
        { bg: "rgba(76,122,120,0.12)", color: "#4C7A78" },
        { bg: "rgba(91,140,90,0.12)", color: "#5B8C5A" },
        { bg: "rgba(139,94,52,0.12)", color: "#8B5E34" },
        { bg: "rgba(176,107,92,0.12)", color: "#B06B5C" },
        { bg: "rgba(201,147,46,0.12)", color: "#C9932E" },
        { bg: "rgba(107,114,128,0.12)", color: "#6B7280" }
    ];

    function getCategoryColor(name) {
        const index = name
            ? String(name).split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % CATEGORY_PALETTE.length
            : 0;
        return CATEGORY_PALETTE[index];
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
        formatCurrency,
        formatDate
    });
    window.escapeHtml = escapeHtml;
})();
