/*
 * Theme performance guard.
 *
 * The dashboard can contain a large expense ledger. A theme toggle changes
 * shared CSS variables, so animating every matching node at the same time
 * creates a large paint/compositing burst. We make the theme swap atomic:
 * transitions are suppressed for the two frames around the actual toggle,
 * then normal hover/focus motion resumes.
 *
 * This file also cache-busts the explicit Google Fonts stylesheet once per
 * page load so an older cached font CSS response cannot silently keep the
 * dashboard on its fallback font after the typography was restored.
 */
(function () {
    "use strict";

    const THEME_SWITCH_CLASS = "theme-switching";
    const FONT_CACHE_BUSTER = "20260914-font1";

    function cacheBustGoogleFonts() {
        if (typeof document === "undefined") return;
        document.querySelectorAll('link[rel="stylesheet"][href*="fonts.googleapis.com/css2"]').forEach((link) => {
            const href = link.getAttribute("href");
            if (!href || href.includes(FONT_CACHE_BUSTER)) return;
            const separator = href.includes("?") ? "&" : "?";
            link.setAttribute("href", `${href}${separator}v=${FONT_CACHE_BUSTER}`);
        });
    }

    function beginThemeSwitch() {
        document.documentElement.classList.add(THEME_SWITCH_CLASS);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                document.documentElement.classList.remove(THEME_SWITCH_CLASS);
            });
        });
    }

    if (typeof document !== "undefined") {
        cacheBustGoogleFonts();

        // Capture phase runs before the existing theme button listener in api.js.
        document.addEventListener("click", (event) => {
            const target = event.target instanceof Element ? event.target : null;
            const toggle = target?.closest("#themeToggle, .theme-toggle-btn");
            if (toggle) beginThemeSwitch();
        }, true);

        // Programmatic theme changes also get the same guard.
        document.addEventListener("themechange", () => {
            if (!document.documentElement.classList.contains(THEME_SWITCH_CLASS)) {
                requestAnimationFrame(() => {
                    document.documentElement.classList.remove(THEME_SWITCH_CLASS);
                });
            }
        });
    }
})();
