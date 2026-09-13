/* Shared UI regressions: app dialogs and lightweight interaction fixes. */
(function () {
    "use strict";

    function addDialogStyles() {
        if (document.getElementById("appDialogStyles")) return;
        const style = document.createElement("style");
        style.id = "appDialogStyles";
        style.textContent = `
.app-dialog-overlay{position:fixed;inset:0;z-index:2500;display:grid;place-items:center;padding:20px;background:rgba(4,6,14,.62);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);opacity:0;pointer-events:none;transition:opacity .16s ease}
.app-dialog-overlay.is-open{opacity:1;pointer-events:auto}
.app-dialog{width:min(430px,calc(100vw - 32px));background:var(--card-bg,#171a14);color:var(--text-main,#f7f4ec);border:1px solid var(--border,rgba(255,255,255,.12));border-radius:22px;padding:24px;box-shadow:0 30px 80px rgba(0,0,0,.45);transform:translateY(8px) scale(.985);transition:transform .16s ease}
.app-dialog-overlay.is-open .app-dialog{transform:none}
.app-dialog-title{margin:0 0 8px;font-size:18px;font-weight:700}
.app-dialog-message{margin:0;color:var(--text-muted,#a8a395);font-size:14px;line-height:1.55;white-space:pre-wrap}
.app-dialog-input{width:100%;margin-top:16px;padding:12px 14px;box-sizing:border-box;border-radius:12px;border:1px solid var(--border);background:var(--input-bg);color:var(--text-main);outline:none}
.app-dialog-input:focus-visible{border-color:var(--primary);box-shadow:0 0 0 3px rgba(var(--primary-rgb),.12)}
.app-dialog-input:focus:not(:focus-visible){border-color:var(--border);box-shadow:none}
.app-dialog-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:22px}
.app-dialog-btn{min-width:92px;padding:10px 14px;border-radius:11px;border:1px solid var(--border);background:var(--input-bg);color:var(--text-main);font-weight:650;cursor:pointer}
.app-dialog-btn.primary{background:var(--primary);border-color:var(--primary);color:#fff}
.app-dialog-btn.danger{background:var(--danger);border-color:var(--danger);color:#fff}
.app-dialog-btn:hover{filter:brightness(1.06)}
.app-dialog-btn:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
@media(max-width:520px){.app-dialog{padding:20px}.app-dialog-actions{display:grid;grid-template-columns:1fr 1fr}.app-dialog-btn{width:100%}}
        `;
        document.head.appendChild(style);
    }

    function createDialog(kind, message, defaultValue) {
        addDialogStyles();
        const overlay = document.createElement("div");
        overlay.className = "app-dialog-overlay";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        const dialog = document.createElement("div");
        dialog.className = "app-dialog";
        const title = document.createElement("h2");
        title.className = "app-dialog-title";
        title.textContent = kind === "prompt" ? "Add category" : "Please confirm";
        const body = document.createElement("p");
        body.className = "app-dialog-message";
        body.textContent = message || "Are you sure you want to continue?";
        const input = kind === "prompt" ? document.createElement("input") : null;
        if (input) {
            input.className = "app-dialog-input";
            input.type = "text";
            input.value = defaultValue || "";
            input.maxLength = 80;
            input.autocomplete = "off";
            input.placeholder = "Category name";
        }
        const actions = document.createElement("div");
        actions.className = "app-dialog-actions";
        const cancel = document.createElement("button");
        cancel.className = "app-dialog-btn";
        cancel.type = "button";
        cancel.textContent = "Cancel";
        const accept = document.createElement("button");
        accept.className = "app-dialog-btn " + (kind === "confirm" ? "danger" : "primary");
        accept.type = "button";
        accept.textContent = kind === "confirm" ? "Confirm" : "Add";
        actions.append(cancel, accept);
        dialog.append(title, body);
        if (input) dialog.appendChild(input);
        dialog.appendChild(actions);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        overlay.setAttribute("aria-labelledby", title.id = `app-dialog-title-${Date.now()}`);
        return { overlay, dialog, input, cancel, accept };
    }

    function showAppDialog(kind, message, defaultValue) {
        return new Promise(resolve => {
            const previousFocus = document.activeElement;
            const ui = createDialog(kind, message, defaultValue);
            let settled = false;
            let keyListenerActive = true;
            const cleanup = () => {
                if (keyListenerActive) {
                    document.removeEventListener("keydown", onKey);
                    keyListenerActive = false;
                }
            };
            const finish = value => {
                if (settled) return;
                settled = true;
                cleanup();
                ui.overlay.classList.remove("is-open");
                setTimeout(() => ui.overlay.remove(), 160);
                if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
                resolve(value);
            };
            ui.cancel.addEventListener("click", () => finish(kind === "confirm" ? false : null));
            ui.accept.addEventListener("click", () => finish(kind === "confirm" ? true : ui.input.value));
            ui.overlay.addEventListener("click", event => {
                if (event.target === ui.overlay) finish(kind === "confirm" ? false : null);
            });
            const onKey = event => {
                if (event.key === "Escape") {
                    finish(kind === "confirm" ? false : null);
                } else if (event.key === "Enter" && kind === "prompt" && document.activeElement === ui.input) {
                    finish(ui.input.value);
                }
            };
            document.addEventListener("keydown", onKey);
            requestAnimationFrame(() => {
                ui.overlay.classList.add("is-open");
                (ui.input || ui.accept).focus();
            });
        });
    }

    window.appConfirm = window.appConfirm || function (message) {
        return showAppDialog("confirm", message);
    };
    window.appPrompt = window.appPrompt || function (message, defaultValue = "") {
        return showAppDialog("prompt", message, defaultValue);
    };

    // dashboard.js already owns the click listeners for these controls. Remove
    // redundant inline handlers before it initializes so there is a single
    // event-binding path while preserving the existing global API.
    function removeRedundantIncomeInlineHandlers() {
        ["openIncomeModalBtn", "addIncomeTableBtn"].forEach(id => {
            document.getElementById(id)?.removeAttribute("onclick");
        });
    }

    // Strengthen non-native controls that are intentionally kept for visual
    // compatibility with the current custom selector implementation.
    function initAccessibleCustomControls() {
        const triggers = [
            document.getElementById("currencySelectTrigger"),
            document.getElementById("dashCurrencyTrigger")
        ].filter(Boolean);

        triggers.forEach(trigger => {
            const wrapper = trigger.closest(".custom-select-wrapper");
            const options = wrapper?.querySelector(".custom-select-options");
            if (!wrapper) return;

            trigger.setAttribute("role", "combobox");
            trigger.setAttribute("tabindex", "0");
            trigger.setAttribute("aria-haspopup", "listbox");
            trigger.setAttribute("aria-expanded", wrapper.classList.contains("open") ? "true" : "false");

            if (options) {
                const list = options.querySelector(".custom-options-list") || options;
                if (!list.id) list.id = `${trigger.id}-listbox`;
                trigger.setAttribute("aria-controls", list.id);
                options.querySelectorAll(".custom-option").forEach((option, index) => {
                    option.setAttribute("role", "option");
                    option.setAttribute("tabindex", "-1");
                    option.setAttribute("aria-selected", option.classList.contains("selected") ? "true" : "false");
                    if (!option.id) option.id = `${trigger.id}-option-${index}`;
                });
            }

            trigger.addEventListener("keydown", event => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    trigger.click();
                    return;
                }
                if (event.key === "Escape") {
                    wrapper.classList.remove("open");
                    trigger.setAttribute("aria-expanded", "false");
                    return;
                }
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    if (!wrapper.classList.contains("open")) trigger.click();
                    const optionNodes = Array.from(wrapper.querySelectorAll(".custom-option"))
                        .filter(option => getComputedStyle(option).display !== "none" && !option.classList.contains("disabled"));
                    const current = optionNodes.indexOf(document.activeElement);
                    const step = event.key === "ArrowDown" ? 1 : -1;
                    const target = optionNodes[current < 0 ? (event.key === "ArrowDown" ? 0 : optionNodes.length - 1) : Math.max(0, Math.min(optionNodes.length - 1, current + step))];
                    target?.focus();
                }
            });

            wrapper.addEventListener("click", () => {
                trigger.setAttribute("aria-expanded", wrapper.classList.contains("open") ? "true" : "false");
            });

            const observer = new MutationObserver(() => {
                trigger.setAttribute("aria-expanded", wrapper.classList.contains("open") ? "true" : "false");
                wrapper.querySelectorAll(".custom-option").forEach(option => {
                    option.setAttribute("aria-selected", option.classList.contains("selected") ? "true" : "false");
                });
            });
            observer.observe(wrapper, { attributes: true, subtree: true, attributeFilter: ["class"] });

            options?.addEventListener("keydown", event => {
                const option = event.target.closest(".custom-option");
                if (!option || option.classList.contains("disabled")) return;
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    option.click();
                    trigger.focus();
                } else if (event.key === "Escape") {
                    wrapper.classList.remove("open");
                    trigger.setAttribute("aria-expanded", "false");
                    trigger.focus();
                }
            });
        });
    }

    function initAccessibleGeneratedContent() {
        document.querySelectorAll(".suggestion-chip").forEach(chip => {
            if (chip.matches("button, a, input")) return;
            chip.setAttribute("role", "button");
            chip.setAttribute("tabindex", "0");
            chip.setAttribute("aria-label", `Use suggested username ${chip.textContent.trim().replace(/^@/, "")}`);
            chip.addEventListener("keydown", event => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    chip.click();
                }
            });
        });

        const filterSearch = document.getElementById("filterSearch");
        if (filterSearch && !filterSearch.getAttribute("aria-label")) {
            filterSearch.setAttribute("aria-label", "Search expenses and incomes");
        }

        document.querySelectorAll(".modal-overlay > .modal").forEach((modal, index) => {
            modal.setAttribute("role", "dialog");
            modal.setAttribute("aria-modal", "true");
            const heading = modal.querySelector("h1, h2, h3, h4, [role='heading']");
            if (heading) {
                if (!heading.id) heading.id = `modal-heading-${index}`;
                modal.setAttribute("aria-labelledby", heading.id);
            }
        });
    }

    function init() {
        removeRedundantIncomeInlineHandlers();
        initAccessibleCustomControls();
        initAccessibleGeneratedContent();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
