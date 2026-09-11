/* Keep theme switching visually immediate instead of animating expensive page effects. */
(function () {
    "use strict";

    const root = document.documentElement;
    let releaseTimer = null;

    function armThemeGuard() {
        root.classList.add("theme-transitioning");
        clearTimeout(releaseTimer);

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                releaseTimer = setTimeout(() => {
                    root.classList.remove("theme-transitioning");
                }, 180);
            });
        });
    }

    document.addEventListener("click", (event) => {
        const toggle = event.target.closest?.(".theme-toggle-btn, #themeToggle");
        if (toggle) armThemeGuard();
    }, true);

    document.addEventListener("themechange", armThemeGuard, true);

    // Metric cards are small, high-value surfaces and should retain their normal
    // theme transition while the rest of the page is guarded for performance.
    // Keep entrance/interaction animations paused; only opt these cards back into
    // color/background/border/shadow transitions during the theme switch.
    const style = document.createElement("style");
    style.id = "metric-theme-transition-override";
    style.textContent = `
        html.theme-transitioning .grid-4-metrics > .metric-card {
            transition: background-color 0.24s cubic-bezier(0.4, 0, 0.2, 1),
                        border-color 0.24s cubic-bezier(0.4, 0, 0.2, 1),
                        box-shadow 0.24s cubic-bezier(0.4, 0, 0.2, 1),
                        color 0.2s ease !important;
        }

        html.theme-transitioning .grid-4-metrics > .metric-card .card-label,
        html.theme-transitioning .grid-4-metrics > .metric-card .metric-value,
        html.theme-transitioning .grid-4-metrics > .metric-card .status-badge,
        html.theme-transitioning .grid-4-metrics > .metric-card .metric-footer,
        html.theme-transitioning .grid-4-metrics > .metric-card .metric-footer *,
        html.theme-transitioning .grid-4-metrics > .metric-card .text-muted,
        html.theme-transitioning .grid-4-metrics > .metric-card .link-action {
            transition: color 0.2s ease,
                        background-color 0.24s cubic-bezier(0.4, 0, 0.2, 1),
                        border-color 0.24s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
    `;
    (document.head || document.documentElement).appendChild(style);
})();