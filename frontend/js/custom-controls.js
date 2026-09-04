/**
 * ExpenseTracker Pro - Custom UI Controls
 * Universal Custom Dropdown & Luxury Interactive Calendar Date Picker
 */

(function () {
    'use strict';

    // =========================================================================
    // 1. UNIVERSAL CUSTOM SELECT DROPDOWN COMPONENT
    // =========================================================================

    const enhancedSelects = new Map();

    /**
     * Enhances a native <select> element with luxury custom dropdown UI
     */
    function enhanceSelect(selectEl) {
        if (!selectEl) return null;
        if (enhancedSelects.has(selectEl)) return enhancedSelects.get(selectEl);
        if (selectEl.dataset.customEnhanced === "true") return null;

        selectEl.dataset.customEnhanced = "true";

        const isCompact = selectEl.classList.contains("filter-select") ||
            selectEl.classList.contains("cal-select") ||
            selectEl.id === "incomeFilterFrequency" ||
            selectEl.id === "incomeFilterSort";

        const isEmerald = selectEl.closest("#incomeModal") ||
            selectEl.closest("#incomeFilterPanel") ||
            selectEl.closest(".cal-emerald") ||
            selectEl.id.startsWith("income");

        const isAmber = selectEl.closest("#savingsGoalModal") ||
            selectEl.closest(".cal-amber") ||
            selectEl.id.startsWith("goal");

        // Visually hide native select while keeping it in DOM & focus flow
        selectEl.classList.add("custom-select-native");

        // Create wrapper
        const wrapper = document.createElement("div");
        wrapper.className = "custom-select-wrapper" +
            (isCompact ? " custom-select-compact" : "") +
            (isEmerald ? " custom-select-emerald" : "") +
            (isAmber ? " custom-select-amber" : "");
        wrapper.setAttribute("data-target-id", selectEl.id || "");

        // Trigger button
        const trigger = document.createElement("button");
        trigger.type = "button";
        trigger.className = "custom-select-trigger";
        trigger.setAttribute("aria-haspopup", "listbox");
        trigger.setAttribute("aria-expanded", "false");

        const labelSpan = document.createElement("span");
        labelSpan.className = "custom-select-label";

        const arrowSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        arrowSvg.setAttribute("class", "custom-select-arrow");
        arrowSvg.setAttribute("viewBox", "0 0 24 24");
        arrowSvg.setAttribute("fill", "none");
        arrowSvg.setAttribute("stroke", "currentColor");
        arrowSvg.setAttribute("stroke-width", "2");
        arrowSvg.innerHTML = '<polyline points="6 9 12 15 18 9"/>';

        trigger.appendChild(labelSpan);
        trigger.appendChild(arrowSvg);
        wrapper.appendChild(trigger);

        // Options container
        const optionsContainer = document.createElement("div");
        optionsContainer.className = "custom-select-options";
        optionsContainer.setAttribute("role", "listbox");

        // Search input (for dropdowns with > 6 options)
        const searchWrap = document.createElement("div");
        searchWrap.className = "custom-select-search-wrap";
        const searchInput = document.createElement("input");
        searchInput.type = "text";
        searchInput.className = "custom-select-search";
        searchInput.placeholder = "Search options...";
        searchInput.autocomplete = "off";
        searchWrap.appendChild(searchInput);
        optionsContainer.appendChild(searchWrap);

        const optionsList = document.createElement("div");
        optionsList.className = "custom-options-list";
        optionsContainer.appendChild(optionsList);

        wrapper.appendChild(optionsContainer);

        // Insert wrapper right after selectEl
        selectEl.parentNode.insertBefore(wrapper, selectEl.nextSibling);

        function renderOptions() {
            optionsList.innerHTML = "";
            const options = Array.from(selectEl.options);

            // Toggle search bar visibility
            searchWrap.style.display = options.length > 6 ? "block" : "none";

            const selectedOpt = selectEl.options[selectEl.selectedIndex];
            labelSpan.textContent = selectedOpt ? selectedOpt.text : (selectEl.getAttribute("placeholder") || "Select...");
            if (selectedOpt && selectedOpt.value === "") {
                labelSpan.classList.add("placeholder");
            } else {
                labelSpan.classList.remove("placeholder");
            }

            options.forEach((opt) => {
                const optDiv = document.createElement("div");
                optDiv.className = "custom-option" + (opt.selected ? " selected" : "") + (opt.disabled ? " disabled" : "");
                optDiv.setAttribute("role", "option");
                optDiv.setAttribute("data-value", opt.value);
                optDiv.setAttribute("aria-selected", opt.selected ? "true" : "false");

                const textSpan = document.createElement("span");
                textSpan.className = "custom-option-text";
                textSpan.textContent = opt.text;

                const checkSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                checkSvg.setAttribute("class", "custom-option-check");
                checkSvg.setAttribute("viewBox", "0 0 24 24");
                checkSvg.setAttribute("fill", "none");
                checkSvg.setAttribute("stroke", "currentColor");
                checkSvg.setAttribute("stroke-width", "2.5");
                checkSvg.innerHTML = '<polyline points="20 6 9 17 4 12"/>';

                optDiv.appendChild(textSpan);
                optDiv.appendChild(checkSvg);

                if (!opt.disabled) {
                    optDiv.addEventListener("click", (e) => {
                        e.stopPropagation();
                        selectValue(opt.value);
                        closeDropdown();
                        trigger.focus();
                    });
                }

                optionsList.appendChild(optDiv);
            });
        }

        function selectValue(val) {
            selectEl.value = val;
            syncUI();
            selectEl.dispatchEvent(new Event("change", { bubbles: true }));
            selectEl.dispatchEvent(new Event("input", { bubbles: true }));
        }

        function syncUI() {
            const selectedOpt = selectEl.options[selectEl.selectedIndex];
            labelSpan.textContent = selectedOpt ? selectedOpt.text : (selectEl.getAttribute("placeholder") || "Select...");
            if (selectedOpt && selectedOpt.value === "") {
                labelSpan.classList.add("placeholder");
            } else {
                labelSpan.classList.remove("placeholder");
            }

            const customOpts = optionsList.querySelectorAll(".custom-option");
            customOpts.forEach(co => {
                const isSel = co.getAttribute("data-value") === String(selectEl.value);
                co.classList.toggle("selected", isSel);
                co.setAttribute("aria-selected", isSel ? "true" : "false");
            });
        }

        function openDropdown() {
            closeAllCustomDropdowns(wrapper);
            if (!selectEl.closest("#customCalendarPicker") && typeof closeCustomCalendarPicker === "function") closeCustomCalendarPicker();

            const rect = trigger.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            if (spaceBelow < 230 && spaceAbove > spaceBelow) {
                wrapper.classList.add("drop-up");
            } else {
                wrapper.classList.remove("drop-up");
            }

            wrapper.classList.add("open");
            trigger.setAttribute("aria-expanded", "true");

            if (searchWrap.style.display !== "none") {
                searchInput.value = "";
                filterOptions("");
                setTimeout(() => searchInput.focus(), 50);
            } else {
                const selectedOpt = optionsList.querySelector(".custom-option.selected");
                if (selectedOpt) {
                    selectedOpt.scrollIntoView({ block: "nearest" });
                }
            }
        }

        function closeDropdown() {
            wrapper.classList.remove("open");
            trigger.setAttribute("aria-expanded", "false");
        }

        function toggleDropdown() {
            if (wrapper.classList.contains("open")) {
                closeDropdown();
            } else {
                openDropdown();
            }
        }

        function filterOptions(query) {
            const q = query.toLowerCase().trim();
            const customOpts = optionsList.querySelectorAll(".custom-option");
            let visibleCount = 0;
            customOpts.forEach(co => {
                const text = (co.querySelector(".custom-option-text")?.textContent || "").toLowerCase();
                const matches = text.includes(q);
                co.style.display = matches ? "flex" : "none";
                if (matches) visibleCount++;
            });

            let noMatch = optionsList.querySelector(".custom-option-no-match");
            if (visibleCount === 0) {
                if (!noMatch) {
                    noMatch = document.createElement("div");
                    noMatch.className = "custom-option-no-match";
                    noMatch.textContent = "No matching options";
                    optionsList.appendChild(noMatch);
                }
                noMatch.style.display = "block";
            } else if (noMatch) {
                noMatch.style.display = "none";
            }
        }

        trigger.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleDropdown();
        });

        searchInput.addEventListener("input", (e) => {
            filterOptions(e.target.value);
        });

        searchInput.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                closeDropdown();
                trigger.focus();
            } else if (e.key === "Enter") {
                e.preventDefault();
                const firstVisible = optionsList.querySelector('.custom-option:not([style*="display: none"]):not(.disabled)');
                if (firstVisible) {
                    selectValue(firstVisible.getAttribute("data-value"));
                    closeDropdown();
                    trigger.focus();
                }
            }
        });

        trigger.addEventListener("keydown", (e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                if (!wrapper.classList.contains("open")) {
                    openDropdown();
                }
            } else if (e.key === "Escape") {
                closeDropdown();
            }
        });

        // Intercept programmatic value setter on selectEl
        const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
        if (descriptor && descriptor.set) {
            Object.defineProperty(selectEl, "value", {
                get() {
                    return descriptor.get.call(this);
                },
                set(v) {
                    descriptor.set.call(this, v);
                    syncUI();
                },
                configurable: true
            });
        }

        // MutationObserver to auto-refresh when <option> items change
        const observer = new MutationObserver(() => {
            renderOptions();
        });
        observer.observe(selectEl, { childList: true });

        // Listen for standard change events
        selectEl.addEventListener("change", syncUI);

        // Initial render
        renderOptions();

        const controller = {
            wrapper,
            trigger,
            renderOptions,
            syncUI,
            close: closeDropdown,
            open: openDropdown
        };

        enhancedSelects.set(selectEl, controller);
        return controller;
    }

    function closeAllCustomDropdowns(exceptWrapper = null) {
        document.querySelectorAll(".custom-select-wrapper.open").forEach(w => {
            if (w !== exceptWrapper && !w.contains(exceptWrapper)) {
                w.classList.remove("open");
                const tr = w.querySelector(".custom-select-trigger");
                if (tr) tr.setAttribute("aria-expanded", "false");
            }
        });
    }

    function syncCustomSelect(selectEl) {
        if (!selectEl) return;
        const ctrl = enhancedSelects.get(selectEl);
        if (ctrl) {
            ctrl.renderOptions();
            ctrl.syncUI();
        } else {
            enhanceSelect(selectEl);
        }
    }

    function initAllCustomSelects() {
        const selectIds = [
            "filterMonth",
            "filterYear",
            "filterCategory",
            "filterSort",
            "incomeFilterFrequency",
            "incomeFilterSort",
            "categorySelect",
            "recurringFrequency",
            "budgetCategorySelect",
            "budgetPeriod",
            "editSubCategory",
            "editSubFrequency",
            "incomeRecurringFrequency"
        ];

        selectIds.forEach(id => {
            const el = document.getElementById(id);
            if (el && el.tagName === "SELECT") {
                enhanceSelect(el);
            }
        });

        // Also catch any other selects in modals or filters
        document.querySelectorAll(".modal select, .filter-toolbar select").forEach(sel => {
            if (!enhancedSelects.has(sel) && !sel.dataset.customEnhanced) {
                enhanceSelect(sel);
            }
        });
    }

    // =========================================================================
    // 2. LUXURY CALENDAR DATE PICKER COMPONENT
    // =========================================================================

    let currentPickerTarget = null;
    let calViewYear = new Date().getFullYear();
    let calViewMonth = new Date().getMonth(); // 0-indexed

    const MONTH_NAMES = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

    function getLocalDateString(d = new Date()) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function generateCalendarYearOptions(selectedYear) {
        const baseYear = new Date().getFullYear();
        const startYear = Math.min(baseYear - 40, selectedYear - 10);
        const endYear = Math.max(baseYear + 25, selectedYear + 10);
        let opts = "";
        for (let y = startYear; y <= endYear; y++) {
            opts += `<option value="${y}" ${y === selectedYear ? "selected" : ""}>${y}</option>`;
        }
        return opts;
    }

    function createCalendarDOM() {
        let popover = document.getElementById("customCalendarPicker");
        if (popover) return popover;

        popover = document.createElement("div");
        popover.id = "customCalendarPicker";
        popover.className = "custom-calendar-popover";
        popover.setAttribute("role", "dialog");
        popover.setAttribute("aria-modal", "true");
        popover.setAttribute("aria-label", "Interactive Calendar Picker");
        popover.style.display = "none";

        const monthOptionsHtml = MONTH_NAMES.map((m, idx) => `<option value="${idx}">${m}</option>`).join("");
        const yearOptionsHtml = generateCalendarYearOptions(calViewYear);

        popover.innerHTML = `
            <div class="cal-header">
                <button type="button" class="cal-nav-btn" id="calPrevMonthBtn" aria-label="Previous Month" title="Previous Month">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <div class="cal-selectors-wrap">
                    <select class="cal-select cal-select-month" id="calMonthSelect" aria-label="Select Month">
                        ${monthOptionsHtml}
                    </select>
                    <select class="cal-select cal-select-year" id="calYearSelect" aria-label="Select Year">
                        ${yearOptionsHtml}
                    </select>
                </div>
                <button type="button" class="cal-nav-btn" id="calNextMonthBtn" aria-label="Next Month" title="Next Month">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
            </div>
            <div class="cal-weekdays">
                ${DAY_NAMES.map(d => `<span class="cal-weekday">${d}</span>`).join("")}
            </div>
            <div class="cal-grid" id="calGrid"></div>
            <div class="cal-footer">
                <div class="cal-footer-left">
                    <button type="button" class="cal-btn-action" id="calTodayBtn">Today</button>
                    <button type="button" class="cal-btn-action" id="calClearBtn">Clear</button>
                </div>
                <div class="cal-footer-right">
                    <button type="button" class="cal-btn-done" id="calDoneBtn">Done</button>
                </div>
            </div>
        `;

        document.body.appendChild(popover);

        let backdrop = document.getElementById("customCalendarBackdrop");
        if (!backdrop) {
            backdrop = document.createElement("div");
            backdrop.id = "customCalendarBackdrop";
            backdrop.className = "custom-calendar-backdrop";
            backdrop.style.display = "none";
            document.body.appendChild(backdrop);
            backdrop.addEventListener("click", closeCustomCalendarPicker);
        }

        const monthSel = document.getElementById("calMonthSelect");
        const yearSel = document.getElementById("calYearSelect");

        // Enhance with custom luxury dropdowns
        enhanceSelect(monthSel);
        enhanceSelect(yearSel);

        // Navigation actions
        document.getElementById("calPrevMonthBtn").addEventListener("click", (e) => {
            e.stopPropagation();
            changeCalendarMonth(-1);
        });

        document.getElementById("calNextMonthBtn").addEventListener("click", (e) => {
            e.stopPropagation();
            changeCalendarMonth(1);
        });

        // Direct Month selector
        monthSel.addEventListener("change", (e) => {
            e.stopPropagation();
            calViewMonth = parseInt(e.target.value, 10);
            closeAllCustomDropdowns();
            renderCalendarDays();
        });

        // Direct Year selector
        yearSel.addEventListener("change", (e) => {
            e.stopPropagation();
            calViewYear = parseInt(e.target.value, 10);
            closeAllCustomDropdowns();
            renderCalendarDays();
        });

        // Clicking anywhere inside calendar (grid, header, footer) closes open month/year selects
        popover.addEventListener("click", (e) => {
            if (!e.target.closest(".custom-select-wrapper")) {
                closeAllCustomDropdowns();
            }
        });

        document.getElementById("calTodayBtn").addEventListener("click", (e) => {
            e.stopPropagation();
            if (currentPickerTarget) {
                const todayStr = getLocalDateString(new Date());
                selectCalendarDate(todayStr);
            }
        });

        document.getElementById("calClearBtn").addEventListener("click", (e) => {
            e.stopPropagation();
            if (currentPickerTarget) {
                currentPickerTarget.value = "";
                currentPickerTarget.dispatchEvent(new Event("input", { bubbles: true }));
                currentPickerTarget.dispatchEvent(new Event("change", { bubbles: true }));
                closeCustomCalendarPicker();
            }
        });

        document.getElementById("calDoneBtn").addEventListener("click", (e) => {
            e.stopPropagation();
            closeCustomCalendarPicker();
        });

        // Close on Escape key
        window.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && popover.style.display === "block") {
                closeCustomCalendarPicker();
            }
        });

        // Re-position on window resize
        window.addEventListener("resize", () => {
            if (currentPickerTarget && popover.style.display === "block") {
                positionCalendarPicker(currentPickerTarget, popover);
            }
        });

        return popover;
    }

    function changeCalendarMonth(offset) {
        calViewMonth += offset;
        if (calViewMonth < 0) {
            calViewMonth = 11;
            calViewYear -= 1;
        } else if (calViewMonth > 11) {
            calViewMonth = 0;
            calViewYear += 1;
        }
        renderCalendarDays();
    }

    function renderCalendarDays() {
        const grid = document.getElementById("calGrid");
        const monthSel = document.getElementById("calMonthSelect");
        const yearSel = document.getElementById("calYearSelect");
        if (!grid) return;

        if (monthSel) {
            monthSel.value = calViewMonth;
            syncCustomSelect(monthSel);
        }
        if (yearSel) {
            if (!yearSel.querySelector(`option[value="${calViewYear}"]`)) {
                yearSel.innerHTML = generateCalendarYearOptions(calViewYear);
            }
            yearSel.value = calViewYear;
            syncCustomSelect(yearSel);
        }

        grid.innerHTML = "";

        const firstDayIndex = new Date(calViewYear, calViewMonth, 1).getDay(); // 0 = Sun
        const daysInCurrentMonth = new Date(calViewYear, calViewMonth + 1, 0).getDate();
        const daysInPrevMonth = new Date(calViewYear, calViewMonth, 0).getDate();

        const todayStr = getLocalDateString(new Date());
        const selectedDateStr = currentPickerTarget ? currentPickerTarget.value : "";

        // Trailing days from previous month
        for (let i = firstDayIndex - 1; i >= 0; i--) {
            const dayNum = daysInPrevMonth - i;
            const prevMonth = calViewMonth === 0 ? 11 : calViewMonth - 1;
            const prevYear = calViewMonth === 0 ? calViewYear - 1 : calViewYear;
            const dStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            grid.appendChild(createDayCell(dayNum, dStr, true, todayStr, selectedDateStr));
        }

        // Days of current month
        for (let d = 1; d <= daysInCurrentMonth; d++) {
            const dStr = `${calViewYear}-${String(calViewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            grid.appendChild(createDayCell(d, dStr, false, todayStr, selectedDateStr));
        }

        // Leading days of next month
        const totalRendered = firstDayIndex + daysInCurrentMonth;
        const totalCells = totalRendered > 35 ? 42 : 35;
        const nextCount = totalCells - totalRendered;
        for (let n = 1; n <= nextCount; n++) {
            const nextMonth = calViewMonth === 11 ? 0 : calViewMonth + 1;
            const nextYear = calViewMonth === 11 ? calViewYear + 1 : calViewYear;
            const dStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
            grid.appendChild(createDayCell(n, dStr, true, todayStr, selectedDateStr));
        }
    }

    function createDayCell(dayNum, dateStr, isOtherMonth, todayStr, selectedDateStr) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cal-day-cell";
        if (isOtherMonth) btn.classList.add("cal-day-other");
        if (dateStr === todayStr) btn.classList.add("cal-day-today");
        if (dateStr === selectedDateStr) btn.classList.add("cal-day-selected");

        btn.textContent = dayNum;
        btn.setAttribute("data-date", dateStr);
        btn.setAttribute("aria-label", dateStr);

        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            selectCalendarDate(dateStr);
        });

        return btn;
    }

    function selectCalendarDate(dateStr) {
        if (!currentPickerTarget) return;        currentPickerTarget.value = dateStr;
        currentPickerTarget.dispatchEvent(new Event("input", { bubbles: true }));
        currentPickerTarget.dispatchEvent(new Event("change", { bubbles: true }));
        closeCustomCalendarPicker();
    }

    function positionCalendarPicker(inputEl, popover) {
        const backdrop = document.getElementById("customCalendarBackdrop");
        if (!inputEl || !popover) return;

        const isMobile = window.innerWidth <= 640;
        const inModal = !!inputEl.closest('.modal, .modal-overlay, .modal-content, .modal-dialog');
        const popoverWidth = popover.offsetWidth || 320;
        const popoverHeight = popover.offsetHeight || 375;
        const rect = inputEl.getBoundingClientRect();

        const spaceBelow = window.innerHeight - rect.bottom - 12;
        const spaceAbove = rect.top - 12;

        // If mobile viewport, cramped height (< 580px), or in modal with tight clearance:
        // Use centered luxury modal mode with backdrop!
        if (isMobile || window.innerHeight < 580 || (inModal && spaceBelow < popoverHeight && spaceAbove < popoverHeight)) {
            popover.classList.add("cal-mobile-modal");
            popover.style.top = "";
            popover.style.left = "";
            popover.style.position = "";
            if (backdrop) backdrop.style.display = "block";
            return;
        }

        popover.classList.remove("cal-mobile-modal");
        popover.style.position = "fixed";
        if (backdrop) backdrop.style.display = "block";

        let top;
        if (spaceBelow >= popoverHeight) {
            top = rect.bottom + 6;
        } else if (spaceAbove >= popoverHeight) {
            top = rect.top - popoverHeight - 6;
        } else {
            // Pick side with maximum space
            if (spaceBelow >= spaceAbove) {
                top = rect.bottom + 6;
            } else {
                top = rect.top - popoverHeight - 6;
            }
        }

        // STRICT VIEWPORT CLAMPING:
        // Guarantee: popover will NEVER go off-screen vertically or horizontally!
        // All buttons ("Today", "Clear", "Done") remain 100% visible and reachable!
        const maxTop = window.innerHeight - popoverHeight - 12;
        top = Math.max(12, Math.min(top, maxTop));

        let left = rect.left;
        const maxLeft = window.innerWidth - popoverWidth - 12;
        left = Math.max(12, Math.min(left, maxLeft));

        popover.style.top = `${top}px`;
        popover.style.left = `${left}px`;
    }

    function openCustomCalendarPicker(inputEl) {
        if (!inputEl) return;
        currentPickerTarget = inputEl;

        closeAllCustomDropdowns();

        const popover = createCalendarDOM();

        // Theme styling
        const isEmerald = inputEl.closest("#incomeModal") ||
            inputEl.closest("#incomeFilterPanel") ||
            inputEl.id.startsWith("income");
        popover.classList.toggle("cal-emerald", !!isEmerald);

        const isAmber = inputEl.closest("#savingsGoalModal") ||
            inputEl.id.startsWith("goal");
        popover.classList.toggle("cal-amber", !!isAmber);

        popover.querySelectorAll(".custom-select-wrapper").forEach(w => {
            w.classList.toggle("custom-select-emerald", !!isEmerald);
            w.classList.toggle("custom-select-amber", !!isAmber);
        });

        // Initialize active month/year view from input value or current date
        const val = inputEl.value;
        if (val && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
            const parts = val.split("-");
            calViewYear = parseInt(parts[0], 10);
            calViewMonth = parseInt(parts[1], 10) - 1;
        } else {
            const now = new Date();
            calViewYear = now.getFullYear();
            calViewMonth = now.getMonth();
        }

        renderCalendarDays();

        popover.style.display = "block";
        positionCalendarPicker(inputEl, popover);
    }

    function closeCustomCalendarPicker() {
        const popover = document.getElementById("customCalendarPicker");
        const backdrop = document.getElementById("customCalendarBackdrop");
        if (popover) popover.style.display = "none";
        if (backdrop) backdrop.style.display = "none";
        currentPickerTarget = null;
    }

    function initCustomCalendarDatePicker() {
        const dateInputIds = [
            "filterStartDate",
            "filterEndDate",
            "incomeFilterStartDate",
            "incomeFilterEndDate",
            "date",
            "budgetStartDate",
            "budgetEndDate",
            "editSubNextDate",
            "incomeDate",
            "goalTargetDate"
        ];

        dateInputIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) bindDateInput(el);
        });

        // Also bind any input[type="date"] or .dark-date
        document.querySelectorAll('input[type="date"], .dark-date').forEach(el => {
            bindDateInput(el);
        });
    }

    function bindDateInput(input) {
        if (!input || input.dataset.customCalBound === "true") return;
        input.dataset.customCalBound = "true";
        input.classList.add("custom-datepicker-input");

        // Prevent native OS date popups on mouse/touch and trigger our custom calendar
        input.addEventListener("mousedown", (e) => {
            e.preventDefault();
            input.focus();
            openCustomCalendarPicker(input);
        });

        input.addEventListener("click", (e) => {
            e.preventDefault();
            openCustomCalendarPicker(input);
        });

        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
                e.preventDefault();
                openCustomCalendarPicker(input);
            } else if (e.key === "Escape") {
                closeCustomCalendarPicker();
            }
        });
    }

    // Export API to global window
    window.enhanceSelect = enhanceSelect;
    window.syncCustomSelect = syncCustomSelect;
    window.initAllCustomSelects = initAllCustomSelects;
    window.openCustomCalendarPicker = openCustomCalendarPicker;
    window.closeCustomCalendarPicker = closeCustomCalendarPicker;
    window.initCustomCalendarDatePicker = initCustomCalendarDatePicker;

})();
