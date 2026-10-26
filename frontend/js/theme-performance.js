/*
 * Theme performance guard.
 *
 * The dashboard can contain a large expense ledger. A theme toggle changes
 * shared CSS variables, so animating every matching node at the same time
 * creates a large paint/compositing burst. We make the theme swap atomic:
 * transitions are suppressed during the switch frame window, then normal
 * hover/focus motion resumes.
 */
(function () {
    "use strict";

    const THEME_SWITCH_CLASS = "theme-switching";
    let switchTimer = null;

    function beginThemeSwitch() {
        document.documentElement.classList.add(THEME_SWITCH_CLASS);
        clearTimeout(switchTimer);
        switchTimer = setTimeout(() => {
            document.documentElement.classList.remove(THEME_SWITCH_CLASS);
        }, 120);
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
            beginThemeSwitch();
        });
    }
})();
