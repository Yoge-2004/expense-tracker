from pathlib import Path

# Make savings goal actions use the same visual action-button treatment as expenses/incomes.
dashboard = Path('frontend/js/dashboard.js')
s = dashboard.read_text(encoding='utf-8')
old_edit = '<button class="btn-icon edit-goal-btn" data-goal-id="${goal.id}" title="Edit Goal" style="color:var(--text-muted); cursor:pointer;">'
new_edit = '<button class="btn-icon btn-edit edit-goal-btn" data-goal-id="${goal.id}" title="Edit Goal" aria-label="Edit savings goal">'
old_delete = '<button class="btn-icon delete-goal-btn" data-goal-id="${goal.id}" title="Delete Goal" style="color:var(--text-muted); cursor:pointer;">'
new_delete = '<button class="btn-icon btn-delete delete-goal-btn" data-goal-id="${goal.id}" title="Delete Goal" aria-label="Delete savings goal">'
if old_edit not in s or old_delete not in s:
    raise SystemExit('Savings goal action markup not found; refusing to patch blindly.')
s = s.replace(old_edit, new_edit, 1).replace(old_delete, new_delete, 1)
dashboard.write_text(s, encoding='utf-8')

# Explicitly style savings actions and prevent inherited styles from making them look like plain text.
tables = Path('frontend/css/tables.css')
css = tables.read_text(encoding='utf-8')
marker = '/* Web savings goal action buttons: match expense/income edit/delete controls. */'
if marker not in css:
    css += '''\n\n/* Web savings goal action buttons: match expense/income edit/delete controls. */\n.savings-goal-card .edit-goal-btn,\n.savings-goal-card .delete-goal-btn {\n    width: 36px;\n    height: 36px;\n    min-width: 36px;\n    padding: 0;\n    border-radius: 10px;\n    display: inline-flex;\n    align-items: center;\n    justify-content: center;\n    flex: 0 0 auto;\n    cursor: pointer;\n    transition: transform 0.18s ease, background 0.18s ease, color 0.18s ease, border-color 0.18s ease;\n}\n.savings-goal-card .edit-goal-btn svg,\n.savings-goal-card .delete-goal-btn svg {\n    width: 15px;\n    height: 15px;\n    pointer-events: none;\n}\n.savings-goal-card .edit-goal-btn {\n    color: var(--primary) !important;\n}\n.savings-goal-card .delete-goal-btn {\n    color: var(--danger) !important;\n}\n.savings-goal-card .edit-goal-btn:hover,\n.savings-goal-card .delete-goal-btn:hover {\n    transform: translateY(-1px);\n}\n[data-theme="light"] .savings-goal-card .edit-goal-btn,\n[data-theme="light"] .savings-goal-card .delete-goal-btn {\n    background: var(--input-bg);\n}\n\n@media (max-width: 700px) {\n    .savings-goal-card .edit-goal-btn,\n    .savings-goal-card .delete-goal-btn {\n        width: 34px;\n        height: 34px;\n        min-width: 34px;\n        border-radius: 9px;\n    }\n}\n'''
    tables.write_text(css, encoding='utf-8')

# Bust browser caches for the repaired client module on both auth and dashboard pages.
for name in ('frontend/index.html', 'frontend/dashboard.html'):
    p = Path(name)
    html = p.read_text(encoding='utf-8')
    old = 'js/biometrics.js'
    new = 'js/biometrics.js?v=20260909-bio2'
    if new not in html:
        if old not in html:
            raise SystemExit(f'biometrics script reference not found in {name}')
        html = html.replace(old, new, 1)
        p.write_text(html, encoding='utf-8')

print('Applied savings action styling and WebAuthn client fixes.')
