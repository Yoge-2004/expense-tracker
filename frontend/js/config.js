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
   animating many large DOM surfaces independently during a theme switch. */
(function installThemePerformanceGuard() {
    if (typeof document === "undefined") return;

    const style = document.createElement("style");
    style.id = "theme-performance-guard";
    style.textContent = `
        /* Disable only theme-transition work while the switch is executing.
           Normal hover/press/interactive transitions remain untouched. */
        html.theme-switching,
        html.theme-switching body,
        html.theme-switching .dashboard-container,
        html.theme-switching .auth-page,
        html.theme-switching .auth-card,
        html.theme-switching .metric-card,
        html.theme-switching .chart-card,
        html.theme-switching .transactions-card,
        html.theme-switching .budget-card,
        html.theme-switching .modal,
        html.theme-switching .top-bar,
        html.theme-switching .form-input,
        html.theme-switching select,
        html.theme-switching input,
        html.theme-switching .stat-card,
        html.theme-switching .card,
        html.theme-switching .float-card,
        html.theme-switching .perk-item,
        html.theme-switching .recent-transactions,
        html.theme-switching .profile-menu {
            transition-property: none !important;
            transition-duration: 0s !important;
        }

        /* Cross-fade browser snapshots instead of repainting every surface. */
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

    document.addEventListener("click", function (event) {
        const trigger = event.target && event.target.closest
            ? event.target.closest(".theme-toggle-btn, #themeToggle")
            : null;
        if (!trigger) return;

        event.preventDefault();
        event.stopImmediatePropagation();

        const root = document.documentElement;
        const applyTheme = () => {
            if (typeof window.toggleGlobalTheme === "function") {
                window.toggleGlobalTheme();
            } else {
                const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
                root.setAttribute("data-theme", next);
                if (document.body) document.body.setAttribute("data-theme", next);
                try { localStorage.setItem("theme", next); } catch (_) {}
            }
        };

        root.classList.add("theme-switching");

        try {
            if (typeof document.startViewTransition === "function" &&
                !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
                const transition = document.startViewTransition(applyTheme);
                transition.finished.finally(() => root.classList.remove("theme-switching"));
            } else {
                applyTheme();
                requestAnimationFrame(() => root.classList.remove("theme-switching"));
            }
        } catch (_) {
            applyTheme();
            requestAnimationFrame(() => root.classList.remove("theme-switching"));
        }
    }, true);
})();
