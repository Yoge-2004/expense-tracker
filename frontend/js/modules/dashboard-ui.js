/* Dashboard UI primitives: modal lifecycle, accessible focus trapping, and scroll locking. */
(function (global) {
    "use strict";

    const FOCUSABLE_SELECTOR = 'button:not([disabled]):not([hidden]), [href], input:not([disabled]):not([hidden]):not([type="hidden"]), select:not([disabled]):not([hidden]), textarea:not([disabled]):not([hidden]), [tabindex]:not([tabindex="-1"])';

    function trapFocus(modalEl, event) {
        if (event.key !== "Tab") return;

        const focusables = Array.from(modalEl.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
            el => el.offsetParent !== null && window.getComputedStyle(el).visibility !== "hidden"
        );
        if (focusables.length === 0) {
            event.preventDefault();
            return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (event.shiftKey) {
            if (document.activeElement === first || !modalEl.contains(document.activeElement)) {
                event.preventDefault();
                last.focus();
            }
        } else {
            if (document.activeElement === last || !modalEl.contains(document.activeElement)) {
                event.preventDefault();
                first.focus();
            }
        }
    }

    function openModal(modalEl) {
        if (!modalEl) return;
        modalEl._previousActiveElement = document.activeElement;

        modalEl.removeAttribute("hidden");
        modalEl.setAttribute("aria-hidden", "false");
        modalEl.classList.add("active");
        document.body.classList.add("modal-open");
        document.documentElement.classList.add("modal-open");

        // Universal backdrop click to close
        if (!modalEl._backdropClickHandler) {
            modalEl._backdropClickHandler = (e) => {
                if (e.target === modalEl) {
                    closeModal(modalEl);
                }
            };
            modalEl.addEventListener("click", modalEl._backdropClickHandler);
        }

        // Attach focus trap handler
        if (!modalEl._focusTrapHandler) {
            modalEl._focusTrapHandler = (e) => trapFocus(modalEl, e);
            modalEl.addEventListener("keydown", modalEl._focusTrapHandler);
        }

        // Set initial focus to the first form input or first focusable button
        requestAnimationFrame(() => {
            const firstInput = modalEl.querySelector('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])');
            if (firstInput) {
                firstInput.focus();
            } else {
                const firstAny = modalEl.querySelector(FOCUSABLE_SELECTOR);
                if (firstAny) firstAny.focus();
            }
        });
    }

    function closeModal(modalEl) {
        if (!modalEl) return;
        modalEl.classList.remove("active");
        modalEl.setAttribute("aria-hidden", "true");
        if (modalEl.id === "monthlyReportModal") {
            document.body.classList.remove("report-preview-active");
        }

        if (modalEl._focusTrapHandler) {
            modalEl.removeEventListener("keydown", modalEl._focusTrapHandler);
            modalEl._focusTrapHandler = null;
        }

        if (!document.querySelector(".modal-overlay.active, .command-palette-overlay.open")) {
            document.body.classList.remove("modal-open");
            document.documentElement.classList.remove("modal-open");
        }

        // Restore keyboard focus to element that triggered the modal
        if (modalEl._previousActiveElement && typeof modalEl._previousActiveElement.focus === "function") {
            try {
                modalEl._previousActiveElement.focus();
            } catch (_) {}
            modalEl._previousActiveElement = null;
        }
    }


    // Defensive global scroll recovery listeners
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            const activeModals = document.querySelectorAll(".modal-overlay.active");
            if (activeModals.length > 0) {
                activeModals.forEach(m => closeModal(m));
            } else {
                document.body.classList.remove("modal-open");
                document.documentElement.classList.remove("modal-open");
            }
        }
    });

    document.addEventListener("pointerdown", () => {
        if (!document.querySelector(".modal-overlay.active, .command-palette-overlay.open")) {
            if (document.body.classList.contains("modal-open") || document.documentElement.classList.contains("modal-open")) {
                document.body.classList.remove("modal-open");
                document.documentElement.classList.remove("modal-open");
            }
        }
    });

    global.openModal = openModal;
    global.closeModal = closeModal;
})(typeof window !== "undefined" ? window : this);
