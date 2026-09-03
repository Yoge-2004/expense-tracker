/**
 * =============================================================================
 * Motion Engine — scroll reveal, touch feedback, pointer micro-interactions,
 * and ambient background depth layers.
 * Pairs with css/motion-extended.css (animations #171–#226).
 * Self-contained: does nothing if its target elements aren't on the page.
 * =============================================================================
 */
(function () {
    'use strict';

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hasFinePointer = window.matchMedia('(pointer: fine)').matches;

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
       ------------------------------------------------------------------- */
    function injectAmbientLayers() {
        if (!document.querySelector('.grain-overlay')) {
            const grain = document.createElement('div');
            grain.className = 'grain-overlay';
            document.body.insertBefore(grain, document.body.firstChild);
        }
        if (!document.querySelector('.mesh-wash')) {
            const mesh = document.createElement('div');
            mesh.className = 'mesh-wash';
            document.body.insertBefore(mesh, document.body.firstChild);
        }

        // Fourth ambient orb + a few drifting dust motes, only on pages
        // that have the hero panel (auth pages).
        const heroBg = document.querySelector('.auth-hero-bg');
        if (heroBg && !heroBg.querySelector('.hero-orb-4')) {
            const orb4 = document.createElement('div');
            orb4.className = 'hero-orb hero-orb-4';
            heroBg.appendChild(orb4);

            const ray = document.createElement('div');
            ray.className = 'light-ray-sweep';
            heroBg.appendChild(ray);

            if (!prefersReducedMotion) {
                const moteCount = 10;
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
          [data-reveal] (unless already authored explicitly in the HTML)
          and toggles .is-revealed via IntersectionObserver.
       ------------------------------------------------------------------- */
    function initScrollReveal() {
        const revealVariants = ['fade-up', 'fade-left', 'fade-right', 'zoom', 'blur'];
        const selector = [
            '.metric-card', '.insight-card', '.trend-card', '.perk-item',
            '.float-card', '.card:not(.animate-cascade)', '.expense-item',
            '.subscription-card', '.budget-item', '.recent-transactions .transaction-row',
            '.stat-card', '.grid-4-metrics > *'
        ].join(', ');

        const targets = Array.from(document.querySelectorAll(selector));
        if (!targets.length) return;

        targets.forEach((el, i) => {
            if (!el.hasAttribute('data-reveal')) {
                el.setAttribute('data-reveal', revealVariants[i % revealVariants.length]);
            }
            el.style.setProperty('--stagger-index', i % 8);
            el.style.setProperty('--reveal-delay', `${(i % 8) * 60}ms`);
        });

        if (prefersReducedMotion) {
            targets.forEach((el) => el.classList.add('is-revealed'));
            return;
        }

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
       3. Touch feedback — press-scale, touch ripple, long-press, and
          swipe-hint. Uses touchstart/touchend directly for zero-delay
          feedback rather than waiting on a synthesized click.
       ------------------------------------------------------------------- */
    function initTouchFeedback() {
        const pressableSelector = '.btn-primary, .btn-secondary, .btn-oauth, .btn-icon, ' +
            '.pill-chip, .preset-btn, .card, .metric-card, .perk-item, .float-card, ' +
            'button, .expense-item, .subscription-card';

        document.querySelectorAll(pressableSelector).forEach((el) => {
            el.classList.add('touch-pressable');
        });

        let longPressTimer = null;
        let longPressTarget = null;

        document.addEventListener('touchstart', (e) => {
            const target = e.target.closest(pressableSelector);
            if (!target) return;

            target.classList.add('is-pressed');

            // Touch ripple wave, positioned at the actual touch point.
            if (!prefersReducedMotion) {
                const touch = e.touches[0];
                const rect = target.getBoundingClientRect();
                const computedPos = window.getComputedStyle(target).position;
                if (computedPos === 'static') target.style.position = 'relative';
                target.style.overflow = target.style.overflow || 'hidden';

                const wave = document.createElement('span');
                wave.className = 'touch-ripple-wave';
                const size = Math.max(rect.width, rect.height) * 0.9;
                wave.style.width = wave.style.height = `${size}px`;
                wave.style.left = `${touch.clientX - rect.left - size / 2}px`;
                wave.style.top = `${touch.clientY - rect.top - size / 2}px`;
                target.appendChild(wave);
                setTimeout(() => wave.remove(), 700);
            }

            // Long-press: after 550ms of continuous contact, flag it so
            // any long-press-aware handler (e.g. a context menu) can react,
            // and give ambient glow feedback either way.
            longPressTarget = target;
            longPressTimer = setTimeout(() => {
                target.classList.add('is-long-pressing');
                target.dispatchEvent(new CustomEvent('longpress', { bubbles: true }));
            }, 550);
        }, { passive: true });

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
        if (!hasFinePointer || prefersReducedMotion) return;

        document.querySelectorAll('.btn-primary, .btn-oauth').forEach((el) => {
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

        document.querySelectorAll('.metric-card, .float-card, .card').forEach((el) => {
            el.classList.add('tilt-target', 'glow-follow');
            el.addEventListener('mousemove', (e) => {
                const rect = el.getBoundingClientRect();
                const px = (e.clientX - rect.left) / rect.width;
                const py = (e.clientY - rect.top) / rect.height;
                el.style.setProperty('--tilt-x', `${(px - 0.5) * 6}deg`);
                el.style.setProperty('--tilt-y', `${(0.5 - py) * 6}deg`);
                el.style.setProperty('--glow-x', `${px * 100}%`);
                el.style.setProperty('--glow-y', `${py * 100}%`);
            });
            el.addEventListener('mouseleave', () => {
                el.style.setProperty('--tilt-x', '0deg');
                el.style.setProperty('--tilt-y', '0deg');
            });
        });
    }

    /* -------------------------------------------------------------------
       5. Scroll parallax for hero orbs/grid — small translateY offset as
          the page scrolls, capped so it stays subtle.
       ------------------------------------------------------------------- */
    function initScrollParallax() {
        const heroBg = document.querySelector('.auth-hero-bg');
        const scrollHost = document.querySelector('.dashboard-content') || window;
        if (!heroBg && scrollHost === window) return;
        if (prefersReducedMotion) return;

        let ticking = false;
        function update() {
            const y = scrollHost === window ? window.scrollY : scrollHost.scrollTop;
            const offset = Math.max(-40, Math.min(40, y * 0.08));
            document.documentElement.style.setProperty('--parallax-y', `${offset}px`);
            ticking = false;
        }
        (scrollHost === window ? window : scrollHost).addEventListener('scroll', () => {
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
        const hero = document.querySelector('.auth-hero');
        const formSection = document.querySelector('.auth-form-section');
        if (!hero || !formSection) return;

        hero.addEventListener('wheel', (e) => {
            if (window.innerWidth > 900) {
                formSection.scrollTop += e.deltaY;
            }
        }, { passive: true });
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
