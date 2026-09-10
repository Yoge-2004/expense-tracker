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
})();