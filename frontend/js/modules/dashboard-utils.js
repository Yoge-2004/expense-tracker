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
