/**
 * =============================================================================
 * Dynamic Interactive Fluid Aurora & Ambient Mesh Canvas Engine
 * =============================================================================
 * Generates an active, flowing, multi-layered glowing aurora background with
 * smooth fluid wave physics, glowing particle nodes, mouse glow, and click bursts.
 */

(function () {
    'use strict';

    function initAnimatedBackground() {
        // Create canvas directly on document.body as fixed background
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
            const burstCount = 14;
            const x = e.clientX;
            const y = e.clientY;
            for (let i = 0; i < burstCount; i++) {
                const angle = (Math.PI * 2 / burstCount) * i + (Math.random() - 0.5) * 0.4;
                const speed = 2 + Math.random() * 4.5;
                clickBursts.push({
                    x: x,
                    y: y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    size: 2 + Math.random() * 3,
                    life: 1.0,
                    decay: 0.02 + Math.random() * 0.02,
                    color: Math.random() > 0.5 ? '212, 175, 55' : '76, 175, 160'
                });
            }
        });

        // Vibrant multi-hue palette for rich dynamic aura
        const PALETTES = {
            dark: [
                { r: 212, g: 175, b: 55,  a: 0.38 }, // Radiant Amber Gold
                { r: 76,  g: 175, b: 160, a: 0.32 }, // Emerald Teal
                { r: 231, g: 76,  b: 60,  a: 0.28 }, // Coral Crimson
                { r: 155, g: 89,  b: 182, a: 0.25 }, // Amethyst Purple
                { r: 52,  g: 152, b: 219, a: 0.28 }, // Azure Sky
                { r: 241, g: 196, b: 15,  a: 0.30 }, // Sunburst Gold
                { r: 46,  g: 204, b: 113, a: 0.24 }, // Mint Emerald
                { r: 230, g: 126, b: 34,  a: 0.26 }  // Warm Amber
            ],
            light: [
                { r: 212, g: 175, b: 55,  a: 0.24 }, // Soft Gold
                { r: 76,  g: 175, b: 160, a: 0.20 }, // Soft Teal
                { r: 230, g: 120, b: 110, a: 0.18 }, // Soft Coral
                { r: 160, g: 110, b: 190, a: 0.16 }, // Soft Violet
                { r: 90,  g: 170, b: 210, a: 0.18 }, // Soft Sky
                { r: 240, g: 180, b: 80,  a: 0.20 }  // Soft Honey
            ]
        };

        function getThemePalette() {
            const isLight = document.documentElement.getAttribute('data-theme') === 'light' || document.body.getAttribute('data-theme') === 'light';
            return isLight ? PALETTES.light : PALETTES.dark;
        }

        class AuroraOrb {
            constructor(index) {
                this.index = index;
                this.reset();
            }

            reset() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.radius = Math.max(width, height) * (0.26 + Math.random() * 0.24);
                this.vx = (Math.random() - 0.5) * 0.7;
                this.vy = (Math.random() - 0.5) * 0.7;
                this.angle = Math.random() * Math.PI * 2;
                this.angleSpeed = 0.004 + Math.random() * 0.006;
                this.pulseSpeed = 0.012 + Math.random() * 0.018;
                this.pulseAngle = Math.random() * Math.PI * 2;
            }

            update(time, palette) {
                this.angle += this.angleSpeed;
                this.pulseAngle += this.pulseSpeed;

                // Fluid wave displacement
                this.x += this.vx + Math.sin(this.angle) * 1.2;
                this.y += this.vy + Math.cos(this.angle * 0.8) * 1.2;

                // React smoothly to mouse movement
                const dx = mouseX - this.x;
                const dy = mouseY - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 450 && dist > 0 && isHovering) {
                    this.x += (dx / dist) * 0.5;
                    this.y += (dy / dist) * 0.5;
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

                gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`);
                gradient.addColorStop(0.4, `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a * 0.45})`);
                gradient.addColorStop(0.8, `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a * 0.12})`);
                gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);

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
                this.size = Math.random() * 2.2 + 0.8;
                this.vx = (Math.random() - 0.5) * 0.4;
                this.vy = -(0.2 + Math.random() * 0.5); // float upward
                this.opacity = Math.random() * 0.7 + 0.2;
                this.twinkleSpeed = 0.02 + Math.random() * 0.03;
                this.twinkleAngle = Math.random() * Math.PI * 2;
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;
                this.twinkleAngle += this.twinkleSpeed;

                if (this.y < -10) {
                    this.y = height + 10;
                    this.x = Math.random() * width;
                }
                if (this.x < -10) this.x = width + 10;
                if (this.x > width + 10) this.x = -10;

                const currentAlpha = Math.max(0.1, Math.min(0.85, this.opacity + Math.sin(this.twinkleAngle) * 0.3));

                ctx.fillStyle = `rgba(240, 215, 140, ${currentAlpha})`;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        let orbs = [];
        let particles = [];
        const ORB_COUNT = 8;
        const PARTICLE_COUNT = Math.min(48, Math.max(24, Math.floor(width / 30)));

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

        let animFrameId;
        function render(time) {
            mouseX += (targetMouseX - mouseX) * 0.06;
            mouseY += (targetMouseY - mouseY) * 0.06;

            ctx.clearRect(0, 0, width, height);
            ctx.globalCompositeOperation = 'screen';

            const palette = getThemePalette();

            // 1. Draw glowing aurora orbs
            for (let i = 0; i < orbs.length; i++) {
                orbs[i].update(time, palette);
            }

            // 2. Draw mouse halo orb
            if (isHovering) {
                const mouseGrad = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, 220);
                mouseGrad.addColorStop(0, 'rgba(212, 175, 55, 0.18)');
                mouseGrad.addColorStop(0.5, 'rgba(76, 175, 160, 0.08)');
                mouseGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = mouseGrad;
                ctx.beginPath();
                ctx.arc(mouseX, mouseY, 220, 0, Math.PI * 2);
                ctx.fill();
            }

            // 3. Draw stardust particles
            ctx.globalCompositeOperation = 'source-over';
            for (let i = 0; i < particles.length; i++) {
                particles[i].update();
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

            animFrameId = requestAnimationFrame(render);
        }

        animFrameId = requestAnimationFrame(render);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAnimatedBackground);
    } else {
        initAnimatedBackground();
    }
})();
