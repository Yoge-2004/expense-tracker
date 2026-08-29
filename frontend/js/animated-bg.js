/**
 * =============================================================================
 * Dynamic Interactive Fluid Aurora & Ambient Mesh Canvas Engine
 * =============================================================================
 * Generates an active, flowing, multi-layered glowing aurora background with
 * smooth fluid wave physics, glowing particle nodes, mouse glow, and click bursts.
 * Fully optimized for both Dark Theme and Light Theme.
 */

(function () {
    'use strict';

    function initAnimatedBackground() {
        let canvas = document.querySelector('.animated-mesh-canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.className = 'animated-mesh-canvas';
            canvas.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; pointer-events:none; z-index:0; opacity:0.95;';
            document.body.insertBefore(canvas, document.body.firstChild);
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = (canvas.width = window.innerWidth);
        let height = (canvas.height = window.innerHeight);

        let mouseX = width / 2;
        let mouseY = height / 2;
        let targetMouseX = mouseX;
        let targetMouseY = mouseY;
        let isHovering = false;

        window.addEventListener('resize', () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
            initOrbs();
        }, { passive: true });

        window.addEventListener('mousemove', (e) => {
            targetMouseX = e.clientX;
            targetMouseY = e.clientY;
            isHovering = true;
        }, { passive: true });

        window.addEventListener('mouseleave', () => {
            isHovering = false;
        });

        // Click sparkle burst effect
        let clickBursts = [];
        window.addEventListener('click', (e) => {
            const isLight = document.documentElement.getAttribute('data-theme') === 'light' || document.body.getAttribute('data-theme') === 'light';
            const burstCount = 16;
            const x = e.clientX;
            const y = e.clientY;
            for (let i = 0; i < burstCount; i++) {
                const angle = (Math.PI * 2 / burstCount) * i + (Math.random() - 0.5) * 0.5;
                const speed = 2.5 + Math.random() * 5.0;
                clickBursts.push({
                    x: x,
                    y: y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    size: 2.5 + Math.random() * 3.5,
                    life: 1.0,
                    decay: 0.02 + Math.random() * 0.02,
                    color: isLight
                        ? (Math.random() > 0.5 ? '180, 130, 30' : '40, 140, 130')
                        : (Math.random() > 0.5 ? '212, 175, 55' : '76, 175, 160')
                });
            }
        });

        // Vibrant multi-hue palette for rich dynamic aura in both themes
        const PALETTES = {
            dark: [
                { r: 212, g: 175, b: 55,  a: 0.40 }, // Radiant Amber Gold
                { r: 76,  g: 175, b: 160, a: 0.35 }, // Emerald Teal
                { r: 231, g: 76,  b: 60,  a: 0.30 }, // Coral Crimson
                { r: 155, g: 89,  b: 182, a: 0.28 }, // Amethyst Purple
                { r: 52,  g: 152, b: 219, a: 0.30 }, // Azure Sky
                { r: 241, g: 196, b: 15,  a: 0.32 }, // Sunburst Gold
                { r: 46,  g: 204, b: 113, a: 0.26 }, // Mint Emerald
                { r: 230, g: 126, b: 34,  a: 0.28 }  // Warm Amber
            ],
            light: [
                { r: 199, g: 154, b: 62,  a: 0.38 }, // Rich Honey Gold
                { r: 41,  g: 128, b: 185, a: 0.34 }, // Vibrant Azure
                { r: 231, g: 76,  b: 60,  a: 0.30 }, // Rich Coral
                { r: 142, g: 68,  b: 173, a: 0.30 }, // Royal Orchid Violet
                { r: 39,  g: 174, b: 96,  a: 0.30 }, // Spring Emerald
                { r: 230, g: 126, b: 34,  a: 0.34 }, // Warm Tangerine
                { r: 26,  g: 188, b: 156, a: 0.32 }, // Turquoise Mint
                { r: 212, g: 175, b: 55,  a: 0.36 }  // Pure Gold
            ]
        };

        function isLightTheme() {
            return document.documentElement.getAttribute('data-theme') === 'light' || document.body.getAttribute('data-theme') === 'light';
        }

        class AuroraOrb {
            constructor(index) {
                this.index = index;
                this.reset();
            }

            reset() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.radius = Math.max(width, height) * (0.28 + Math.random() * 0.24);
                this.vx = (Math.random() - 0.5) * 0.8;
                this.vy = (Math.random() - 0.5) * 0.8;
                this.angle = Math.random() * Math.PI * 2;
                this.angleSpeed = 0.004 + Math.random() * 0.006;
                this.pulseSpeed = 0.012 + Math.random() * 0.018;
                this.pulseAngle = Math.random() * Math.PI * 2;
            }

            update(time, palette, isLight) {
                this.angle += this.angleSpeed;
                this.pulseAngle += this.pulseSpeed;

                // Fluid wave displacement
                this.x += this.vx + Math.sin(this.angle) * 1.3;
                this.y += this.vy + Math.cos(this.angle * 0.8) * 1.3;

                // React smoothly to mouse movement
                const dx = mouseX - this.x;
                const dy = mouseY - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 480 && dist > 0 && isHovering) {
                    this.x += (dx / dist) * 0.6;
                    this.y += (dy / dist) * 0.6;
                }

                // Bounce gently within boundaries
                if (this.x < -this.radius * 0.4) this.vx = Math.abs(this.vx);
                if (this.x > width + this.radius * 0.4) this.vx = -Math.abs(this.vx);
                if (this.y < -this.radius * 0.4) this.vy = Math.abs(this.vy);
                if (this.y > height + this.radius * 0.4) this.vy = -Math.abs(this.vy);

                const color = palette[this.index % palette.length];
                const currentRadius = this.radius * (0.88 + Math.sin(this.pulseAngle) * 0.18);

                const gradient = ctx.createRadialGradient(
                    this.x, this.y, 0,
                    this.x, this.y, currentRadius
                );

                if (isLight) {
                    gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a * 0.85})`);
                    gradient.addColorStop(0.35, `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a * 0.45})`);
                    gradient.addColorStop(0.75, `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a * 0.12})`);
                    gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
                } else {
                    gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`);
                    gradient.addColorStop(0.4, `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a * 0.45})`);
                    gradient.addColorStop(0.8, `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a * 0.12})`);
                    gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
                }

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Floating Stardust Particles & Constellations
        class StardustParticle {
            constructor() {
                this.reset();
            }

            reset() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.size = Math.random() * 2.4 + 0.8;
                this.vx = (Math.random() - 0.5) * 0.4;
                this.vy = -(0.25 + Math.random() * 0.55); // float upward
                this.opacity = Math.random() * 0.7 + 0.2;
                this.twinkleSpeed = 0.02 + Math.random() * 0.03;
                this.twinkleAngle = Math.random() * Math.PI * 2;
            }

            update(isLight) {
                this.x += this.vx;
                this.y += this.vy;
                this.twinkleAngle += this.twinkleSpeed;

                if (this.y < -10) {
                    this.y = height + 10;
                    this.x = Math.random() * width;
                }
                if (this.x < -10) this.x = width + 10;
                if (this.x > width + 10) this.x = -10;

                const currentAlpha = Math.max(0.12, Math.min(0.9, this.opacity + Math.sin(this.twinkleAngle) * 0.3));

                if (isLight) {
                    ctx.fillStyle = `rgba(160, 115, 30, ${currentAlpha * 0.8})`;
                } else {
                    ctx.fillStyle = `rgba(240, 215, 140, ${currentAlpha})`;
                }

                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        let orbs = [];
        let particles = [];
        const ORB_COUNT = 8;
        const PARTICLE_COUNT = Math.min(52, Math.max(26, Math.floor(width / 28)));

        function initOrbs() {
            orbs = [];
            for (let i = 0; i < ORB_COUNT; i++) {
                orbs.push(new AuroraOrb(i));
            }
            particles = [];
            for (let i = 0; i < PARTICLE_COUNT; i++) {
                particles.push(new StardustParticle());
            }
        }

        initOrbs();

        // Was previously unconditional: this canvas ran its render loop
        // forever regardless of the user's OS-level motion preference or
        // whether the tab was even visible. prefersReducedMotion gates the
        // loop from ever starting (drawing one static frame instead);
        // visibilitychange stops/resumes it as the tab is hidden/shown,
        // rather than relying on browser-specific background-tab throttling.
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let animFrameId = null;
        function render(time) {
            mouseX += (targetMouseX - mouseX) * 0.06;
            mouseY += (targetMouseY - mouseY) * 0.06;

            const isLight = isLightTheme();
            ctx.clearRect(0, 0, width, height);

            if (isLight) {
                ctx.globalCompositeOperation = 'source-over';
            } else {
                ctx.globalCompositeOperation = 'screen';
            }

            const palette = isLight ? PALETTES.light : PALETTES.dark;

            // 1. Draw glowing aurora orbs
            for (let i = 0; i < orbs.length; i++) {
                orbs[i].update(time, palette, isLight);
            }

            // 2. Draw mouse halo orb
            if (isHovering) {
                const mouseGrad = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, 240);
                if (isLight) {
                    mouseGrad.addColorStop(0, 'rgba(199, 154, 62, 0.22)');
                    mouseGrad.addColorStop(0.5, 'rgba(41, 128, 185, 0.10)');
                    mouseGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                } else {
                    mouseGrad.addColorStop(0, 'rgba(212, 175, 55, 0.22)');
                    mouseGrad.addColorStop(0.5, 'rgba(76, 175, 160, 0.10)');
                    mouseGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                }
                ctx.fillStyle = mouseGrad;
                ctx.beginPath();
                ctx.arc(mouseX, mouseY, 240, 0, Math.PI * 2);
                ctx.fill();
            }

            // 3. Draw stardust particles
            ctx.globalCompositeOperation = 'source-over';
            for (let i = 0; i < particles.length; i++) {
                particles[i].update(isLight);
            }

            // 4. Draw click burst sparks
            for (let i = clickBursts.length - 1; i >= 0; i--) {
                const p = clickBursts[i];
                p.x += p.vx;
                p.y += p.vy;
                p.vx *= 0.94;
                p.vy *= 0.94;
                p.life -= p.decay;

                if (p.life <= 0) {
                    clickBursts.splice(i, 1);
                    continue;
                }

                ctx.fillStyle = `rgba(${p.color}, ${p.life})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
                ctx.fill();
            }

            if (!document.hidden && !prefersReducedMotion) {
                animFrameId = requestAnimationFrame(render);
            } else {
                animFrameId = null;
            }
        }

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && !prefersReducedMotion && animFrameId === null) {
                animFrameId = requestAnimationFrame(render);
            }
        });

        if (prefersReducedMotion) {
            render(); // one static frame, no loop
        } else {
            animFrameId = requestAnimationFrame(render);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAnimatedBackground);
    } else {
        initAnimatedBackground();
    }
})();
