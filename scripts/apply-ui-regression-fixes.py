from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"

CSS = r'''/* Targeted fixes for auth, budget, modal, and interaction regressions. */
html[data-theme="dark"] .theme-toggle-btn .sun-icon,
html[data-theme="dark"] #themeToggle .sun-icon { display:block !important; visibility:visible !important; }
html[data-theme="dark"] .theme-toggle-btn .moon-icon,
html[data-theme="dark"] #themeToggle .moon-icon { display:none !important; visibility:hidden !important; }
html[data-theme="light"] .theme-toggle-btn .sun-icon,
html[data-theme="light"] #themeToggle .sun-icon { display:none !important; visibility:hidden !important; }
html[data-theme="light"] .theme-toggle-btn .moon-icon,
html[data-theme="light"] #themeToggle .moon-icon { display:block !important; visibility:visible !important; }

.google-oauth-wrapper { position:relative !important; overflow:visible !important; isolation:isolate; }
#googleOAuthBtn.btn-oauth {
    position:relative !important; z-index:1 !important; box-sizing:border-box !important; min-height:48px !important;
    transform:none !important; transition:background-color .2s ease,border-color .2s ease,box-shadow .2s ease,color .2s ease !important; overflow:visible !important;
}
#googleOAuthBtn.btn-oauth:hover,#googleOAuthBtn.btn-oauth:focus:hover { transform:none !important; border-color:var(--primary) !important; box-shadow:0 0 0 3px rgba(var(--primary-rgb),.14) !important; }
#googleOAuthBtn svg,#googleOAuthBtn svg.google-g-icon { display:block !important; width:18px !important; height:18px !important; flex:0 0 18px !important; overflow:visible !important; }
#googleOAuthBtn svg path { stroke:none !important; }
#googleRealButton,.google-oauth-wrapper #googleRealButton,.google-oauth-wrapper .google-real-btn { display:none !important; }

.budget-item { position:relative !important; overflow:hidden !important; }
.budget-item .budget-bar-track { display:block !important; position:relative !important; width:100% !important; height:8px !important; margin:10px 0 8px !important; padding:0 !important; overflow:hidden !important; border-radius:999px !important; box-sizing:border-box !important; background:var(--input-bg) !important; }
.budget-item .budget-bar-fill { position:absolute !important; inset:0 auto auto 0 !important; display:block !important; height:100% !important; max-width:100% !important; min-width:0 !important; margin:0 !important; padding:0 !important; border-radius:inherit !important; transform:none !important; animation:none !important; transform-origin:left center !important; overflow:hidden !important; }
.budget-item .budget-bar-fill::after { inset:0 !important; border-radius:inherit !important; pointer-events:none !important; }

#ledgerStreamTabs,.ledger-stream-tabs { flex:1 1 auto !important; overscroll-behavior-x:contain !important; scrollbar-width:thin !important; }
#ledgerStreamTabs .stream-pill-btn,.ledger-stream-tabs .stream-pill-btn { flex:0 0 auto !important; min-width:max-content !important; width:max-content !important; }
#ledgerStreamTabs .stream-badge-count,.ledger-stream-tabs .stream-badge-count { flex:0 0 auto !important; min-width:2ch !important; white-space:nowrap !important; }

.subs-tab-bar { min-width:0 !important; overflow-x:auto !important; overscroll-behavior-x:contain !important; scrollbar-width:none !important; }
.subs-tab-bar::-webkit-scrollbar { display:none !important; }
.subs-tab-btn,.subs-tab-btn:hover,.subs-tab-btn:active,.subs-tab-btn.active { box-sizing:border-box !important; min-height:38px !important; padding:7px 16px !important; border-width:1px !important; transform:none !important; outline:none !important; transition:color .2s ease,background-color .2s ease,border-color .2s ease,box-shadow .2s ease !important; -webkit-tap-highlight-color:transparent !important; }
.subs-tab-btn:focus-visible { outline:2px solid color-mix(in srgb,var(--primary) 60%,transparent) !important; outline-offset:2px !important; }

.modal { overflow-y:auto !important; overflow-x:hidden !important; scrollbar-gutter:stable !important; clip-path:inset(0 round 24px) !important; -webkit-clip-path:inset(0 round 24px) !important; }
.modal::-webkit-scrollbar-track { margin:28px 0 !important; border-radius:999px !important; }
.modal::-webkit-scrollbar-thumb { min-height:24px !important; }
#expenseList,#incomeList { min-width:0 !important; width:100% !important; box-sizing:border-box !important; }
#expenseList .expense-item,#incomeList tbody tr { min-width:0 !important; box-sizing:border-box !important; }
@media (max-width:700px) { .budget-item { padding:13px !important; } .budget-item .budget-bar-track { height:7px !important; margin-top:9px !important; } #incomeList tbody tr { width:100% !important; } }
'''

(FRONTEND / "css/ui-regression-fixes.css").write_text(CSS, encoding="utf-8")

# Auth Google rendering is already fixed on newer revisions; only apply the legacy removal when present.
auth_path = FRONTEND / "js/auth.js"
auth = auth_path.read_text(encoding="utf-8")
legacy = re.compile(r'\n        const realButtons = document\.querySelectorAll\("#googleRealButton, \.google-real-btn"\);\n        realButtons\.forEach\(btnContainer => \{.*?\n        \}\);', re.S)
auth, removed = legacy.subn('\n        // The visible button owns the interaction; GSI is invoked through prompt().', auth, count=1)
if removed:
    auth_path.write_text(auth, encoding="utf-8")

# Google button markup is idempotent: repair only when the inline SVG is absent.
GOOGLE_BUTTON = '''<svg class="google-g-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98-1.06-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>'''
for page_name in ("index.html", "register.html"):
    page = FRONTEND / page_name
    text = page.read_text(encoding="utf-8")
    if 'id="googleOAuthBtn"' in text and 'google-g-icon' not in text:
        pattern = re.compile(r'(<button[^>]*id="googleOAuthBtn"[^>]*>).*?(</button>)', re.S)
        text, changed = pattern.subn(lambda m: m.group(1) + "\n                        " + GOOGLE_BUTTON + "\n                        <span>Continue with Google</span>\n                    " + m.group(2), text, count=1)
        if changed != 1:
            raise RuntimeError(f"Google OAuth button markup not found in {page_name}")
        page.write_text(text, encoding="utf-8")

# Replace dashboard-native confirmation/prompt calls only when they are still present.
dash_path = FRONTEND / "js/dashboard.js"
dash = dash_path.read_text(encoding="utf-8")
dash_new, confirm_count = re.subn(r'if \(!confirm\(("[^"]*(?:\\"[^"]*)*")\)\) return;', r'if (!(await window.appConfirm(\1))) return;', dash)
dash_new, prompt_count = re.subn(r'const name = prompt\(("[^"]*(?:\\"[^"]*)*")\);', r'const name = await window.appPrompt(\1);', dash_new)
if dash_new != dash:
    dash_path.write_text(dash_new, encoding="utf-8")

print(f"UI patcher completed: confirm={confirm_count}, prompt={prompt_count}, legacy_google={removed}")
