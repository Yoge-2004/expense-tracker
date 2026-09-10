from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DASHBOARD = ROOT / "frontend/js/dashboard.js"
MODULE_DIR = ROOT / "frontend/js/modules"
METRICS_MODULE = MODULE_DIR / "dashboard-metrics.js"
HTML = ROOT / "frontend/dashboard.html"


def find_balanced_block(text: str, start_index: int) -> tuple[int, int]:
    brace_index = text.find("{", start_index)
    if brace_index < 0:
        raise RuntimeError("Opening brace not found after metric function signature")

    depth = 0
    quote: str | None = None
    escaped = False
    line_comment = False
    block_comment = False
    i = brace_index

    while i < len(text):
        ch = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ""

        if line_comment:
            if ch == "\n":
                line_comment = False
            i += 1
            continue

        if block_comment:
            if ch == "*" and nxt == "/":
                block_comment = False
                i += 2
                continue
            i += 1
            continue

        if quote:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == quote:
                quote = None
            i += 1
            continue

        if ch == "/" and nxt == "/":
            line_comment = True
            i += 2
            continue
        if ch == "/" and nxt == "*":
            block_comment = True
            i += 2
            continue
        if ch in "'\"`":
            quote = ch
            i += 1
            continue

        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return brace_index, i + 1
        i += 1

    raise RuntimeError("Unbalanced metric function block")


def extract_function(text: str, signature: str) -> tuple[str, str]:
    start = text.index(signature)
    _, end = find_balanced_block(text, start)
    while end < len(text) and text[end] in " \t":
        end += 1
    if end < len(text) and text[end] == "\n":
        end += 1
    return text[start:end], text[:start] + text[end:]


if METRICS_MODULE.exists() and METRICS_MODULE.stat().st_size > 0 and 'js/modules/dashboard-metrics.js' in HTML.read_text(encoding='utf-8'):
    print("Dashboard metrics module already exists; nothing to extract.")
    raise SystemExit(0)

DASHBOARD.parent.mkdir(parents=True, exist_ok=True)
MODULE_DIR.mkdir(parents=True, exist_ok=True)
dash = DASHBOARD.read_text(encoding="utf-8")
html = HTML.read_text(encoding="utf-8")

signature = "async function updateProMetrics(expenses)"
if signature not in dash:
    raise RuntimeError("Metric function was not found in dashboard.js; refusing to create a duplicate module.")

metric_function, dash = extract_function(dash, signature)
metric_function = metric_function.rstrip()

chart_anchor = "const chartState = window.DashboardChartState;"
if chart_anchor not in dash:
    raise RuntimeError("Dashboard chart-state anchor was not found.")

if "const updateProMetrics = window.DashboardMetrics.updateProMetrics;" not in dash:
    dash = dash.replace(
        chart_anchor,
        chart_anchor + "\nconst updateProMetrics = window.DashboardMetrics.updateProMetrics;",
        1,
    )

module = f'''/* Dashboard metric calculations and recurring summary state. */
(function () {{
    "use strict";

    const elements = window.DashboardDom.elements;
    const {{ formatCurrency }} = window.DashboardUtils;
    const userId = localStorage.getItem("userId");

    {metric_function}

    window.DashboardMetrics = Object.freeze({{
        updateProMetrics
    }});
    window.updateProMetrics = updateProMetrics;
}})();
'''

METRICS_MODULE.write_text(module, encoding="utf-8")

marker = '    <script src="js/dashboard.js"></script>'
if 'js/modules/dashboard-metrics.js' not in html:
    if marker not in html:
        raise RuntimeError("dashboard.js script tag not found in dashboard.html")
    html = html.replace(
        marker,
        '    <script src="js/modules/dashboard-metrics.js"></script>\n' + marker,
        1,
    )

DASHBOARD.write_text(dash, encoding="utf-8")
HTML.write_text(html, encoding="utf-8")

print("Dashboard metrics extraction complete.")
