# Frontend cleanup plan

Why this exists: the frontend is hard to follow because one element's style is decided in many
places, `!important` is used to win those fights, and styling also lives inside HTML, JS and TSX.
This plan makes the cleanup measurable and safe. Re-measure at any time with:

```
node scripts/frontend-audit.mjs          # report
node scripts/frontend-audit.mjs --json   # for diffing between PRs
```

## Baseline (main, Oct 2026)

| What | Now | Target |
|---|---|---|
| `!important` declarations (web CSS, 80 files / 13.7K lines) | **2,695** (40% of all declarations) | < 100, only for utilities that must win (e.g. `[hidden]`, reduced-motion) |
| Same selector+property declared in 2+ files | **454** | 0 |
| Inline `style="…"` in HTML and JS strings | **498** (dashboard.html 188, dashboard.js 128) | < 30 (truly dynamic values only, e.g. a bar width) |
| `element.style.x =` writes from JS | **205** | only dynamic values; motion goes to CSS |
| Inline `on…=` handlers in HTML (block a strict CSP) | **19** | 0, then drop `'unsafe-inline'` from `SecurityConfig` |
| Mobile inline style objects / hard-coded hex colours | **960 / 388** | styles in `StyleSheet`, colours from one theme file |
| Largest files | `dashboard.js` 3.8K lines; mobile `add-expense.tsx` 2.1K, `index.tsx` 1.9K | no screen over ~600 lines |

Worst web offenders for `!important`: `auth/dashboard/motion.css` 323, `ui-regression-fixes.css` 287,
`responsive.css` 282, `auth/dashboard/layout.css` 185. Most contested components:
`.custom-select-*` (21 + 14 + 10 + 9 properties fought over), `.command-kbd`, `.input-wrapper > .input-icon`,
`.top-bar`, `.metric-card`.

## Rules that stop it growing back

1. **One owner per component.** `.custom-select-*` lives in `components/custom-select.css` and nowhere else.
2. **No `!important` to win a fight.** If a rule needs it, the ownership is wrong; fix the owner.
3. **No patch files.** `ui-regression-fixes.css`, `modernization.css`, `aesthetics.css` and
   `interaction-performance.css` get folded into their owners and deleted.
4. **Styling lives in CSS (web) or StyleSheet + theme tokens (mobile).** JS only sets classes or custom
   properties (`el.style.setProperty('--w', '40%')`).
5. **Motion that is only a transition/animation is CSS.** JS keeps only what needs it (count-up with locale formatting).

## How each step is made safe

The earlier `@layer` migration was reverted because it was checked only for element visibility. So every
CSS step is **one PR** and ships with before/after screenshots of the affected screens from the real-browser
harness (`scripts/capture-screenshots.mjs`, PR #43) and a pixel diff. A step merges only if the diff is
empty or every difference is explained. Run the audit before and after and paste both in the PR.

## Order

| # | Step | Exit check |
|---|---|---|
| 0 | Audit tool + this plan | baseline recorded |
| 1 | **Pilot: custom-select** (the most contested component) into its owner file, remove its `!important` | audit: its conflicts → 0; screenshots identical |
| 2 | `input-wrapper`, `command-kbd`, `top-bar`, `metric-card` the same way | conflicts list shrinks each PR |
| 3 | Fold the patch files into owners, then delete them | patch files gone; `!important` falls sharply |
| 4 | `responsive.css` and `auth/dashboard/*` per component | no component styled in 3 places |
| 5 | Inline `style=""` in HTML and JS templates → classes | inline attrs < 30 |
| 6 | Inline `on…=` → `addEventListener`, then tighten the CSP | handlers = 0 |
| 7 | JS motion → CSS; collapse the 3-deep `renderFinancialInsights` wrapper chain; split `dashboard.js` | file < 1,500 lines |
| 8 | Mobile: one theme tokens file, inline style objects → StyleSheet, split the 2K-line screens | hex colours = 0 outside theme |
