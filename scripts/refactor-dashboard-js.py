from __future__ import annotations

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
JS_DIR = ROOT / "frontend/js"
MODULE_DIR = JS_DIR / "modules"
DASHBOARD = JS_DIR / "dashboard.js"
HTML = ROOT / "frontend/dashboard.html"


def find_balanced_block(text: str, start_index: int) -> tuple[int, int]:
    """Return the inclusive start/end offsets of a top-level JS brace block."""
    brace_index = text.find("{", start_index)
    if brace_index < 0:
        raise RuntimeError(f"Opening brace not found after offset {start_index}")

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

    raise RuntimeError("Unbalanced JavaScript brace block")


def extract_object(text: str, declaration: str) -> tuple[str, str]:
    start = text.index(declaration)
    brace_start, end = find_balanced_block(text, start)
    if text[end:end + 1] == ";":
        end += 1
    return text[start:end], text[:start] + text[end:]


def extract_function(text: str, signature: str) -> tuple[str, str]:
    start = text.index(signature)
    brace_start, end = find_balanced_block(text, start)
    while end < len(text) and text[end] in " \t":
        end += 1
    if end < len(text) and text[end] == "\n":
        end += 1
    return text[start:end], text[:start] + text[end:]


def replace_identifier(text: str, identifier: str, replacement: str) -> str:
    pattern = re.compile(rf"(?<![A-Za-z0-9_$\.]){re.escape(identifier)}(?![A-Za-z0-9_$])")
    return pattern.sub(replacement, text)


MODULE_DIR.mkdir(parents=True, exist_ok=True)
dash = DASHBOARD.read_text(encoding="utf-8")

# Extract the DOM registry. Keeping the same exported `elements` shape avoids
# touching the dashboard's many existing call sites.
elements_block, dash = extract_object(dash, "const elements = {")
elements_object = elements_block[len("const elements = "):].strip().rstrip(";")

# Extract the two tiny DOM-only setup functions and move their currency dependency
# to the shared utility module.
init_function, dash = extract_function(dash, "function initCurrencyPlaceholders()")
show_function, dash = extract_function(dash, "function showSkeletonLoading()")
init_function = init_function.replace("formatCurrency(", "DashboardUtils.formatCurrency(")

# Remove the old immediate invocation; it will be owned by the DOM module.
dash = dash.replace("initCurrencyPlaceholders();\n\n", "", 1)
dash = dash.replace("showSkeletonLoading();", "window.DashboardDom.showSkeletonLoading();")
dash = dash.replace("const elements = window.DashboardDom.elements;", "", 1)

# Replace the chart state declarations with a dedicated mutable state object.
chart_declarations = '''let pieChart = null;\nlet trendChart = null;\nlet budgetVsActualChart = null;\nlet recurringSplitChart = null;\nlet dayOfWeekChart = null;\n'''
if chart_declarations not in dash:
    raise RuntimeError("Expected dashboard chart state declarations were not found")
dash = dash.replace(chart_declarations, "const chartState = window.DashboardChartState;\n", 1)
for name in ("pieChart", "trendChart", "budgetVsActualChart", "recurringSplitChart", "dayOfWeekChart"):
    dash = replace_identifier(dash, name, f"chartState.{name}")

# Keep the compatibility name used throughout the existing controller while
# sourcing it from the new DOM module.
anchor = 'const { getLocalDateString, parseLocalDate, escapeHtml, formatCurrency, formatDate, getCategoryColor, getCategoryEmoji, debounce } = window.DashboardUtils;\n'
if anchor not in dash:
    raise RuntimeError("Dashboard utility destructuring anchor not found")
dash = dash.replace(anchor, anchor + 'const elements = window.DashboardDom.elements;\n', 1)

# Create the semantic DOM module.
dom_module = f'''/* Dashboard DOM registry and lightweight view helpers. */\n(function () {{\n    "use strict";\n\n    const elements = {elements_object};\n\n    {init_function}\n\n    {show_function}\n\n    window.DashboardDom = Object.freeze({{\n        elements,\n        initCurrencyPlaceholders: initCurrencyPlaceholders,\n        showSkeletonLoading: showSkeletonLoading\n    }});\n}})();\n'''
(MODULE_DIR / "dashboard-dom.js").write_text(dom_module, encoding="utf-8")

# Create an isolated mutable chart-state module. Chart instances are deliberately
# stateful because Chart.js mutates them outside the controller's data lifecycle.
chart_module = '''/* Chart.js instance registry shared by dashboard chart controllers. */\n(function () {\n    "use strict";\n\n    window.DashboardChartState = {\n        pieChart: null,\n        trendChart: null,\n        budgetVsActualChart: null,\n        recurringSplitChart: null,\n        dayOfWeekChart: null\n    };\n})();\n'''
(MODULE_DIR / "dashboard-chart-state.js").write_text(chart_module, encoding="utf-8")

# Insert the dashboard module dependencies exactly once.
html = HTML.read_text(encoding="utf-8")
marker = '    <script src="js/modules/dashboard-ui.js"></script>'
module_tags = '    <script src="js/modules/dashboard-dom.js"></script>\n    <script src="js/modules/dashboard-chart-state.js"></script>\n'
if 'js/modules/dashboard-dom.js' not in html:
    if marker not in html:
        raise RuntimeError("Dashboard module insertion marker not found")
    html = html.replace(marker, module_tags + marker, 1)
    HTML.write_text(html, encoding="utf-8")

DASHBOARD.write_text(dash, encoding="utf-8")

print("Dashboard JS refactor complete: extracted DOM registry, DOM loading helpers, and chart state.")
