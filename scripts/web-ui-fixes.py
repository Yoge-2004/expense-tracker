from pathlib import Path

API = Path('frontend/js/api.js')
TABLES = Path('frontend/css/tables.css')

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

# The responsive income-card rules are deliberately kept idempotent here so this
# script can safely be re-run by the stabilization workflow.
css = TABLES.read_text()
if '/* Mobile income cards: prevent table-width overflow and keep actions visually consistent with the expense ledger. */' not in css:
    raise SystemExit('income responsive CSS patch is missing')
TABLES.write_text(css)
