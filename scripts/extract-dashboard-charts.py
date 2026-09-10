from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DASHBOARD = ROOT / "frontend/js/dashboard.js"
MODULE_DIR = ROOT / "frontend/js/modules"
CHART_MODULE = MODULE_DIR / "dashboard-charts.js"
HTML = ROOT / "frontend/dashboard.html"

TARGETS = (
    "renderPieChart",
    "renderTrendChart",
    "renderRecurringSplitChart",
    "renderDayOfWeekChart",
    "renderBudgetVsActualChart",
    "buildTrendSeries",
    "toLocalDateKey",
    "formatTrendDate",
    "formatCompactCurrency",
    "getTrendGradient",
    "updateChartsTheme",
)


def find_function_end(text: str, signature: str) -> int:
    start = text.index(signature)
    brace = text.find("{", start)
    if brace < 0:
        raise RuntimeError(f"Opening brace not found for {signature}")

    depth = 0
    quote: str | None = None
    escaped = False
    line_comment = False
    block_comment = False

    for i in range(brace, len(text)):
        ch = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ""

        if line_comment:
            if ch == "\n":
                line_comment = False
            continue
        if block_comment:
            if ch == "*" and nxt == "/":
                block_comment = False
            continue
        if quote:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == quote:
                quote = None
            continue

        if ch == "/" and nxt == "/":
            line_comment = True
            continue
        if ch == "/" and nxt == "*":
            block_comment = True
            continue
        if ch in "'\"`":
            quote = ch
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                while end < len(text) and text[end] in " \t":
                    end += 1
                if end < len(text) and text[end] == ";":
                    end += 1
                if end < len(text) and text[end] == "\n":
                    end += 1
                return end

    raise RuntimeError(f"Unbalanced function body for {signature}")


def extract(text: str, name: str) -> tuple[str, str]:
    signature = f"function {name}("
    start = text.index(signature)
    end = find_function_end(text, signature)
    return text[start:end].strip(), text[:start] + text[end:]


def transform(code: str) -> str:
    return (
        code
        .replace("formatCurrency(", "utils.formatCurrency(")
        .replace("parseLocalDate(", "utils.parseLocalDate(")
    )


def main() -> None:
    dash = DASHBOARD.read_text(encoding="utf-8")
    MODULE_DIR.mkdir(parents=True, exist_ok=True)

    extracted: dict[str, str] = {}
    for name in TARGETS:
        signature = f"function {name}("
        if signature not in dash:
            continue
        block, dash = extract(dash, name)
        extracted[name] = transform(block)

    if not extracted:
        raise SystemExit("No chart functions remained to extract; leaving repository unchanged.")

    module_parts = [
        "/* Dashboard chart controllers and chart-specific helpers. */",
        "(function () {",
        '    "use strict";',
        "",
        "    const utils = window.DashboardUtils;",
        "    const chartState = window.DashboardChartState;",
        "",
    ]

    ordered = [
        "buildTrendSeries",
        "toLocalDateKey",
        "formatTrendDate",
        "formatCompactCurrency",
        "getTrendGradient",
        "renderPieChart",
        "renderTrendChart",
        "renderRecurringSplitChart",
        "renderDayOfWeekChart",
        "renderBudgetVsActualChart",
        "updateChartsTheme",
    ]
    for name in ordered:
        if name in extracted:
            for line in extracted[name].splitlines():
                module_parts.append("    " + line if line else "")
            module_parts.append("")

    module_parts.extend([
        "    window.renderPieChart = renderPieChart;",
        "    window.renderTrendChart = renderTrendChart;",
        "    window.renderRecurringSplitChart = renderRecurringSplitChart;",
        "    window.renderDayOfWeekChart = renderDayOfWeekChart;",
        "    window.renderBudgetVsActualChart = renderBudgetVsActualChart;",
        "    window.updateChartsTheme = updateChartsTheme;",
        "})();",
        "",
    ])
    CHART_MODULE.write_text("\n".join(module_parts), encoding="utf-8")

    html = HTML.read_text(encoding="utf-8")
    if 'js/modules/dashboard-charts.js' not in html:
        marker = '    <script src="js/modules/dashboard-chart-state.js"></script>'
        html = html.replace(marker, marker + '\n    <script src="js/modules/dashboard-charts.js"></script>', 1)
        HTML.write_text(html, encoding="utf-8")

    DASHBOARD.write_text(dash, encoding="utf-8")
    print(f"Extracted chart controllers: {', '.join(extracted)}")


if __name__ == "__main__":
    main()
