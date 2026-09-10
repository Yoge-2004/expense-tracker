/* Dashboard UI primitives: modal lifecycle and scroll locking. */
(function () {
    "use strict";

    function openModal(modalEl) {
        if (!modalEl) return;
        modalEl.classList.add("active");
        document.body.classList.add("modal-open");
    }

    function closeModal(modalEl) {
        if (!modalEl) return;
        modalEl.classList.remove("active");
        if (!document.querySelector(".modal-overlay.active")) {
            document.body.classList.remove("modal-open");
        }
    }

    window.openModal = openModal;
    window.closeModal = closeModal;
})();
