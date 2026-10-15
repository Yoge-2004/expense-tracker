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

        // Lightweight horizontal swipe detection for rows opted into it
        // via .swipeable-row (e.g. a transaction row revealing delete/edit).
        document.querySelectorAll('.swipeable-row').forEach((row) => {
            let startX = 0;
            let currentX = 0;
            let dragging = false;

            row.addEventListener('touchstart', (e) => {
                startX = e.touches[0].clientX;
                dragging = true;
            }, { passive: true });

            row.addEventListener('touchmove', (e) => {
                if (!dragging) return;
                currentX = e.touches[0].clientX - startX;
                if (currentX < 0 && currentX > -100) {
                    row.style.transform = `translateX(${currentX}px)`;
                }
            }, { passive: true });

            row.addEventListener('touchend', () => {
                dragging = false;
                row.style.transform = '';
                if (currentX < -48) {
                    row.classList.add('swiped-open');
                } else {
                    row.classList.remove('swiped-open');
                }
                currentX = 0;
            }, { passive: true });
        });
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
        const authPage = document.querySelector('.auth-page');
        if (!authPage) return;

        authPage.addEventListener('wheel', (e) => {
            if (window.innerWidth <= 900) return;

            // Don't intercept scrolling inside scrollable dropdowns or modals if any exist
            const scrollableParent = e.target.closest('.scroll-area, .modal, .custom-select-options');
            if (scrollableParent && scrollableParent.scrollHeight > scrollableParent.clientHeight) {
                return;
            }

            e.preventDefault();

            let delta = e.deltaY;
            if (e.deltaMode === 1) {
                // DOM_DELTA_LINE: Firefox / Linux standard line scroll
                delta *= 28;
            } else if (e.deltaMode === 2) {
                // DOM_DELTA_PAGE
                delta *= window.innerHeight;
            }

            window.scrollBy({ top: delta, behavior: 'auto' });
        }, { passive: false });
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
