/**
 * UI Feedback & Notifications Service (Single Responsibility & Nielsen Usability Heuristics)
 * Manages accessible toasts, undo actions, loading indicators, and screen reader announcements.
 */
(function(global) {
    "use strict";

    let loadingTimer = null;

    function ensureFeedbackUi() {
        const allPresent = document.getElementById("appToastRegion")
            && document.getElementById("appLoading")
            && document.getElementById("serverStatusBadge")
            && document.getElementById("srAnnouncer");
        if (allPresent) return;

        if (!document.getElementById("srAnnouncer")) {
            const announcer = document.createElement("div");
            announcer.id = "srAnnouncer";
            announcer.className = "sr-only";
            announcer.setAttribute("aria-live", "polite");
            announcer.setAttribute("aria-atomic", "true");
            document.body.appendChild(announcer);
        }

        if (!document.getElementById("appToastRegion")) {
            const toastRegion = document.createElement("div");
            toastRegion.id = "appToastRegion";
            toastRegion.className = "toast-region";
            toastRegion.setAttribute("aria-live", "polite");
            toastRegion.setAttribute("aria-atomic", "true");
            document.body.appendChild(toastRegion);
        }

        if (!document.getElementById("appLoading")) {
            const loading = document.createElement("div");
            loading.id = "appLoading";
            loading.className = "app-loading";
            loading.setAttribute("aria-live", "polite");
            loading.setAttribute("aria-busy", "true");
            loading.innerHTML = `
                <div class="immersive-loader-card">
                    <div class="immersive-halo-wrap">
                        <div class="immersive-radiant-glow"></div>
                        <div class="immersive-ring-outer"></div>
                        <div class="immersive-ring-inner"></div>
                        <div class="immersive-core">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <polygon points="6 3 18 3 22 9 12 22 2 9 6 3"></polygon>
                            </svg>
                        </div>
                    </div>
                    <div class="loading-body api-loading-body">
                        <span id="loadingText" class="immersive-loading-text">Connecting to server…</span>
                        <span class="immersive-loading-sub">Secured Ledger Synchronization</span>
                        <div id="loadingProgressTrack" class="loading-progress-track">
                            <div id="loadingProgressBar" class="loading-progress-bar"></div>
                        </div>
                    </div>
                </div>`;
            document.body.appendChild(loading);
        }

        if (!document.getElementById("serverStatusBadge")) {
            const badge = document.createElement("div");
            badge.id = "serverStatusBadge";
            badge.className = "server-status-badge online";
            badge.title = "Server Status";
            badge.innerHTML = `<span class="status-dot"></span><span id="statusText">Connected</span>`;
            document.body.appendChild(badge);
        }
    }

    /**
     * Announce text to screen readers.
     * @param {string} message
     */
    function announceToScreenReader(message) {
        ensureFeedbackUi();
        const announcer = document.getElementById("srAnnouncer");
        if (announcer) {
            announcer.textContent = "";
            setTimeout(() => {
                announcer.textContent = message;
            }, 50);
        }
    }

    /**
     * Display accessible toast with optional undo action (Nielsen Heuristic #3).
     * @param {string} msg
     * @param {"info"|"success"|"error"|"warning"} [type="info"]
     * @param {number} [duration=3500]
     * @param {string} [actionLabel]
     * @param {Function} [onAction]
     */
    function showToast(msg, type = "info", duration = 3500, actionLabel = null, onAction = null) {
        ensureFeedbackUi();
        const region = document.getElementById("appToastRegion");
        if (!region) return;

        const toast = document.createElement("div");
        toast.className = `toast toast-${type}`;
        toast.setAttribute("role", "status");

        const msgSpan = document.createElement("span");
        msgSpan.className = "toast-message";
        msgSpan.textContent = msg;
        toast.appendChild(msgSpan);

        if (actionLabel && typeof onAction === "function") {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "toast-action-btn";
            btn.textContent = actionLabel;
            btn.addEventListener("click", () => {
                try {
                    onAction();
                } finally {
                    dismissToast(toast);
                }
            });
            toast.appendChild(btn);
        }

        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.className = "toast-close-btn";
        closeBtn.setAttribute("aria-label", "Close notification");
        closeBtn.innerHTML = "&times;";
        closeBtn.addEventListener("click", () => dismissToast(toast));
        toast.appendChild(closeBtn);

        region.appendChild(toast);
        announceToScreenReader(msg);

        // Animate in
        requestAnimationFrame(() => {
            toast.classList.add("toast-visible");
        });

        // Auto dismiss
        if (duration > 0) {
            setTimeout(() => dismissToast(toast), duration);
        }
    }

    function dismissToast(toast) {
        if (!toast || !toast.parentNode) return;
        toast.classList.remove("toast-visible");
        toast.classList.add("toast-hiding");
        setTimeout(() => toast.remove(), 250);
    }

    function updateServerStatus(online, message = "Connected") {
        ensureFeedbackUi();
        const badge = document.getElementById("serverStatusBadge");
        const text = document.getElementById("statusText");
        if (badge && text) {
            badge.className = `server-status-badge ${online ? "online" : "offline"}`;
            text.textContent = online ? "Connected" : message;
        }
        if (online) {
            document.body.classList.remove("server-offline");
        } else {
            document.body.classList.add("server-offline");
        }
    }

    function setProgress(percent, customText) {
        ensureFeedbackUi();
        const loader = document.getElementById("appLoading");
        const loadingText = document.getElementById("loadingText");
        const bar = document.getElementById("loadingProgressBar");

        clearTimeout(loadingTimer);
        if (!loader) return;

        if (customText && loadingText) {
            loadingText.textContent = customText;
        }

        if (percent > 0 && percent < 100) {
            loader.classList.add("active");
            if (bar) bar.style.width = `${percent}%`;
        } else if (percent >= 100) {
            if (bar) bar.style.width = "100%";
            loadingTimer = setTimeout(() => {
                loader.classList.remove("active");
                if (bar) bar.style.width = "0%";
            }, 300);
        } else {
            loader.classList.remove("active");
            if (bar) bar.style.width = "0%";
        }
    }

    const UiFeedback = {
        ensureFeedbackUi,
        announceToScreenReader,
        showToast,
        updateServerStatus,
        setProgress
    };

    global.UiFeedback = UiFeedback;
    global.showToast = showToast;
    global.updateServerStatus = updateServerStatus;
    global.setProgress = setProgress;
    global.ensureFeedbackUi = ensureFeedbackUi;
    global.announceToScreenReader = announceToScreenReader;

})(typeof window !== "undefined" ? window : globalThis);
