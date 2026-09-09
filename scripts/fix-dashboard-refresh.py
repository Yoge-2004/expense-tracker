from pathlib import Path
import re

path = Path(__file__).resolve().parents[1] / "frontend/js/dashboard.js"
text = path.read_text(encoding="utf-8")

# Returning to the tab should not silently wipe the local cache and re-render the dashboard.
# Data is refreshed by explicit mutations/navigation instead.
pattern = re.compile(
    r'// --- AUTO-UPDATE DASHBOARD WITH SERVER DATA ---.*?document\.addEventListener\("visibilitychange".*?\n\}\);',
    re.S,
)
replacement = '''// Dashboard refreshes are event-driven; tab visibility alone does not reset state or clear caches.\n'''
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise RuntimeError(f"Visibility refresh block not found; patched={count}")

path.write_text(text, encoding="utf-8")
print("Removed visibility-triggered dashboard refresh.")
