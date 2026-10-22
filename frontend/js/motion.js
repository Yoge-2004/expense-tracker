/**
 * =============================================================================
 * Motion Engine — scroll reveal, touch feedback, pointer micro-interactions,
 * and ambient background depth layers.
 * Pairs with css/motion-extended.css (extended motion animations).
 * Self-contained: does nothing if its target elements aren't on the page.
 * Performance-hardened for mobile: zero-overhead execution on handheld devices.
 * =============================================================================
 */
(function () {
    'use strict';

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hasFinePointer = window.matchMedia('(pointer: fine)').matches;

    function isMobileOrTouch() {
        return window.innerWidth <= 768 ||
            (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
            (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 && window.innerWidth <= 1024);
    }

    function ready(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn);
        } else {
            fn();
        }
    }

    /* -------------------------------------------------------------------
       1. Ambient background depth layers — injects the grain overlay,
          mesh wash, dust motes, and a fourth hero orb where relevant.
          On mobile: skips heavy SVG grain filters and floating DOM nodes.
       ------------------------------------------------------------------- */
    function injectAmbientLayers() {
        const isMobile = isMobileOrTouch();

        if (!isMobile && !document.querySelector('.grain-overlay')) {
            const grain = document.createElement('div');
            grain.className = 'grain-overlay';
            document.body.insertBefore(grain, document.body.firstChild);
        }
        if (!document.querySelector('.mesh-wash')) {
            const mesh = document.createElement('div');
            mesh.className = 'mesh-wash';
            document.body.insertBefore(mesh, document.body.firstChild);
        }

        // Fourth ambient orb + drifting dust motes, only on desktop auth pages.
        const heroBg = document.querySelector('.auth-hero-bg');
        if (heroBg && !heroBg.querySelector('.hero-orb-4') && !isMobile) {
            const orb4 = document.createElement('div');
            orb4.className = 'hero-orb hero-orb-4';
            heroBg.appendChild(orb4);

            const ray = document.createElement('div');
            ray.className = 'light-ray-sweep';
            heroBg.appendChild(ray);

            if (!prefersReducedMotion) {
                const moteCount = 8;
                for (let i = 0; i < moteCount; i++) {
                    const mote = document.createElement('div');
                    mote.className = 'dust-mote';
                    mote.style.left = `${Math.random() * 100}%`;
                    mote.style.bottom = `${Math.random() * 40}%`;
                    mote.style.animationDelay = `${(Math.random() * 7).toFixed(2)}s`;
                    mote.style.animationDuration = `${(6 + Math.random() * 4).toFixed(2)}s`;
                    heroBg.appendChild(mote);
                }
            }
        }
    }

    /* -------------------------------------------------------------------
       2. Scroll-triggered reveal — tags common content blocks with
          [data-reveal] and toggles .is-revealed via IntersectionObserver.
          On mobile: instantly marks elements visible to avoid scroll jank
          and heavy 3D GPU composite allocations.
       ------------------------------------------------------------------- */
    function initScrollReveal() {
        const selector = [
            '.metric-card', '.insight-card', '.trend-card', '.perk-item',
            '.float-card', '.card:not(.animate-cascade)', '.expense-item',
            '.subscription-card', '.budget-item', '.recent-transactions .transaction-row',
            '.stat-card', '.grid-4-metrics > *'
        ].join(', ');

        const targets = Array.from(document.querySelectorAll(selector));
        if (!targets.length) return;

        if (isMobileOrTouch() || prefersReducedMotion) {
            targets.forEach((el) => {
                el.classList.add('is-revealed');
                el.style.opacity = '1';
                el.style.transform = 'none';
                el.style.filter = 'none';
            });
            return;
        }

        const revealVariants = ['fade-up', 'fade-left', 'fade-right', 'zoom', 'blur'];
        targets.forEach((el, i) => {
            if (!el.hasAttribute('data-reveal')) {
                el.setAttribute('data-reveal', revealVariants[i % revealVariants.length]);
            }
            el.style.setProperty('--stagger-index', i % 8);
            el.style.setProperty('--reveal-delay', `${(i % 8) * 60}ms`);
        });

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-revealed');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

        targets.forEach((el) => observer.observe(el));
    }

    /* -------------------------------------------------------------------
       3. Touch feedback — press-scale, long-press, and swipe-hint.
          Fast and tactile: zero-delay CSS state transitions without
          synchronous getComputedStyle reflows or DOM thrashing.
       ------------------------------------------------------------------- */
    function initTouchFeedback() {
        const pressableSelector = '.btn-primary, .btn-secondary, .btn-oauth, .btn-icon, ' +
            '.preset-btn, button:not(.pill-chip):not(.theme-toggle-btn), .tab-btn, .action-btn';

        document.querySelectorAll(pressableSelector).forEach((el) => {
            el.classList.add('touch-pressable');
        });

        let longPressTimer = null;
        let longPressTarget = null;
        let touchStartX = 0;
        let touchStartY = 0;

        function clearPress() {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            if (longPressTarget) {
                longPressTarget.classList.remove('is-pressed', 'is-long-pressing');
                longPressTarget = null;
            }
        }

        document.addEventListener('touchstart', (e) => {
            const target = e.target.closest(pressableSelector);
            if (!target) return;

            const touch = e.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;

            target.classList.add('is-pressed');

            // Long-press: after 550ms of continuous contact
            longPressTarget = target;
            longPressTimer = setTimeout(() => {
                target.classList.add('is-long-pressing');
                target.dispatchEvent(new CustomEvent('longpress', { bubbles: true }));
            }, 550);
        }, { passive: true });

        // Cancel press immediately if user moves touch to scroll
        document.addEventListener('touchmove', (e) => {
            if (!longPressTarget) return;
            const touch = e.touches[0];
            if (Math.abs(touch.clientX - touchStartX) > 8 || Math.abs(touch.clientY - touchStartY) > 8) {
                clearPress();
            }
        }, { passive: true });

        document.addEventListener('touchend', clearPress, { passive: true });
        document.addEventListener('touchcancel', clearPress, { passive: true });

        // Fluid horizontal touch swipe gesture for transaction and income rows
        // Swiping right reveals/triggers Edit; Swiping left reveals/triggers Delete
        let activeSwipeRow = null;
        let rowStartX = 0;
        let rowStartY = 0;
        let rowDiffX = 0;
        let rowDiffY = 0;
        let isRowSwiping = false;
        let hasHapticFired = false;

        document.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            const row = e.target.closest('.expense-item, .income-table tbody tr, .swipeable-row');
            if (!row || e.target.closest('button, a, input, select')) return;
            activeSwipeRow = row;
            rowStartX = e.touches[0].clientX;
            rowStartY = e.touches[0].clientY;
            rowDiffX = 0;
            rowDiffY = 0;
            isRowSwiping = false;
            hasHapticFired = false;
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (!activeSwipeRow || e.touches.length !== 1) return;
            const touch = e.touches[0];
            rowDiffX = touch.clientX - rowStartX;
            rowDiffY = touch.clientY - rowStartY;

            // Check if vertical scrolling or horizontal swiping
            if (!isRowSwiping) {
                if (Math.abs(rowDiffY) > 8 && Math.abs(rowDiffY) >= Math.abs(rowDiffX)) {
                    // Vertical page scroll — cancel row swipe immediately
                    activeSwipeRow = null;
                    return;
                }
                if (Math.abs(rowDiffX) > 12 && Math.abs(rowDiffX) > Math.abs(rowDiffY) * 1.3) {
                    isRowSwiping = true;
                    window._isGlobalRowSwiping = true;
                    activeSwipeRow.classList.add('is-swiping');
                    activeSwipeRow.classList.remove('swipe-spring-back');
                }
            }

            if (isRowSwiping) {
                // Clamp horizontal translation to [-95px, 95px]
                const clampedX = Math.max(-95, Math.min(95, rowDiffX));
                activeSwipeRow.style.transform = `translateX(${clampedX}px)`;

                if (clampedX > 55) {
                    activeSwipeRow.classList.add('swipe-edit-ready');
                    activeSwipeRow.classList.remove('swipe-delete-ready');
                    if (!hasHapticFired) {
                        navigator.vibrate?.(12);
                        hasHapticFired = true;
                    }
                } else if (clampedX < -55) {
                    activeSwipeRow.classList.add('swipe-delete-ready');
                    activeSwipeRow.classList.remove('swipe-edit-ready');
                    if (!hasHapticFired) {
                        navigator.vibrate?.(12);
                        hasHapticFired = true;
                    }
                } else {
                    activeSwipeRow.classList.remove('swipe-edit-ready', 'swipe-delete-ready');
                    hasHapticFired = false;
                }
            }
        }, { passive: true });

        function endRowSwipe() {
            if (!activeSwipeRow) return;
            const row = activeSwipeRow;
            const finalX = rowDiffX;
            const wasSwiping = isRowSwiping;

            activeSwipeRow = null;
            isRowSwiping = false;
            setTimeout(() => { window._isGlobalRowSwiping = false; }, 120);

            if (wasSwiping) {
                row.classList.remove('is-swiping');
                row.classList.add('swipe-spring-back');
                row.style.transform = 'translateX(0px)';

                if (finalX > 65) {
                    // Swipe right -> Edit
                    navigator.vibrate?.(15);
                    const editBtn = row.querySelector('.btn-edit, .edit-income-btn');
                    if (editBtn) editBtn.click();
                } else if (finalX < -65) {
                    // Swipe left -> Delete
                    navigator.vibrate?.([15, 30, 15]);
                    const delBtn = row.querySelector('.btn-delete, .delete-income-btn');
                    if (delBtn) delBtn.click();
                }

                setTimeout(() => {
                    row.classList.remove('swipe-spring-back', 'swipe-edit-ready', 'swipe-delete-ready');
                    row.style.transform = '';
                }, 300);
            }
        }

        document.addEventListener('touchend', endRowSwipe, { passive: true });
        document.addEventListener('touchcancel', endRowSwipe, { passive: true });
    }

    /* -------------------------------------------------------------------
       4. Pointer micro-interactions (fine-pointer devices only, so touch
          input never fights with these) — magnetic buttons, 3D tilt cards,
          and a glow that tracks the cursor across card surfaces.
       ------------------------------------------------------------------- */
    function initPointerInteractions() {
        if (!hasFinePointer || prefersReducedMotion || isMobileOrTouch()) return;

        document.querySelectorAll('.btn-primary, .btn-oauth:not(#googleOAuthBtn)').forEach((el) => {
            el.classList.add('magnetic-target');
            el.addEventListener('mousemove', (e) => {
                const rect = el.getBoundingClientRect();
                const relX = e.clientX - rect.left - rect.width / 2;
                const relY = e.clientY - rect.top - rect.height / 2;
                el.style.transform = `translate(${relX * 0.12}px, ${relY * 0.22}px)`;
            });
            el.addEventListener('mouseleave', () => {
                el.style.transform = '';
            });
        });

        document.querySelectorAll('.metric-card, .float-card, .perk-item, .card:not(.unified-ledger-card):not(.recent-transactions):not(#unifiedLedgerCard)').forEach((el) => {
            el.classList.add('tilt-target', 'glow-follow');
            let rect = null;
            let rafId = null;
            el.addEventListener('mouseenter', () => {
                rect = el.getBoundingClientRect();
            });
            el.addEventListener('mousemove', (e) => {
                if (!rect) rect = el.getBoundingClientRect();
                if (rafId) return;
                rafId = requestAnimationFrame(() => {
                    rafId = null;
                    if (!rect || rect.width === 0 || rect.height === 0) return;
                    const px = (e.clientX - rect.left) / rect.width;
                    const py = (e.clientY - rect.top) / rect.height;
                    el.style.setProperty('--tilt-x', `${(px - 0.5) * 6}deg`);
                    el.style.setProperty('--tilt-y', `${(0.5 - py) * 6}deg`);
                    el.style.setProperty('--glow-x', `${px * 100}%`);
                    el.style.setProperty('--glow-y', `${py * 100}%`);
                });
            }, { passive: true });
            el.addEventListener('mouseleave', () => {
                rect = null;
                if (rafId) {
                    cancelAnimationFrame(rafId);
                    rafId = null;
                }
                el.style.setProperty('--tilt-x', '0deg');
                el.style.setProperty('--tilt-y', '0deg');
            });
        });
    }

    /* -------------------------------------------------------------------
       5. Scroll parallax for hero orbs/grid — small translateY offset as
          the page scrolls. Strictly restricted to desktop hero backgrounds.
          Never executes on the dashboard or mobile viewports to prevent
          invalidating :root styles on every frame.
       ------------------------------------------------------------------- */
    function initScrollParallax() {
        if (isMobileOrTouch() || prefersReducedMotion) return;
        const heroBg = document.querySelector('.auth-hero-bg');
        if (!heroBg) return;

        const scrollHost = window;
        let ticking = false;
        function update() {
            const y = scrollHost.scrollY || 0;
            const offset = Math.max(-40, Math.min(40, y * 0.08));
            document.documentElement.style.setProperty('--parallax-y', `${offset}px`);
            ticking = false;
        }
        scrollHost.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(update);
                ticking = true;
            }
        }, { passive: true });
    }

    /* -------------------------------------------------------------------
       6. Auth split-screen wheel forwarding — locks the hero panel so it
          never scrolls separately, and smoothly forwards wheel scrolling
          to the active form section.
       ------------------------------------------------------------------- */
    function initAuthWheelSync() {
        // Native browser wheel handling preserved to prevent scroll-locking across all devices
    }

    ready(function () {
        injectAmbientLayers();
        initScrollReveal();
        initTouchFeedback();
        initPointerInteractions();
        initScrollParallax();
        initAuthWheelSync();
    });
})();
