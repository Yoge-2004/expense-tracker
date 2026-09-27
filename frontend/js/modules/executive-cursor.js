/**
 * Executive Precision HUD Reticle Cursor Companion.
 * Enhances desktop navigation with a fluid geometric tracking reticle.
 * Automatically disabled on touch screens / mobile devices.
 */
(function (global) {
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

        // Animate loop with subtle dampening for a tactile feel
        function render() {
            if (isMoving) {
                // Smooth interpolation (lerp factor 0.35)
                currentX += (targetX - currentX) * 0.35;
                currentY += (targetY - currentY) * 0.35;

                // Center reticle around pointer
                const halfW = reticleEl.offsetWidth / 2;
                const halfH = reticleEl.offsetHeight / 2;
                reticleEl.style.transform = `translate3d(${currentX - halfW}px, ${currentY - halfH}px, 0)`;
            }
            requestAnimationFrame(render);
        }
        requestAnimationFrame(render);

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

        // Mouse Down / Up
        document.addEventListener("mousedown", () => {
            reticleEl.classList.add("is-down");
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
            } else if (target.closest("a, button, [role='button'], .tab-item, .card, .clickable, .metric-card, .receipt-breakdown-pill, select")) {
                reticleEl.classList.add("is-hovering");
                reticleEl.classList.remove("is-text");
            } else {
                reticleEl.classList.remove("is-hovering", "is-text");
            }
        }, { passive: true });

        isInitialized = true;
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initReticle);
    } else {
        initReticle();
    }
})(typeof window !== "undefined" ? window : this);
