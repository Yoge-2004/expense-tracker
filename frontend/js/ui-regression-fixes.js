/* Runtime synchronization for theme controls; suppress the idle dashboard re-render loop. */
(function installUiRegressionFixes() {
    "use strict";

    function syncThemeIcons() {
        const rootTheme = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
        if (typeof window.updateAllThemeIcons === "function") {
            window.updateAllThemeIcons(rootTheme);
            return;
        }
        document.querySelectorAll(".theme-toggle-btn, #themeToggle").forEach((button) => {
            const sun = button.querySelector(".sun-icon");
            const moon = button.querySelector(".moon-icon");
            if (!sun || !moon) return;
            const isLight = rootTheme === "light";
            sun.style.display = isLight ? "none" : "block";
            moon.style.display = isLight ? "block" : "none";
            button.setAttribute("aria-label", isLight ? "Switch to dark theme" : "Switch to light theme");
            button.setAttribute("title", isLight ? "Switch to dark theme" : "Switch to light theme");
        });
    }

    function installThemeObserver() {
        syncThemeIcons();
        document.addEventListener("themechange", syncThemeIcons);
        if (typeof MutationObserver !== "undefined") {
            new MutationObserver((records) => {
                if (records.some((record) => record.type === "attributes" && record.attributeName === "data-theme")) {
                    syncThemeIcons();
                }
            }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
        }
    }

    function installDashboardTimerGuard() {
        const nativeSetInterval = window.setInterval;
        if (nativeSetInterval.__expenseTrackerGuard) return;
        function guardedSetInterval(callback, delay, ...args) {
            if (delay === 25000 && typeof callback === "function" && /loadDashboard\s*\(\s*true\s*\)/.test(Function.prototype.toString.call(callback))) {
                return 0;
            }
            return nativeSetInterval.call(window, callback, delay, ...args);
        }
        guardedSetInterval.__expenseTrackerGuard = true;
        window.setInterval = guardedSetInterval;
    }

    function init() {
        installThemeObserver();
        installDashboardTimerGuard();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
