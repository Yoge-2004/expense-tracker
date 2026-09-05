// Public Google OAuth 2.0 Client ID (safe to expose client-side — it identifies
// the app, it does not authenticate anything by itself).
//
// Get one at https://console.cloud.google.com/apis/credentials
// -> Create Credentials -> OAuth client ID -> Web application
// -> add this site's URL under "Authorized JavaScript origins".
//
// Until this is set, the "Continue with Google" button shows a setup notice
// instead of silently pretending to sign the user in.
const GOOGLE_CLIENT_ID = "487469737581-k1idcre171eknatam925igofmc6jtk00.apps.googleusercontent.com";

/* Theme-performance guard: keep the existing visual design, but avoid
   animating dozens of DOM surfaces independently during a theme switch. */
(function installThemePerformanceGuard() {
    if (typeof document === "undefined") return;

    if (!document.getElementById("theme-performance-guard")) {
        const style = document.createElement("style");
        style.id = "theme-performance-guard";
        style.textContent = `
            /* Theme swaps should not trigger per-element transition work. */
            body,
            .dashboard-container,
            .auth-page,
            .auth-card,
            .metric-card,
            .chart-card,
            .transactions-card,
            .budget-card,
            .modal,
            .top-bar,
            .form-input,
            select,
            input,
            .stat-card,
            .card,
            .float-card,
            .perk-item,
            .recent-transactions,
            .profile-menu,
            html[data-theme="light"] *,
            html[data-theme="dark"] * {
                transition-property: none !important;
                transition-duration: 0s !important;
            }

            /* Cross-fade two browser-composited page snapshots instead. */
            ::view-transition-group(root) {
                animation-duration: 180ms;
                animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
            }
            ::view-transition-old(root),
            ::view-transition-new(root) {
                animation-duration: 180ms;
                animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
                mix-blend-mode: normal;
            }

            @media (prefers-reduced-motion: reduce) {
                ::view-transition-group(root),
                ::view-transition-old(root),
                ::view-transition-new(root) {
                    animation-duration: 0.01ms !important;
                }
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    /* Install in capture phase so the legacy button handlers are wrapped by
       one browser-level transition rather than causing a second theme swap. */
    document.addEventListener("click", function (event) {
        const trigger = event.target && event.target.closest
            ? event.target.closest(".theme-toggle-btn, #themeToggle")
            : null;
        if (!trigger) return;

        event.preventDefault();
        event.stopImmediatePropagation();

        const applyTheme = () => {
            if (typeof window.toggleGlobalTheme === "function") {
                window.toggleGlobalTheme();
                return;
            }

            const html = document.documentElement;
            const next = html.getAttribute("data-theme") === "light" ? "dark" : "light";
            html.setAttribute("data-theme", next);
            if (document.body) document.body.setAttribute("data-theme", next);
            try { localStorage.setItem("theme", next); } catch (_) {}
        };

        try {
            if (typeof document.startViewTransition === "function" &&
                !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
                document.startViewTransition(applyTheme);
            } else {
                applyTheme();
            }
        } catch (_) {
            applyTheme();
        }
    }, true);
})();
