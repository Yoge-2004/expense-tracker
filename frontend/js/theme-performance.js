/*
 * Theme performance guard.
 *
 * The dashboard can contain a large expense ledger. A theme toggle changes
 * shared CSS variables, so animating every matching node at the same time
 * creates a large paint/compositing burst. We make the theme swap atomic:
 * transitions are suppressed for the two frames around the actual toggle,
 * then normal hover/focus motion resumes.
 *
 * Font cache-busting lives directly on each page's Google Fonts <link href>
 * (?v=...) rather than here: rewriting the href from JS after the browser
 * had already started fetching the original URL forced a second, redundant
 * fetch of the whole font stylesheet on every page load.
 */
(function () {
    "use strict";

    const THEME_SWITCH_CLASS = "theme-switching";

    function beginThemeSwitch() {
        document.documentElement.classList.add(THEME_SWITCH_CLASS);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                document.documentElement.classList.remove(THEME_SWITCH_CLASS);
            });
        });
    }

    if (typeof window !== "undefined") {
        window.beginThemeSwitch = beginThemeSwitch;
    }

    if (typeof document !== "undefined") {
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
