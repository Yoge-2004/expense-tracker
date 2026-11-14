/**
 * Accessible Dialog & Modal Focus Trap (WCAG 2.1 AA & Nielsen Heuristics #3, #5)
 * Manages keyboard focus trapping, Escape dismissal, and accessible confirmation dialogs.
 */
(function(global) {
    "use strict";

    const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    let lastFocusedElement = null;
    let activeTrapCleanup = null;

    /**
     * Traps keyboard focus inside a modal element.
     * @param {HTMLElement} modalEl
     * @param {Function} [onClose]
     */
    function trapFocus(modalEl, onClose) {
        if (!modalEl) return () => {};

        lastFocusedElement = document.activeElement;
        modalEl.setAttribute("role", "dialog");
        modalEl.setAttribute("aria-modal", "true");

        const focusables = Array.from(modalEl.querySelectorAll(FOCUSABLE_SELECTOR));
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (first) {
            first.focus();
        } else {
            modalEl.setAttribute("tabindex", "-1");
            modalEl.focus();
        }

        function handleKeyDown(e) {
            if (e.key === "Escape") {
                e.preventDefault();
                if (typeof onClose === "function") onClose();
                return;
            }

            if (e.key === "Tab") {
                const currentFocusables = Array.from(modalEl.querySelectorAll(FOCUSABLE_SELECTOR));
                if (currentFocusables.length === 0) return;
                const firstEl = currentFocusables[0];
                const lastEl = currentFocusables[currentFocusables.length - 1];

                if (e.shiftKey) {
                    if (document.activeElement === firstEl) {
                        e.preventDefault();
                        lastEl.focus();
                    }
                } else {
                    if (document.activeElement === lastEl) {
                        e.preventDefault();
                        firstEl.focus();
                    }
                }
            }
        }

        document.addEventListener("keydown", handleKeyDown);

        const cleanup = () => {
            document.removeEventListener("keydown", handleKeyDown);
            if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
                lastFocusedElement.focus();
            }
            activeTrapCleanup = null;
        };

        activeTrapCleanup = cleanup;
        return cleanup;
    }

    /**
     * Show an accessible confirmation dialog with focus trap and keyboard control.
     * @param {Object} options
     * @param {string} options.title
     * @param {string} options.message
     * @param {string} [options.confirmText="Confirm"]
     * @param {string} [options.cancelText="Cancel"]
     * @param {boolean} [options.isDestructive=false]
     * @returns {Promise<boolean>}
     */
    function confirmDialog(options = {}) {
        return new Promise((resolve) => {
            const title = options.title || "Confirm Action";
            const message = options.message || "Are you sure you want to proceed?";
            const confirmText = options.confirmText || "Confirm";
            const cancelText = options.cancelText || "Cancel";
            const isDestructive = !!options.isDestructive;

            const overlay = document.createElement("div");
            overlay.className = "modal-overlay accessible-dialog-overlay active";
            overlay.setAttribute("role", "dialog");
            overlay.setAttribute("aria-modal", "true");
            overlay.setAttribute("aria-labelledby", "accDialogTitle");
            overlay.setAttribute("aria-describedby", "accDialogDesc");

            const dialog = document.createElement("div");
            dialog.className = "modal modal-card accessible-dialog-card";

            dialog.innerHTML = `
                <div class="modal-header">
                    <h3 id="accDialogTitle" class="admin-title-1">${escapeHtml(title)}</h3>
                    <button type="button" class="modal-close" aria-label="Close dialog">&times;</button>
                </div>
                <div class="modal-body">
                    <p id="accDialogDesc" class="text-muted" style="margin-bottom: 0;">${escapeHtml(message)}</p>
                </div>
                <div class="modal-footer" style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px;">
                    <button type="button" class="btn-secondary dialog-cancel-btn">${escapeHtml(cancelText)}</button>
                    <button type="button" class="btn-primary ${isDestructive ? 'btn-danger' : ''} dialog-confirm-btn">${escapeHtml(confirmText)}</button>
                </div>
            `;

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            function closeWithResult(result) {
                cleanup();
                overlay.classList.remove("active");
                setTimeout(() => overlay.remove(), 200);
                resolve(result);
            }

            const cleanup = trapFocus(dialog, () => closeWithResult(false));

            dialog.querySelector(".modal-close").addEventListener("click", () => closeWithResult(false));
            dialog.querySelector(".dialog-cancel-btn").addEventListener("click", () => closeWithResult(false));
            dialog.querySelector(".dialog-confirm-btn").addEventListener("click", () => closeWithResult(true));
            overlay.addEventListener("click", (e) => {
                if (e.target === overlay) closeWithResult(false);
            });
        });
    }

    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    const AccessibleDialog = {
        trapFocus,
        confirm: confirmDialog
    };

    global.AccessibleDialog = AccessibleDialog;

})(typeof window !== "undefined" ? window : globalThis);
