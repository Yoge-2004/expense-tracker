/* Dashboard rendering effects and lightweight view animations. */
(function () {
    "use strict";
    const { formatCurrency } = window.DashboardUtils;
    const elements = window.DashboardDom.elements;

    /*
     * Count-up animations. Each element has at most one running loop: a new call cancels the old one and
     * continues from the value currently on screen (the old code stacked a requestAnimationFrame loop per
     * call, which fought over the same text node when metrics refreshed quickly). A value that did not
     * change is written once with no animation. Lite devices (phones, slow machines) still animate, but
     * for 380 ms instead of 850 and at about 30 updates a second; only prefers-reduced-motion and hidden
     * tabs skip the animation.
     */
    const countRuns = new WeakMap();

    function motionAllowed() {
        const perf = window.PerfMode;
        if (document.hidden) return false;
        return !(perf && perf.reducedMotion());
    }

    function isLite() {
        return !!(window.PerfMode && window.PerfMode.isLite());
    }

    function runCount(el, target, ease, format, finalText) {
        const running = countRuns.get(el);
        if (running) cancelAnimationFrame(running.raf);
        const from = running ? running.current : (parseFloat(el.getAttribute('data-val')) || 0);
        el.setAttribute('data-val', target);

        if (from === target || !motionAllowed()) {
            countRuns.delete(el);
            el.textContent = finalText;
            return;
        }

        const state = { raf: 0, current: from };
        countRuns.set(el, state);
        const lite = isLite();
        const duration = lite ? 380 : 850;
        const minGap = lite ? 33 : 0; // ms between text updates
        const startTime = performance.now();
        let lastWrite = -Infinity;
        function step(now) {
            const progress = Math.min((now - startTime) / duration, 1);
            state.current = from + (target - from) * ease(progress);
            if (progress < 1) {
                if (now - lastWrite >= minGap) {
                    el.textContent = format(state.current);
                    lastWrite = now;
                }
                state.raf = requestAnimationFrame(step);
            } else {
                countRuns.delete(el);
                el.textContent = finalText;
            }
        }
        state.raf = requestAnimationFrame(step);
    }

    function animateNumber(el, target, isCurrency = false, showSign = false, suffix = "") {
        if (!el) return;
        const signOf = (value) => (showSign ? (value < 0 ? "-" : "+") : "");
        const format = (current) => {
            const body = isCurrency ? `${signOf(current)}${formatCurrency(Math.abs(current))}` : Math.round(current);
            return `${body}${suffix}`;
        };
        const finalBody = isCurrency ? `${signOf(target)}${formatCurrency(Math.abs(target))}` : target;
        const easeOutBack = (progress) => {
            const v = 1 + 2.70158 * Math.pow(progress - 1, 3) + 1.70158 * Math.pow(progress - 1, 2);
            return Math.min(Math.max(v, 0), 1);
        };
        runCount(el, target, easeOutBack, format, `${finalBody}${suffix}`);
    }

    function animatePercent(el, target) {
        if (!el) return;
        runCount(el, target, (progress) => 1 - Math.pow(1 - progress, 3),
            (current) => `${current.toFixed(1)}%`, `${target.toFixed(1)}%`);
    }

    function celebrateSuccess(x, y) {
        try {
            const count = 28;
            const colors = ["#10B981", "#3B82F6", "#F59E0B", "#8B5CF6", "#EC4899", "#34D399", "#60A5FA"];
            const container = document.createElement("div");
            container.style.position = "fixed";
            container.style.left = "0";
            container.style.top = "0";
            container.style.width = "100vw";
            container.style.height = "100vh";
            container.style.pointerEvents = "none";
            container.style.zIndex = "999999";
            document.body.appendChild(container);

            const spawnX = typeof x === "number" && !isNaN(x) && x > 0 ? x : window.innerWidth / 2;
            const spawnY = typeof y === "number" && !isNaN(y) && y > 0 ? y : window.innerHeight / 2;

            for (let i = 0; i < count; i++) {
                const p = document.createElement("div");
                const color = colors[Math.floor(Math.random() * colors.length)];
                const size = Math.floor(Math.random() * 8) + 6;
                const angle = Math.random() * Math.PI * 2;
                const velocity = Math.random() * 180 + 70;
                const destX = Math.cos(angle) * velocity;
                const destY = Math.sin(angle) * velocity + 45;
                const rotate = Math.random() * 720 - 360;

                p.style.position = "absolute";
                p.style.left = `${spawnX}px`;
                p.style.top = `${spawnY}px`;
                p.style.width = `${size}px`;
                p.style.height = `${size * (Math.random() > 0.5 ? 1 : 1.5)}px`;
                p.style.backgroundColor = color;
                p.style.borderRadius = Math.random() > 0.35 ? "2px" : "50%";
                p.style.opacity = "1";
                p.style.transition = "transform 0.85s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.85s ease-out";
                container.appendChild(p);

                requestAnimationFrame(() => {
                    p.style.transform = `translate(${destX}px, ${destY}px) rotate(${rotate}deg) scale(${Math.random() * 0.4 + 0.6})`;
                    p.style.opacity = "0";
                });
            }

            setTimeout(() => container.remove(), 950);
        } catch (e) { console.debug("[Effects] Particle fallback:", e.message); }
    }

    function updateStats(expenses) {
        const total = expenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
        animateNumber(elements.totalAmount, total, true);
        // Not animateNumber() here: it unconditionally writes a bare number
        // (e.g. "5") to the element's textContent, which would clobber the
        // "N transactions recorded" phrasing this element actually shows.
        // elements.expenseCount also pointed at a nonexistent "expenseCount" id
        // until now (the real element is #expenseCountText) — so before this
        // fix, this line silently did nothing at all on every filter change,
        // and the count only ever reflected whatever it was on initial load.
        if (elements.expenseCount) {
            const count = expenses.length;
            elements.expenseCount.textContent = `${count} transaction${count === 1 ? '' : 's'} recorded`;
        }
    }

    window.DashboardEffects = Object.freeze({ animateNumber, animatePercent, celebrateSuccess, updateStats });
    window.animateNumber = animateNumber;
    window.animatePercent = animatePercent;
    window.celebrateSuccess = celebrateSuccess;
    window.updateStats = updateStats;
})();
