/*
 * Performance guard. Loaded in <head> on every page, before anything animates.
 *
 * Decides between two modes and exposes it as window.PerfMode:
 *   full  every animation as designed (capable desktops);
 *   lite  the canvas background is replaced by a transform-only drift of the CSS wash, the blur on
 *         repeated cards is dropped, and count-ups / chart entrances are shortened. Animations are NOT
 *         removed. Lite is chosen for phones and touch devices, prefers-reduced-motion, data-saver, very
 *         low-end hardware, and any device whose measured frame rate is poor.
 *
 * The heavy animations themselves (css/performance.css) are cheap in BOTH modes: they run on
 * transform / scale / opacity, or in quantised steps. Only prefers-reduced-motion removes motion.
 *
 * It also pauses CSS animations while the tab is hidden and for sections scrolled out of view, so
 * decorative loops stop costing GPU time that nobody can see.
 *
 * Override for testing: localStorage.perfMode = "lite" | "full" (remove the key to go back to automatic).
 */
(function () {
    "use strict";

    const root = document.documentElement;
    const LITE = "perf-lite";
    const nav = navigator;
    const automated = !!nav.webdriver; // keep scripted browsers deterministic: no hardware probing there

    function read(storage, key) {
        try { return window[storage].getItem(key); } catch (e) { return null; }
    }
    function write(storage, key, value) {
        try { window[storage].setItem(key, value); } catch (e) { /* storage can be blocked */ }
    }

    const reduceQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    const smallQuery = window.matchMedia ? window.matchMedia("(max-width: 768px), (pointer: coarse)") : null;

    let measuredSlow = read("sessionStorage", "perfSlow") === "1";

    function lowEndHardware() {
        if (automated) return false;
        const connection = nav.connection || {};
        return connection.saveData === true ||
            (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 2) ||
            (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 2);
    }

    function wantsLite() {
        const override = read("localStorage", "perfMode");
        if (override === "lite") return true;
        if (override === "full") return false;
        return !!(reduceQuery && reduceQuery.matches) ||
            !!(smallQuery && smallQuery.matches) ||
            measuredSlow ||
            lowEndHardware();
    }

    function apply() {
        const lite = wantsLite();
        if (root.classList.contains(LITE) === lite) return;
        root.classList.toggle(LITE, lite);
        document.dispatchEvent(new CustomEvent("perfmodechange", { detail: { lite } }));
    }

    window.PerfMode = Object.freeze({
        isLite: () => root.classList.contains(LITE),
        reducedMotion: () => !!(reduceQuery && reduceQuery.matches),
        refresh: apply,
    });

    apply();
    [reduceQuery, smallQuery].forEach((query) => {
        if (!query) return;
        if (typeof query.addEventListener === "function") query.addEventListener("change", apply);
        else if (typeof query.addListener === "function") query.addListener(apply);
    });

    // ---- Nothing animates while the tab is in the background ------------------------------------
    function syncHidden() {
        root.classList.toggle("page-hidden", document.hidden);
    }
    document.addEventListener("visibilitychange", syncHidden);
    syncHidden();

    // ---- Frame-rate probe: a device that cannot hold ~40 fps gets lite mode ------------------------
    function probeFrameRate() {
        if (automated || root.classList.contains(LITE) || read("localStorage", "perfMode")) return;
        if (read("sessionStorage", "perfProbe") === "ok" || typeof requestAnimationFrame !== "function") return;

        const deltas = [];
        let last = 0;
        function frame(now) {
            if (document.hidden) { return; } // inconclusive: try again on the next page load
            if (last) deltas.push(now - last);
            last = now;
            if (deltas.length < 70) { requestAnimationFrame(frame); return; }
            const sample = deltas.slice(10).sort((a, b) => a - b); // ignore the warm-up frames
            const median = sample[Math.floor(sample.length / 2)];
            if (median > 26) { // slower than ~38 fps
                measuredSlow = true;
                write("sessionStorage", "perfSlow", "1");
                apply();
            } else {
                write("sessionStorage", "perfProbe", "ok");
            }
        }
        requestAnimationFrame(frame);
    }

    // ---- Pause animations in sections that are scrolled out of view ---------------------------------
    const SECTION_SELECTOR = [
        "section", ".card", ".metric-card", ".unified-ledger-card", ".insight-card", ".trend-card",
        ".budget-section", ".savings-section", ".loans-section", ".recent-transactions", ".money-flow",
        ".insights-intelligence-panel", ".ai-intelligence-panel",
    ].join(",");

    let observer = null;
    const observed = new WeakSet();

    function observeSections() {
        if (typeof IntersectionObserver !== "function") return;
        if (!observer) {
            observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => entry.target.classList.toggle("perf-offscreen", !entry.isIntersecting));
            }, { rootMargin: "160px 0px" });
        }
        document.querySelectorAll(SECTION_SELECTOR).forEach((el) => {
            if (observed.has(el)) return;
            observed.add(el);
            observer.observe(el);
        });
    }

    function start() {
        observeSections();
        // Sections that render later (lazy panels) are picked up shortly after load.
        setTimeout(observeSections, 2500);
        setTimeout(observeSections, 9000);
        const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
        if (document.readyState === "complete") idle(probeFrameRate, { timeout: 4000 });
        else window.addEventListener("load", () => idle(probeFrameRate, { timeout: 4000 }), { once: true });
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
})();
