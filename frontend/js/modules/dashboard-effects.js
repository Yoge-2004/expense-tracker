/* Dashboard rendering effects and lightweight view animations. */
(function () {
    "use strict";
    const { formatCurrency } = window.DashboardUtils;
    const elements = window.DashboardDom.elements;

    function animateNumber(el, target, isCurrency = false, showSign = false) {
        if (!el) return;
        const duration = 850;
        const startTime = performance.now();
        const startVal = parseFloat(el.getAttribute('data-val') || 0);
        el.setAttribute('data-val', target);

        function step(now) {
            const progress = Math.min((now - startTime) / duration, 1);
            const easeOutBack = 1 + 2.70158 * Math.pow(progress - 1, 3) + 1.70158 * Math.pow(progress - 1, 2);
            const current = startVal + (target - startVal) * Math.min(Math.max(easeOutBack, 0), 1);
            const sign = showSign ? (current < 0 ? "-" : "+") : "";
            el.textContent = isCurrency ? `${sign}${formatCurrency(Math.abs(current))}` : Math.round(current);
            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                const finalSign = showSign ? (target < 0 ? "-" : "+") : "";
                el.textContent = isCurrency ? `${finalSign}${formatCurrency(Math.abs(target))}` : target;
            }
        }
        requestAnimationFrame(step);
    }

    function animatePercent(el, target) {
        if (!el) return;
        const duration = 850;
        const startTime = performance.now();
        const startVal = parseFloat(el.getAttribute('data-val') || 0);
        el.setAttribute('data-val', target);

        function step(now) {
            const progress = Math.min((now - startTime) / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const current = startVal + (target - startVal) * easeOut;
            el.textContent = `${current.toFixed(1)}%`;
            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                el.textContent = `${target.toFixed(1)}%`;
            }
        }
        requestAnimationFrame(step);
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
        } catch (e) {}
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
