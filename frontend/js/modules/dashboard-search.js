/* Dashboard search/shortcut controller. */
(function () {
    "use strict";

    const searchInput = () => document.getElementById("filterSearch");
    const isMacPlatform = /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    const kbdBadge = document.querySelector(".command-kbd");
    let resizeFrameId = null;

    if (kbdBadge) kbdBadge.textContent = isMacPlatform ? "⌘K" : "Ctrl K";

    function updateSearchPlaceholder() {
        const input = searchInput();
        if (!input) return;
        if (window.innerWidth <= 600) {
            input.placeholder = "Search expenses & incomes...";
        } else {
            input.placeholder = isMacPlatform
                ? "Search expenses & incomes (Press / or ⌘K)..."
                : "Search expenses & incomes (Press / or Ctrl+K)...";
        }
    }

    function schedulePlaceholderUpdate() {
        if (resizeFrameId !== null) return;
        resizeFrameId = requestAnimationFrame(() => {
            resizeFrameId = null;
            updateSearchPlaceholder();
        });
    }

    window.addEventListener("resize", schedulePlaceholderUpdate, { passive: true });
    updateSearchPlaceholder();

    window.addEventListener("keydown", (event) => {
        const isK = event.key === "k" || event.key === "K" || event.code === "KeyK";
        if ((event.metaKey || event.ctrlKey) && isK) {
            event.preventDefault();
            event.stopPropagation();
            const input = searchInput();
            if (input) {
                input.focus();
                input.select();
            }
            return;
        }

        if (event.key === "/") {
            const activeEl = document.activeElement;
            const isEditing = activeEl && (
                activeEl.tagName === "INPUT" ||
                activeEl.tagName === "TEXTAREA" ||
                activeEl.tagName === "SELECT" ||
                activeEl.isContentEditable
            );
            if (!isEditing) {
                event.preventDefault();
                const input = searchInput();
                if (input) {
                    input.focus();
                    input.select();
                }
                return;
            }
        }

        const input = searchInput();
        if (event.key === "Escape" && document.activeElement === input) {
            if (input.value) {
                input.value = "";
                input.dispatchEvent(new Event("input", { bubbles: true }));
            } else {
                input.blur();
            }
        }
    }, { capture: true });
})();
