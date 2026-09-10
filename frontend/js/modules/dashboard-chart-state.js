/* Chart.js instance registry shared by dashboard chart controllers. */
(function () {
    "use strict";

    window.DashboardChartState = {
        pieChart: null,
        trendChart: null,
        budgetVsActualChart: null,
        recurringSplitChart: null,
        dayOfWeekChart: null
    };
})();
