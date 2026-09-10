/* Dashboard filtering, date presets, and search input orchestration. */
(function () {
    "use strict";

    function createController(deps) {
        const {
            elements,
            getExpenses,
            parseLocalDate,
            getLocalDateString,
            debounce,
            showToast,
            updateStats,
            renderPieChart,
            renderList,
            renderTrendChart,
            renderRecurringSplitChart,
            renderDayOfWeekChart,
            renderFinancialInsights,
            syncCategoryPillSelection,
            applyIncomeFilters
        } = deps;

        function applyFilters() {
            let filtered = [...(getExpenses() || [])];
            const search = elements.filterSearch?.value.toLowerCase().trim() || "";
            const startDate = elements.filterStartDate?.value || "";
            const endDate = elements.filterEndDate?.value || "";

            if (startDate && endDate && startDate > endDate) {
                showToast("Start date cannot be after end date.", "error");
                elements.filterEndDate.value = "";
                return;
            }

            if (search) {
                filtered = filtered.filter(expense =>
                    (expense.description && expense.description.toLowerCase().includes(search)) ||
                    (expense.categoryName && expense.categoryName.toLowerCase().includes(search))
                );
            }

            if (elements.filterCategory?.value !== "all") {
                filtered = filtered.filter(expense => expense.categoryName === elements.filterCategory.value);
            }

            if (startDate || endDate) {
                if (startDate) filtered = filtered.filter(expense => (expense.expenseDate || "").split("T")[0] >= startDate);
                if (endDate) filtered = filtered.filter(expense => (expense.expenseDate || "").split("T")[0] <= endDate);
            } else {
                if (elements.filterMonth?.value !== "all") {
                    filtered = filtered.filter(expense => parseLocalDate(expense.expenseDate).getMonth() === Number(elements.filterMonth.value));
                }
                if (elements.filterYear?.value !== "all") {
                    filtered = filtered.filter(expense => parseLocalDate(expense.expenseDate).getFullYear() === Number(elements.filterYear.value));
                }
            }

            const sort = elements.filterSort?.value;
            filtered.sort((a, b) => {
                if (sort === "date-desc") {
                    const dateDiff = new Date(b.expenseDate) - new Date(a.expenseDate);
                    if (dateDiff !== 0) return dateDiff;
                    if (b.createdAt && a.createdAt) return new Date(b.createdAt) - new Date(a.createdAt);
                    return (b.id || 0) - (a.id || 0);
                }
                if (sort === "date-asc") {
                    const dateDiff = new Date(a.expenseDate) - new Date(b.expenseDate);
                    if (dateDiff !== 0) return dateDiff;
                    if (a.createdAt && b.createdAt) return new Date(a.createdAt) - new Date(b.createdAt);
                    return (a.id || 0) - (b.id || 0);
                }
                if (sort === "amount-desc") return (Number(b.amount) || 0) - (Number(a.amount) || 0);
                if (sort === "amount-asc") return (Number(a.amount) || 0) - (Number(b.amount) || 0);
                return 0;
            });

            updateStats(filtered);
            renderPieChart(filtered);
            renderList(filtered);
            renderTrendChart(filtered);
            renderRecurringSplitChart(filtered);
            renderDayOfWeekChart(filtered);
            renderFinancialInsights(filtered);
        }

        function wireControls() {
            [elements.filterSort, elements.filterCategory, elements.filterStartDate, elements.filterEndDate, elements.filterMonth, elements.filterYear]
                .filter(Boolean)
                .forEach(element => element.addEventListener("input", () => {
                    if (element === elements.filterStartDate || element === elements.filterEndDate) {
                        document.querySelectorAll("#datePresetsWrap .preset-btn").forEach(button => button.classList.remove("active"));
                    }
                    if (element === elements.filterCategory) syncCategoryPillSelection(elements.filterCategory.value);
                    applyFilters();
                }));

            document.querySelectorAll("#datePresetsWrap .preset-btn").forEach(button => {
                button.addEventListener("click", () => {
                    document.querySelectorAll("#datePresetsWrap .preset-btn").forEach(item => item.classList.remove("active"));
                    button.classList.add("active");

                    const preset = button.getAttribute("data-preset");
                    const now = new Date();
                    const today = getLocalDateString(now);

                    if (preset === "all") {
                        if (elements.filterStartDate) elements.filterStartDate.value = "";
                        if (elements.filterEndDate) elements.filterEndDate.value = "";
                    } else if (preset === "today") {
                        if (elements.filterStartDate) elements.filterStartDate.value = today;
                        if (elements.filterEndDate) elements.filterEndDate.value = today;
                    } else if (preset === "month") {
                        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                        if (elements.filterStartDate) elements.filterStartDate.value = getLocalDateString(firstDay);
                        if (elements.filterEndDate) elements.filterEndDate.value = today;
                    } else if (preset === "last30") {
                        const past30 = new Date(now.getTime() - 30 * 86400000);
                        if (elements.filterStartDate) elements.filterStartDate.value = getLocalDateString(past30);
                        if (elements.filterEndDate) elements.filterEndDate.value = today;
                    }
                    applyFilters();
                });
            });

            if (elements.filterSearch) {
                elements.filterSearch.addEventListener("input", debounce(() => {
                    applyFilters();
                    if (typeof applyIncomeFilters === "function") applyIncomeFilters();
                    renderFinancialInsights(getExpenses());
                }, 250));
            }

            document.getElementById("resetFiltersBtn")?.addEventListener("click", () => {
                if (elements.filterSearch) elements.filterSearch.value = "";
                if (elements.filterStartDate) elements.filterStartDate.value = "";
                if (elements.filterEndDate) elements.filterEndDate.value = "";
                document.querySelectorAll("#datePresetsWrap .preset-btn").forEach(button => {
                    button.classList.toggle("active", button.getAttribute("data-preset") === "all");
                });
                if (elements.filterMonth) elements.filterMonth.value = "all";
                if (elements.filterYear) elements.filterYear.value = "all";
                if (elements.filterCategory) elements.filterCategory.value = "all";
                if (elements.filterSort) elements.filterSort.value = "date-desc";
                syncCategoryPillSelection("all");
                applyFilters();
            });
        }

        return Object.freeze({ applyFilters, wireControls });
    }

    window.DashboardFilters = Object.freeze({ createController });
})();
