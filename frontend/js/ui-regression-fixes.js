/* Synchronize theme controls while keeping dashboard refresh event-driven. */
(function () {
    "use strict";
    function syncThemeIcons() {
        const theme = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
        if (typeof window.updateAllThemeIcons === "function") { window.updateAllThemeIcons(theme); return; }
        document.querySelectorAll(".theme-toggle-btn, #themeToggle").forEach(button => {
            const sun = button.querySelector(".sun-icon");
            const moon = button.querySelector(".moon-icon");
            if (!sun || !moon) return;
            const light = theme === "light";
            sun.style.display = light ? "none" : "block";
            moon.style.display = light ? "block" : "none";
            button.setAttribute("aria-label", light ? "Switch to dark theme" : "Switch to light theme");
            button.setAttribute("title", light ? "Switch to dark theme" : "Switch to light theme");
        });
    }
    function init() {
        syncThemeIcons();
        document.addEventListener("themechange", syncThemeIcons);
        if (typeof MutationObserver !== "undefined") new MutationObserver(records => {
            if (records.some(r => r.type === "attributes" && r.attributeName === "data-theme")) syncThemeIcons();
        }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
