/**
 * Floating Quick Calculator Module
 * Enterprise draggable & dockable calculator with bill splitting and direct expense insertion.
 */
(function (global) {
    "use strict";

    const STORAGE_POS_KEY = "et_floating_calc_pos";
    const STORAGE_STATE_KEY = "et_floating_calc_open";

    let state = {
        currentValue: "0",
        previousValue: null,
        operator: null,
        expressionStr: "",
        isNewNumber: true,
        splitPeople: 1,
        isOpen: false,
        posX: null,
        posY: null
    };

    // Safe mathematical evaluation to avoid floating-point drift (e.g. 0.1 + 0.2 = 0.3)
    function safeMath(a, b, op) {
        const numA = parseFloat(a);
        const numB = parseFloat(b);
        if (isNaN(numA) || isNaN(numB)) return numA || 0;

        let result = 0;
        switch (op) {
            case "+":
                result = numA + numB;
                break;
            case "-":
            case "−":
                result = numA - numB;
                break;
            case "*":
            case "×":
                result = numA * numB;
                break;
            case "/":
            case "÷":
                if (numB === 0) return "Error";
                result = numA / numB;
                break;
            default:
                return numB;
        }

        if (typeof result === "number") {
            // Round to 8 decimal places max to wipe float inaccuracies
            return String(Math.round((result + Number.EPSILON) * 100000000) / 100000000);
        }
        return String(result);
    }

    function createCalculatorDOM() {
        if (document.getElementById("floatingCalcContainer")) return;

        const container = document.createElement("div");
        container.id = "floatingCalcContainer";

        // Floating trigger bubble
        const trigger = document.createElement("div");
        trigger.id = "floatingCalcTrigger";
        trigger.className = "floating-calc-trigger";
        trigger.setAttribute("role", "button");
        trigger.setAttribute("aria-label", "Open Quick Calculator (Alt+C)");
        trigger.setAttribute("title", "Quick Calculator (Alt+C)");
        trigger.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="4" y="2" width="16" height="20" rx="3"></rect>
                <line x1="8" y1="6" x2="16" y2="6"></line>
                <line x1="16" y1="14" x2="16" y2="18"></line>
                <path d="M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M8 18h.01M12 18h.01"></path>
            </svg>
            <span class="calc-badge"></span>
        `;

        // Floating calculator expanded card
        const panel = document.createElement("div");
        panel.id = "floatingCalcPanel";
        panel.className = "floating-calc-panel";
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-label", "Expense Calculator");
        panel.innerHTML = `
            <div class="floating-calc-header" id="floatingCalcHeader">
                <div class="floating-calc-title">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="4" y="2" width="16" height="20" rx="2.5"></rect>
                        <line x1="8" y1="6" x2="16" y2="6"></line>
                        <circle cx="8" cy="11" r="0.75" fill="currentColor"></circle>
                        <circle cx="12" cy="11" r="0.75" fill="currentColor"></circle>
                        <circle cx="16" cy="11" r="0.75" fill="currentColor"></circle>
                        <circle cx="8" cy="15" r="0.75" fill="currentColor"></circle>
                        <circle cx="12" cy="15" r="0.75" fill="currentColor"></circle>
                        <circle cx="16" cy="15" r="0.75" fill="currentColor"></circle>
                        <circle cx="8" cy="19" r="0.75" fill="currentColor"></circle>
                        <circle cx="12" cy="19" r="0.75" fill="currentColor"></circle>
                        <circle cx="16" cy="19" r="0.75" fill="currentColor"></circle>
                    </svg>
                    <span>Quick Calculator</span>
                </div>
                <div class="floating-calc-controls">
                    <button type="button" class="modal-close" id="floatingCalcMinimize" title="Minimize (Esc)" aria-label="Minimize calculator">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>

            <div class="floating-calc-screen">
                <div class="floating-calc-expr" id="floatingCalcExpr">0</div>
                <div class="floating-calc-val" id="floatingCalcVal">0</div>
            </div>

            <div class="floating-calc-tools">
                <div class="floating-calc-splits" id="floatingCalcSplits" title="Split total evenly">
                    <span style="font-size:10px; color:var(--text-muted); margin-right:2px; font-weight:600;">Split:</span>
                    <button type="button" class="floating-calc-split-chip is-active" data-split="1">1x</button>
                    <button type="button" class="floating-calc-split-chip" data-split="2">÷2</button>
                    <button type="button" class="floating-calc-split-chip" data-split="3">÷3</button>
                    <button type="button" class="floating-calc-split-chip" data-split="4">÷4</button>
                    <button type="button" class="floating-calc-split-chip" data-split="5">÷5</button>
                </div>
                <button type="button" class="floating-calc-use-btn" id="floatingCalcUseBtn" title="Insert into expense or income amount field">
                    <span>Use Amount</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
            </div>

            <div class="floating-calc-fx-bar" id="floatingCalcFxBar">
                <span class="floating-calc-fx-label" title="Live daily rates via open.er-api.com">Fx:</span>
                <button type="button" class="floating-calc-fx-chip" data-fx="USD" title="Convert USD into ₹">USD ➔ ₹</button>
                <button type="button" class="floating-calc-fx-chip" data-fx="EUR" title="Convert EUR into ₹">EUR ➔ ₹</button>
                <button type="button" class="floating-calc-fx-chip" data-fx="GBP" title="Convert GBP into ₹">GBP ➔ ₹</button>
                <button type="button" class="floating-calc-fx-chip" data-fx="AED" title="Convert AED into ₹">AED ➔ ₹</button>
            </div>

            <div class="floating-calc-grid" id="floatingCalcGrid">
                <button type="button" class="floating-calc-key is-func" data-action="all-clear">AC</button>
                <button type="button" class="floating-calc-key is-func" data-action="negate">±</button>
                <button type="button" class="floating-calc-key is-func" data-action="percent">%</button>
                <button type="button" class="floating-calc-key is-op" data-action="op" data-op="÷">÷</button>

                <button type="button" class="floating-calc-key" data-digit="7">7</button>
                <button type="button" class="floating-calc-key" data-digit="8">8</button>
                <button type="button" class="floating-calc-key" data-digit="9">9</button>
                <button type="button" class="floating-calc-key is-op" data-action="op" data-op="×">×</button>

                <button type="button" class="floating-calc-key" data-digit="4">4</button>
                <button type="button" class="floating-calc-key" data-digit="5">5</button>
                <button type="button" class="floating-calc-key" data-digit="6">6</button>
                <button type="button" class="floating-calc-key is-op" data-action="op" data-op="−">−</button>

                <button type="button" class="floating-calc-key" data-digit="1">1</button>
                <button type="button" class="floating-calc-key" data-digit="2">2</button>
                <button type="button" class="floating-calc-key" data-digit="3">3</button>
                <button type="button" class="floating-calc-key is-op" data-action="op" data-op="+">+</button>

                <button type="button" class="floating-calc-key" data-digit="0">0</button>
                <button type="button" class="floating-calc-key" data-action="decimal">.</button>
                <button type="button" class="floating-calc-key is-func" data-action="backspace" title="Backspace">⌫</button>
                <button type="button" class="floating-calc-key is-eq" data-action="equals">=</button>
            </div>
        `;

        container.appendChild(trigger);
        container.appendChild(panel);
        document.body.appendChild(container);

        restorePosition();
        setupDraggable(trigger, false);
        setupDraggable(panel.querySelector(".floating-calc-header"), true);
        bindEvents();
    }

    function updateDisplay() {
        const valEl = document.getElementById("floatingCalcVal");
        const exprEl = document.getElementById("floatingCalcExpr");
        if (!valEl || !exprEl) return;

        let displayVal = state.currentValue;
        if (state.splitPeople > 1 && !isNaN(parseFloat(state.currentValue))) {
            const splitVal = parseFloat(state.currentValue) / state.splitPeople;
            valEl.textContent = String(Math.round((splitVal + Number.EPSILON) * 100) / 100);
            exprEl.textContent = `${state.currentValue} ÷ ${state.splitPeople} people`;
        } else {
            valEl.textContent = displayVal;
            if (state.previousValue !== null && state.operator) {
                exprEl.textContent = `${state.previousValue} ${state.operator} ${state.isNewNumber ? "" : state.currentValue}`;
            } else if (state.expressionStr) {
                exprEl.textContent = state.expressionStr;
            } else {
                exprEl.textContent = "0";
            }
        }
    }

    function inputDigit(digit) {
        if (state.splitPeople > 1) {
            resetSplit();
        }
        if (state.isNewNumber || state.currentValue === "0" || state.currentValue === "Error") {
            state.currentValue = String(digit);
            state.isNewNumber = false;
        } else {
            if (state.currentValue.length < 14) {
                state.currentValue += String(digit);
            }
        }
        updateDisplay();
    }

    function inputDecimal() {
        if (state.splitPeople > 1) {
            resetSplit();
        }
        if (state.isNewNumber || state.currentValue === "Error") {
            state.currentValue = "0.";
            state.isNewNumber = false;
        } else if (!state.currentValue.includes(".")) {
            state.currentValue += ".";
        }
        updateDisplay();
    }

    function inputOperator(nextOp) {
        if (state.splitPeople > 1) {
            resetSplit();
        }
        const inputValue = state.currentValue;

        if (state.operator && !state.isNewNumber) {
            const calculated = safeMath(state.previousValue, inputValue, state.operator);
            state.currentValue = calculated;
            state.previousValue = calculated;
        } else {
            state.previousValue = inputValue;
        }

        state.operator = nextOp;
        state.isNewNumber = true;
        highlightOperator(nextOp);
        updateDisplay();
    }

    function evaluate() {
        if (state.splitPeople > 1) {
            return;
        }
        if (state.operator && state.previousValue !== null) {
            const calculated = safeMath(state.previousValue, state.currentValue, state.operator);
            state.expressionStr = `${state.previousValue} ${state.operator} ${state.currentValue} =`;
            state.currentValue = calculated;
            state.previousValue = null;
            state.operator = null;
            state.isNewNumber = true;
            highlightOperator(null);
            updateDisplay();
        }
    }

    function allClear() {
        state.currentValue = "0";
        state.previousValue = null;
        state.operator = null;
        state.expressionStr = "";
        state.isNewNumber = true;
        resetSplit();
        highlightOperator(null);
        updateDisplay();
    }

    function backspace() {
        if (state.splitPeople > 1) {
            resetSplit();
            return;
        }
        if (state.isNewNumber || state.currentValue === "Error") {
            state.currentValue = "0";
            updateDisplay();
            return;
        }
        if (state.currentValue.length > 1) {
            state.currentValue = state.currentValue.slice(0, -1);
        } else {
            state.currentValue = "0";
        }
        updateDisplay();
    }

    function negate() {
        if (state.currentValue !== "0" && state.currentValue !== "Error") {
            if (state.currentValue.startsWith("-")) {
                state.currentValue = state.currentValue.slice(1);
            } else {
                state.currentValue = "-" + state.currentValue;
            }
            updateDisplay();
        }
    }

    function percent() {
        const val = parseFloat(state.currentValue);
        if (!isNaN(val)) {
            state.currentValue = String(val / 100);
            state.isNewNumber = true;
            updateDisplay();
        }
    }

    function highlightOperator(op) {
        const opKeys = document.querySelectorAll(".floating-calc-key.is-op");
        opKeys.forEach(k => {
            if (op && k.getAttribute("data-op") === op) {
                k.classList.add("is-active");
            } else {
                k.classList.remove("is-active");
            }
        });
    }

    function setSplit(n) {
        state.splitPeople = n;
        const chips = document.querySelectorAll(".floating-calc-split-chip");
        chips.forEach(c => {
            if (parseInt(c.getAttribute("data-split"), 10) === n) {
                c.classList.add("is-active");
            } else {
                c.classList.remove("is-active");
            }
        });
        updateDisplay();
    }

    function resetSplit() {
        setSplit(1);
    }

    function insertAmountIntoActiveField() {
        let finalVal = state.currentValue;
        if (state.splitPeople > 1 && !isNaN(parseFloat(state.currentValue))) {
            finalVal = String(Math.round(((parseFloat(state.currentValue) / state.splitPeople) + Number.EPSILON) * 100) / 100);
        }

        const num = parseFloat(finalVal);
        if (isNaN(num) || num <= 0) return;

        // 1. Look for existing visible amount inputs
        const expenseModal = document.getElementById("expenseModal");
        const incomeModal = document.getElementById("incomeModal");
        const amountInput = document.getElementById("amount");
        const incomeAmountInput = document.getElementById("incomeAmount");

        let targetInput = null;

        if (incomeModal && incomeModal.style.display !== "none" && incomeModal.classList.contains("is-open")) {
            targetInput = incomeAmountInput;
        } else if (expenseModal && expenseModal.style.display !== "none" && !expenseModal.hasAttribute("hidden")) {
            targetInput = amountInput;
        } else if (document.activeElement && document.activeElement.tagName === "INPUT" && (document.activeElement.type === "number" || document.activeElement.id.toLowerCase().includes("amount"))) {
            targetInput = document.activeElement;
        }

        const useBtn = document.getElementById("floatingCalcUseBtn");

        if (targetInput) {
            targetInput.value = num.toFixed(2);
            targetInput.dispatchEvent(new Event("input", { bubbles: true }));
            targetInput.dispatchEvent(new Event("change", { bubbles: true }));
            targetInput.focus();

            if (useBtn) {
                const oldText = useBtn.innerHTML;
                useBtn.innerHTML = `<span>Applied ✓</span>`;
                setTimeout(() => { useBtn.innerHTML = oldText; }, 1400);
            }
        } else {
            // Open expense modal and populate
            const openExpenseBtn = document.getElementById("openModalBtn") || document.getElementById("addExpenseBtn");
            if (openExpenseBtn) {
                openExpenseBtn.click();
                setTimeout(() => {
                    const freshAmount = document.getElementById("amount");
                    if (freshAmount) {
                        freshAmount.value = num.toFixed(2);
                        freshAmount.dispatchEvent(new Event("input", { bubbles: true }));
                        freshAmount.dispatchEvent(new Event("change", { bubbles: true }));
                        freshAmount.focus();
                    }
                }, 200);
            }

            if (useBtn) {
                const oldText = useBtn.innerHTML;
                useBtn.innerHTML = `<span>Opened In Expense ✓</span>`;
                setTimeout(() => { useBtn.innerHTML = oldText; }, 1400);
            }
        }
    }

    function toggleCalculator(forceState) {
        state.isOpen = typeof forceState === "boolean" ? forceState : !state.isOpen;
        const panel = document.getElementById("floatingCalcPanel");
        const trigger = document.getElementById("floatingCalcTrigger");

        if (!panel || !trigger) return;

        if (state.isOpen) {
            panel.classList.add("is-open");
            trigger.style.display = "none";
            syncPanelPositionWithTrigger();
            updateDisplay();
        } else {
            panel.classList.remove("is-open");
            trigger.style.display = "flex";
        }

        try {
            localStorage.setItem(STORAGE_STATE_KEY, state.isOpen ? "true" : "false");
        } catch (_) {}
    }

    function syncPanelPositionWithTrigger() {
        const trigger = document.getElementById("floatingCalcTrigger");
        const panel = document.getElementById("floatingCalcPanel");
        if (!trigger || !panel) return;

        const rect = trigger.getBoundingClientRect();
        const pWidth = 296;
        const pHeight = 380;
        const margin = 16;

        let left = rect.right - pWidth;
        let top = rect.bottom - pHeight;

        // Viewport bounds clamping
        if (left < margin) left = margin;
        if (left + pWidth > window.innerWidth - margin) left = window.innerWidth - pWidth - margin;
        if (top < margin) top = margin;
        if (top + pHeight > window.innerHeight - margin) top = window.innerHeight - pHeight - margin;

        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
        panel.style.bottom = "auto";
        panel.style.right = "auto";
    }

    function setupDraggable(el, isHeader) {
        if (!el || typeof el.addEventListener !== "function") return;

        let isDragging = false;
        let startX, startY;
        let initialLeft, initialTop;
        let moved = false;

        const target = isHeader ? document.getElementById("floatingCalcPanel") : el;

        function onPointerDown(e) {
            if (e.target.closest("button") && !isHeader) return;
            if (e.button && e.button !== 0) return; // Only primary mouse button

            isDragging = true;
            moved = false;
            startX = e.clientX || (e.touches && e.touches[0].clientX);
            startY = e.clientY || (e.touches && e.touches[0].clientY);

            const rect = target.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;

            target.classList.add("is-dragging");
            el.classList.add("is-dragging");

            document.addEventListener("pointermove", onPointerMove, { passive: false });
            document.addEventListener("pointerup", onPointerUp);
            document.addEventListener("touchmove", onTouchMove, { passive: false });
            document.addEventListener("touchend", onPointerUp);
        }

        function onPointerMove(e) {
            if (!isDragging) return;
            const currentX = e.clientX || (e.touches && e.touches[0].clientX);
            const currentY = e.clientY || (e.touches && e.touches[0].clientY);
            const dx = currentX - startX;
            const dy = currentY - startY;

            if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
                moved = true;
            }

            if (!moved) return;
            if (e.cancelable) e.preventDefault();

            let newLeft = initialLeft + dx;
            let newTop = initialTop + dy;

            const tWidth = target.offsetWidth;
            const tHeight = target.offsetHeight;
            const margin = 10;

            if (newLeft < margin) newLeft = margin;
            if (newLeft + tWidth > window.innerWidth - margin) newLeft = window.innerWidth - tWidth - margin;
            if (newTop < margin) newTop = margin;
            if (newTop + tHeight > window.innerHeight - margin) newTop = window.innerHeight - tHeight - margin;

            target.style.left = `${newLeft}px`;
            target.style.top = `${newTop}px`;
            target.style.bottom = "auto";
            target.style.right = "auto";
        }

        function onTouchMove(e) {
            if (moved && e.cancelable) e.preventDefault();
            onPointerMove(e);
        }

        function onPointerUp(e) {
            if (!isDragging) return;
            isDragging = false;
            target.classList.remove("is-dragging");
            el.classList.remove("is-dragging");

            document.removeEventListener("pointermove", onPointerMove);
            document.removeEventListener("pointerup", onPointerUp);
            document.removeEventListener("touchmove", onTouchMove);
            document.removeEventListener("touchend", onPointerUp);

            if (!moved && !isHeader) {
                toggleCalculator(true);
            } else if (moved) {
                savePosition(target);
            }
        }

        el.addEventListener("pointerdown", onPointerDown);
        el.addEventListener("touchstart", onPointerDown, { passive: true });
    }

    function savePosition(el) {
        if (!el || typeof el.addEventListener !== "function") return;
        const rect = el.getBoundingClientRect();
        try {
            localStorage.setItem(STORAGE_POS_KEY, JSON.stringify({
                leftRatio: rect.left / window.innerWidth,
                topRatio: rect.top / window.innerHeight
            }));
        } catch (_) {}
    }

    function restorePosition() {
        const trigger = document.getElementById("floatingCalcTrigger");
        if (!trigger) return;

        try {
            const raw = localStorage.getItem(STORAGE_POS_KEY);
            if (raw) {
                const pos = JSON.parse(raw);
                if (pos && typeof pos.leftRatio === "number" && typeof pos.topRatio === "number") {
                    let left = pos.leftRatio * window.innerWidth;
                    let top = pos.topRatio * window.innerHeight;

                    const margin = 12;
                    if (left < margin) left = margin;
                    if (left > window.innerWidth - 64) left = window.innerWidth - 64;
                    if (top < margin) top = margin;
                    if (top > window.innerHeight - 64) top = window.innerHeight - 64;

                    trigger.style.left = `${left}px`;
                    trigger.style.top = `${top}px`;
                    trigger.style.bottom = "auto";
                    trigger.style.right = "auto";
                }
            }
        } catch (_) {}
    }

    const FX_CACHE_KEY = "et_fx_daily_rates";
    const FX_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours daily update

    async function convertFx(fromCurr) {
        const num = parseFloat(state.currentValue);
        if (isNaN(num) || num === 0) {
            if (window.showToast) window.showToast("Enter an amount first to convert from " + fromCurr, "warning");
            return;
        }

        const chip = document.querySelector(".floating-calc-fx-chip[data-fx="" + fromCurr + ""]");
        if (chip) chip.classList.add("is-loading");

        try {
            let rate = null;
            // 1. Check local storage cache
            try {
                const cachedRaw = localStorage.getItem(FX_CACHE_KEY + "_" + fromCurr);
                if (cachedRaw) {
                    const cached = JSON.parse(cachedRaw);
                    if (Date.now() - cached.timestamp < FX_CACHE_TTL && cached.rate) {
                        rate = cached.rate;
                    }
                }
            } catch (_) {}

            // 2. Fetch fresh rate if not in cache
            if (!rate) {
                try {
                    const res = await fetch("https://open.er-api.com/v6/latest/" + fromCurr);
                    if (res.ok) {
                        const json = await res.json();
                        if (json && json.rates && json.rates.INR) {
                            rate = json.rates.INR;
                            localStorage.setItem(FX_CACHE_KEY + "_" + fromCurr, JSON.stringify({
                                timestamp: Date.now(),
                                rate: rate
                            }));
                        }
                    }
                } catch (netErr) {
                    console.warn("Live currency fetch offline, using fallback", netErr);
                }
            }

            // 3. Fallback rates if network offline
            if (!rate) {
                const STATIC_FALLBACKS = { USD: 83.5, EUR: 90.8, GBP: 106.2, AED: 22.7 };
                rate = STATIC_FALLBACKS[fromCurr] || 1;
            }

            const converted = Math.round((num * rate + Number.EPSILON) * 100) / 100;
            state.expressionStr = num + " " + fromCurr + " @ ₹" + rate.toFixed(2);
            state.currentValue = String(converted);
            state.isNewNumber = true;
            updateDisplay();

            if (window.showToast) {
                window.showToast("Converted: " + num + " " + fromCurr + " = ₹" + converted.toLocaleString('en-IN') + " (Rate: ₹" + rate.toFixed(2) + ")", "info");
            }
        } catch (err) {
            console.error("FX Conversion error", err);
        } finally {
            if (chip) chip.classList.remove("is-loading");
        }
    }

    function bindEvents() {
        const panel = document.getElementById("floatingCalcPanel");
        const minimizeBtn = document.getElementById("floatingCalcMinimize");
        const useBtn = document.getElementById("floatingCalcUseBtn");
        const splits = document.getElementById("floatingCalcSplits");

        if (minimizeBtn) {
            minimizeBtn.addEventListener("click", () => toggleCalculator(false));
        }

        if (useBtn) {
            useBtn.addEventListener("click", insertAmountIntoActiveField);
        }

        if (splits) {
            splits.addEventListener("click", (e) => {
                const chip = e.target.closest(".floating-calc-split-chip");
                if (chip) {
                    const splitNum = parseInt(chip.getAttribute("data-split"), 10) || 1;
                    setSplit(splitNum);
                }
            });
        }

        const fxBar = document.getElementById("floatingCalcFxBar");
        if (fxBar) {
            fxBar.addEventListener("click", (e) => {
                const chip = e.target.closest(".floating-calc-fx-chip");
                if (chip) {
                    const fxCurr = chip.getAttribute("data-fx");
                    if (fxCurr) convertFx(fxCurr);
                }
            });
        }

        // Keypad clicks
        const grid = document.getElementById("floatingCalcGrid");
        if (grid) {
            grid.addEventListener("click", (e) => {
                const btn = e.target.closest(".floating-calc-key");
                if (!btn) return;

                const digit = btn.getAttribute("data-digit");
                const action = btn.getAttribute("data-action");
                const op = btn.getAttribute("data-op");

                if (digit !== null) {
                    inputDigit(digit);
                } else if (action === "op") {
                    inputOperator(op);
                } else if (action === "equals") {
                    evaluate();
                } else if (action === "decimal") {
                    inputDecimal();
                } else if (action === "all-clear") {
                    allClear();
                } else if (action === "backspace") {
                    backspace();
                } else if (action === "negate") {
                    negate();
                } else if (action === "percent") {
                    percent();
                }
            });
        }

        // Global Physical Keyboard Support
        document.addEventListener("keydown", (e) => {
            // Alt + C toggles calculator
            if (e.altKey && (e.key === "c" || e.key === "C")) {
                e.preventDefault();
                toggleCalculator();
                return;
            }

            if (!state.isOpen) return;

            // Don't intercept typing if user is typing in another input element outside calculator
            if (document.activeElement && document.activeElement.tagName === "INPUT" && !document.activeElement.closest("#floatingCalcPanel")) {
                return;
            }

            if (e.key >= "0" && e.key <= "9") {
                inputDigit(e.key);
            } else if (e.key === ".") {
                inputDecimal();
            } else if (e.key === "+") {
                inputOperator("+");
            } else if (e.key === "-") {
                inputOperator("−");
            } else if (e.key === "*") {
                inputOperator("×");
            } else if (e.key === "/") {
                e.preventDefault();
                inputOperator("÷");
            } else if (e.key === "Enter" || e.key === "=") {
                e.preventDefault();
                evaluate();
            } else if (e.key === "Backspace") {
                backspace();
            } else if (e.key === "Escape") {
                toggleCalculator(false);
            } else if (e.key === "c" || e.key === "C") {
                allClear();
            } else if (e.key === "%") {
                percent();
            }
        });

        // Window resize repositioning
        window.addEventListener("resize", () => {
            restorePosition();
            if (state.isOpen) syncPanelPositionWithTrigger();
        });
    }

    // Public API
    global.FloatingCalculator = Object.freeze({
        open: () => toggleCalculator(true),
        close: () => toggleCalculator(false),
        toggle: () => toggleCalculator(),
        getCurrentValue: () => state.currentValue,
        setValue: (val) => {
            state.currentValue = String(val);
            updateDisplay();
        }
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", createCalculatorDOM);
    } else {
        createCalculatorDOM();
    }
})(typeof window !== "undefined" ? window : this);
