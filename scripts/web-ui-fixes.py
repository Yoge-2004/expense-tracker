from pathlib import Path

API = Path('frontend/js/api.js')
TABLES = Path('frontend/css/tables.css')
TABLES_DIR = Path('frontend/css/tables')

api = API.read_text()
old_finally = '''    } finally {
        activeRequests -= 1;
        if (activeRequests === 0) setLoading(false);
    }'''
new_finally = '''    } finally {
        if (showRequestLoading) {
            activeRequests -= 1;
            if (activeRequests === 0) setLoading(false);
        }
    }'''
if old_finally in api:
    api = api.replace(old_finally, new_finally, 1)
API.write_text(api)

css = TABLES.read_text()
if '/* ==========================================================================' not in css:
    raise SystemExit('tables stylesheet is missing expected header')

# Deterministically split the large table stylesheet into ordered domain modules.
# The slices preserve the original cascade order exactly.
markers = {
    'filters': '/* Consolidated from 3 unconditional declarations each of .filter-toolbar',
    'dashboard': '/* ================== 9. ALIGNMENT FIXES ================== */',
    'controls': '/* INCOME FILTER TOOLBAR & PILLS */',
    'ledger': '/* ── Income Table Container & Custom Luxury Scrollbar ── */',
}
for name, marker in markers.items():
    if marker not in css:
        raise SystemExit(f'missing tables split marker: {marker}')

m_filters = css.index(markers['filters'])
m_dashboard = css.index(markers['dashboard'])
m_controls = css.index(markers['controls'])
m_ledger = css.index(markers['ledger'])

parts = {
    'streams.css': css[:m_filters],
    'filters.css': css[m_filters:m_dashboard],
    'dashboard-support.css': css[m_dashboard:m_controls],
    'controls.css': css[m_controls:m_ledger],
    'ledger.css': css[m_ledger:],
}

TABLES_DIR.mkdir(parents=True, exist_ok=True)
for filename, content in parts.items():
    cleaned = '\n'.join(line.rstrip() for line in content.splitlines())
    while '\n\n\n' in cleaned:
        cleaned = cleaned.replace('\n\n\n', '\n\n')
    (TABLES_DIR / filename).write_text(cleaned.strip() + '\n')

manifest = '''/* ==========================================================================\n   EXPENSE TRACKER — TABLES.CSS\n   Ordered entry point for table, filter and ledger modules.\n   ========================================================================== */\n\n@import url("tables/streams.css");\n@import url("tables/filters.css");\n@import url("tables/dashboard-support.css");\n@import url("tables/controls.css");\n@import url("tables/ledger.css");\n'''
TABLES.write_text(manifest)
