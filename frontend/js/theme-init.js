/* Theme & Wallpaper Anti-Flash Initializer (Executes in <head>) */
(function () {
            try {
                var savedTheme = localStorage.getItem("theme");
                var theme = savedTheme === "light" || savedTheme === "dark" ? savedTheme : "dark";
                document.documentElement.setAttribute("data-theme", theme);
                var meta = document.querySelector('meta[name="theme-color"]');
                if (meta) meta.setAttribute("content", theme === "light" ? "#F8F9FA" : "#10120E");

                var rawPalette = localStorage.getItem("app_custom_palette");
                if (rawPalette) {
                    var p = JSON.parse(rawPalette);
                    var isDefault = p && (p.presetId === 'default' || !p.presetId) && p.primary === '#C79A3E' && p.accent === '#A23E32' && p.highlight === '#4C7A78';
                    if (p && p.primary && !isDefault) {
                        var root = document.documentElement;
                        root.style.setProperty("--primary", p.primary);
                        var hex = p.primary.replace('#', '');
                        if (hex.length === 6) {
                            var r = parseInt(hex.substring(0, 2), 16);
                            var g = parseInt(hex.substring(2, 4), 16);
                            var b = parseInt(hex.substring(4, 6), 16);
                            root.style.setProperty("--primary-rgb", r + ", " + g + ", " + b);
                            root.style.setProperty("--primary-glow", "rgba(" + r + ", " + g + ", " + b + ", 0.22)");
                            root.style.setProperty("--border-accent", "rgba(" + r + ", " + g + ", " + b + ", 0.55)");
                            root.style.setProperty("--shadow-glow", "0 12px 35px -8px rgba(" + r + ", " + g + ", " + b + ", 0.3)");
                        }
                        if (p.primaryGradientEnd) {
                            root.style.setProperty("--primary-gradient", "linear-gradient(135deg, " + p.primary + " 0%, " + p.primaryGradientEnd + " 100%)");
                        }
                        if (p.accent) {
                            root.style.setProperty("--accent", p.accent);
                            var ahex = p.accent.replace('#', '');
                            if (ahex.length === 6) {
                                var ar = parseInt(ahex.substring(0, 2), 16);
                                var ag = parseInt(ahex.substring(2, 4), 16);
                                var ab = parseInt(ahex.substring(4, 6), 16);
                                root.style.setProperty("--accent-rgb", ar + ", " + ag + ", " + ab);
                                root.style.setProperty("--accent-glow", "rgba(" + ar + ", " + ag + ", " + ab + ", 0.25)");
                                root.style.setProperty("--accent-text", p.accent);
                            }
                        }
                        if (p.highlight) {
                            root.style.setProperty("--highlight", p.highlight);
                            var hhex = p.highlight.replace('#', '');
                            if (hhex.length === 6) {
                                var hr = parseInt(hhex.substring(0, 2), 16);
                                var hg = parseInt(hhex.substring(2, 4), 16);
                                var hb = parseInt(hhex.substring(4, 6), 16);
                                root.style.setProperty("--highlight-rgb", hr + ", " + hg + ", " + hb);
                            }
                        }
                        var lum = (r * 299 + g * 587 + b * 114) / 1000;
                        root.style.setProperty("--on-primary", lum > 145 ? "#0F172A" : "#FFFFFF");
                        if (theme === "light") {
                            root.style.setProperty("--card-bg", "#FFFFFF");
                            root.style.setProperty("--card-bg-hover", "#F8FAFC");
                            root.style.setProperty("--border", "rgba(" + r + ", " + g + ", " + b + ", 0.22)");
                            root.style.setProperty("--border-subtle", "rgba(" + r + ", " + g + ", " + b + ", 0.12)");
                        } else if (p.cardSurface) {
                            var cs = (!p.cardSurface.startsWith("#c7") && !p.cardSurface.startsWith("#C7")) ? p.cardSurface : "rgba(23, 26, 20, 0.90)";
                            root.style.setProperty("--card-bg", cs);
                            root.style.setProperty("--border", "rgba(" + r + ", " + g + ", " + b + ", 0.25)");
                        }
                        if (Array.isArray(p.paletteColors)) {
                            p.paletteColors.slice(0, 8).forEach(function (col, i) {
                                root.style.setProperty("--palette-" + (i + 1), col);
                                var ch = col.replace("#", "");
                                if (ch.length === 6) {
                                    var cr = parseInt(ch.substring(0, 2), 16);
                                    var cg = parseInt(ch.substring(2, 4), 16);
                                    var cb = parseInt(ch.substring(4, 6), 16);
                                    root.style.setProperty("--palette-" + (i + 1) + "-rgb", cr + ", " + cg + ", " + cb);
                                }
                            });
                        }
                    }
                }
            } catch {
                document.documentElement.setAttribute("data-theme", "dark");
            }
        })();
