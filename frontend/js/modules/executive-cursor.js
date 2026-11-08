/**
 * Executive Precision HUD Reticle Cursor Companion.
 * Enhances desktop navigation with a fluid geometric tracking reticle.
 * Automatically disabled on touch screens / mobile devices.
 */
(function () {
    "use strict";

    if (typeof window === "undefined" || typeof document === "undefined") return;

    // Disable completely on touch devices or fine pointer absent
    if (window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window) {
        return;
    }

    let reticleEl = null;
    let targetX = -100;
    let targetY = -100;
    let currentX = -100;
    let currentY = -100;
    let isMoving = false;
    let isInitialized = false;

    function initReticle() {
        if (isInitialized) return;
        reticleEl = document.getElementById("executiveReticle");
        if (!reticleEl) {
            reticleEl = document.createElement("div");
            reticleEl.id = "executiveReticle";
            reticleEl.className = "executive-reticle";
            reticleEl.setAttribute("aria-hidden", "true");
            reticleEl.innerHTML = `
                <span class="reticle-corner reticle-tl"></span>
                <span class="reticle-corner reticle-tr"></span>
                <span class="reticle-corner reticle-br"></span>
                <span class="reticle-corner reticle-bl"></span>
                <span class="reticle-center-accent"></span>
            `;
            document.body.appendChild(reticleEl);
        }

        let rafId = null;
        // Animate loop with subtle dampening for a tactile feel. Stops RAF when at rest to eliminate idle CPU/GPU usage.
        function render() {
            if (isMoving) {
                const dx = targetX - currentX;
                const dy = targetY - currentY;

                if (Math.abs(dx) < 0.25 && Math.abs(dy) < 0.25) {
                    currentX = targetX;
                    currentY = targetY;
                    reticleEl.style.transform = `translate3d(${currentX - 11}px, ${currentY - 11}px, 0)`;
                    rafId = null;
                    return; // Rest reached, stop RAF until next mousemove
                }

                currentX += dx * 0.35;
                currentY += dy * 0.35;
                reticleEl.style.transform = `translate3d(${currentX - 11}px, ${currentY - 11}px, 0)`;
            }
            rafId = requestAnimationFrame(render);
        }

        function wakeReticle() {
            if (!rafId) {
                rafId = requestAnimationFrame(render);
            }
        }

        // Document mouse movement
        document.addEventListener("mousemove", (e) => {
            targetX = e.clientX;
            targetY = e.clientY;
            if (!isMoving) {
                currentX = targetX;
                currentY = targetY;
                isMoving = true;
                reticleEl.classList.add("active");
            }
            wakeReticle();
        }, { passive: true });

        // Document mouse leave/enter window
        document.addEventListener("mouseleave", () => {
            reticleEl.classList.remove("active");
            isMoving = false;
        });

        document.addEventListener("mouseenter", () => {
            reticleEl.classList.add("active");
            isMoving = true;
        });

        // Tactical Click Shockwave Effect
        function triggerClickRipple(x, y) {
            const ripple = document.createElement("div");
            ripple.className = "reticle-click-shockwave";
            ripple.style.cssText = "position:fixed; left:" + x + "px; top:" + y + "px; width:12px; height:12px; margin-left:-6px; margin-top:-6px; border-radius:50%; border:2px solid var(--primary, #D4AF37); pointer-events:none; z-index:99998; box-shadow:0 0 14px var(--primary, #D4AF37); animation:reticleBurst 0.35s cubic-bezier(0.16,1,0.3,1) forwards;";
            document.body.appendChild(ripple);
            setTimeout(() => ripple.remove(), 380);
        }

        // Mouse Down / Up
        document.addEventListener("mousedown", (e) => {
            reticleEl.classList.add("is-down");
            triggerClickRipple(e.clientX, e.clientY);
        }, { passive: true });

        document.addEventListener("mouseup", () => {
            reticleEl.classList.remove("is-down");
        }, { passive: true });

        // Event delegation for hover states
        document.addEventListener("mouseover", (e) => {
            const target = e.target;
            if (!target || !(target instanceof Element)) return;

            if (target.closest("input, textarea, [contenteditable='true']")) {
                reticleEl.classList.add("is-text");
                reticleEl.classList.remove("is-hovering");
            } else {
                const isClickable = Boolean(target.closest("a, button, [role='button'], select, label, summary, [onclick], .tab-item, .card, .clickable, .metric-card, .receipt-breakdown-pill, .expense-item, tr, .pill-chip, .loan-tab-btn, .period-chip, .period-month-chip, .budget-item, .savings-goal-card, .insight-card-item, .header-action-btn, .btn, .loan-metric-card, .chart-card, .stat-card, .empty-state-luxury, .preset-btn, .cal-nav-btn, .cal-day-cell, .custom-select-trigger, .custom-option, .avatar, .input-eye, .stealth-toggle-btn, .bi-action-btn, .bi-slicer-pill, .bi-reset-slicers-btn"));
                if (isClickable) {
                    reticleEl.classList.add("is-hovering");
                    reticleEl.classList.remove("is-text");
                } else {
                    reticleEl.classList.remove("is-hovering", "is-text");
                }
            }
        }, { passive: true });

        isInitialized = true;
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initReticle);
    } else {
        initReticle();
    }
})();
