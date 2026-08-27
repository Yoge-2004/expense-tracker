/**
 * =============================================================================
 * Dynamic Interactive Fluid Aurora & Ambient Mesh Canvas Engine
 * =============================================================================
 * Generates an active, flowing, multi-layered glowing aurora background with
 * smooth fluid wave physics, glowing particle nodes, and interactive cursor reaction.
 */

(function () {
    'use strict';

    function initAnimatedBackground() {
        // Find or create the background canvas container
        let bgContainer = document.querySelector('.hero-bg') || document.querySelector('.auth-hero-bg');
        if (!bgContainer) {
            bgContainer = document.createElement('div');
            bgContainer.className = 'hero-bg';
            document.body.insertBefore(bgContainer, document.body.firstChild);
        }

        // Create canvas if not present
        let canvas = bgContainer.querySelector('.animated-mesh-canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.className = 'animated-mesh-canvas';
            canvas.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; pointer-events:none; z-index:0; opacity:0.85;';
            bgContainer.insertBefore(canvas, bgContainer.firstChild);
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = (canvas.width = window.innerWidth);
        let height = (canvas.height = window.innerHeight);

        let mouseX = width / 2;
        let mouseY = height / 2;
        let targetMouseX = mouseX;
        let targetMouseY = mouseY;

        window.addEventListener('resize', () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
            initOrbs();
        }, { passive: true });

        window.addEventListener('mousemove', (e) => {
            targetMouseX = e.clientX;
            targetMouseY = e.clientY;
        }, { passive: true });

        // Floating Aurora Glowing Orbs
        let orbs = [];
        const ORB_COUNT = 6;

        const PALETTES = {
            dark: [
                { r: 199, g: 154, b: 62, a: 0.28 },  // Gold
                { r: 76,  g: 122, b: 120, a: 0.24 }, // Teal
                { r: 162, g: 62,  b: 50,  a: 0.22 }, // Wine Red
                { r: 212, g: 175, b: 55,  a: 0.20 }, // Bright Amber
                { r: 42,  g: 157, b: 143, a: 0.22 }, // Emerald Cyan
                { r: 142, g: 68,  b: 173, a: 0.16 }  // Deep Purple
            ],
            light: [
                { r: 212, g: 175, b: 55,  a: 0.18 }, // Soft Gold
                { r: 76,  g: 175, b: 160, a: 0.16 }, // Soft Teal
                { r: 220, g: 100, b: 90,  a: 0.14 }, // Soft Coral
                { r: 180, g: 140, b: 60,  a: 0.15 }, // Warm Amber
                { r: 90,  g: 180, b: 190, a: 0.14 }, // Soft Sky
                { r: 180, g: 120, b: 200, a: 0.12 }  // Soft Lavender
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
                this.radius = Math.max(width, height) * (0.28 + Math.random() * 0.22);
                this.vx = (Math.random() - 0.5) * 0.8;
                this.vy = (Math.random() - 0.5) * 0.8;
                this.angle = Math.random() * Math.PI * 2;
                this.angleSpeed = 0.003 + Math.random() * 0.005;
                this.pulseSpeed = 0.01 + Math.random() * 0.015;
                this.pulseAngle = Math.random() * Math.PI * 2;
            }

            update(time, palette) {
                this.angle += this.angleSpeed;
                this.pulseAngle += this.pulseSpeed;

                // Subtle fluid wave displacement
                this.x += this.vx + Math.sin(this.angle) * 0.9;
                this.y += this.vy + Math.cos(this.angle * 0.8) * 0.9;

                // React smoothly to mouse movement
                const dx = mouseX - this.x;
                const dy = mouseY - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 400 && dist > 0) {
                    this.x += (dx / dist) * 0.4;
                    this.y += (dy / dist) * 0.4;
                }

                // Bounce gently within boundaries
                if (this.x < -this.radius * 0.5) this.vx = Math.abs(this.vx);
                if (this.x > width + this.radius * 0.5) this.vx = -Math.abs(this.vx);
                if (this.y < -this.radius * 0.5) this.vy = Math.abs(this.vy);
                if (this.y > height + this.radius * 0.5) this.vy = -Math.abs(this.vy);

                const color = palette[this.index % palette.length];
                const currentRadius = this.radius * (0.9 + Math.sin(this.pulseAngle) * 0.15);

                const gradient = ctx.createRadialGradient(
                    this.x, this.y, 0,
                    this.x, this.y, currentRadius
                );

                gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`);
                gradient.addColorStop(0.45, `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a * 0.45})`);
                gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Floating stardust sparkles
        class SparkleParticle {
            constructor() {
                this.reset();
            }

            reset() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.size = Math.random() * 2 + 0.8;
                this.vx = (Math.random() - 0.5) * 0.3;
                this.vy = (Math.random() - 0.5) * 0.3 - 0.2;
                this.opacity = Math.random() * 0.6 + 0.2;
                this.fadeSpeed = 0.008 + Math.random() * 0.012;
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;
                this.opacity += Math.sin(Date.now() * 0.003 + this.x) * 0.01;

                if (this.y < 0 || this.x < 0 || this.x > width) {
                    this.reset();
                    this.y = height + 10;
                }

                ctx.fillStyle = `rgba(255, 230, 160, ${Math.max(0.05, Math.min(0.7, this.opacity))})`;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        let sparkles = [];
        function initOrbs() {
            orbs = [];
            for (let i = 0; i < ORB_COUNT; i++) {
                orbs.push(new AuroraOrb(i));
            }
            sparkles = [];
            const SPARKLE_COUNT = Math.min(35, Math.floor(width / 35));
            for (let i = 0; i < SPARKLE_COUNT; i++) {
                sparkles.push(new SparkleParticle());
            }
        }

        initOrbs();

        let animFrameId;
        function render(time) {
            mouseX += (targetMouseX - mouseX) * 0.05;
            mouseY += (targetMouseY - mouseY) * 0.05;

            ctx.clearRect(0, 0, width, height);
            ctx.globalCompositeOperation = 'screen';

            const palette = getThemePalette();
            for (let i = 0; i < orbs.length; i++) {
                orbs[i].update(time, palette);
            }

            ctx.globalCompositeOperation = 'source-over';
            for (let i = 0; i < sparkles.length; i++) {
                sparkles[i].update();
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
