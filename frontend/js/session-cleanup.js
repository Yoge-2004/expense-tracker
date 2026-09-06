// Keep logout focused on authentication state. Preferences and dashboard caches remain available after sign-out.
(function () {
    const clearAuthSession = () => {
        ["token", "userId", "userName", "userEmail"].forEach((key) => localStorage.removeItem(key));
        window.location.href = "index.html";
    };

    const attach = () => {
        const logoutBtn = document.getElementById("logoutBtn");
        if (!logoutBtn || logoutBtn.dataset.sessionCleanupAttached === "true") return;

        logoutBtn.dataset.sessionCleanupAttached = "true";
        logoutBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            clearAuthSession();
        }, true);
    };

    // dashboard.js registers its own logout handler later. Capture phase lets this
    // handler run first without modifying the large dashboard controller file.
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", attach, { once: true });
    } else {
        attach();
    }
})();
