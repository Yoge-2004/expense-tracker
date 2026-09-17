# Expense Tracker — Modernization Audit Handoff

> Session-continuity doc. `CLAUDE.md`, `HANDOFF_MODERNIZATION.md`, and
> `MODERNIZATION_CODE_QUALITY.md` define the *rules* for this work — the
> Discover → Inspect → Justify → Implement → Verify cycle, the code-smell
> policy, the deprecated-code policy, the per-stack quality checklists.
> This file exists only because the driving chat conversation got very
> long: it tracks *where this specific audit is*, what's already been
> done, and what to pick up next, so a fresh session (or this one after
> context is trimmed) doesn't have to reconstruct it from scratch.

## 1. Current directive

Full audit of the codebase actually in use — frontend web, backend
Java/Spring, mobile React Native — for:

- dead code
- old or deprecated practices
- places where a newer/more efficient/more maintainable approach exists
  for a problem the code already solves, that isn't being used

**Method** (as given by the project owner):

1. **Analyze first.** Survey the codebase to identify which areas
   actually have a real, modern alternative worth pursuing — build a
   candidate list — *before* changing anything.
2. **Then go one file/module at a time**, deep, not shotgun edits
   across many files at once.
3. **But cover multiple files in a single continuous session** —
   don't stop after just one.

This is exactly the existing Discover → Inspect → Justify → Implement →
Verify cycle (`HANDOFF_MODERNIZATION.md` §9) combined with the code-smell
policy and deprecated-code policy (`MODERNIZATION_CODE_QUALITY.md` §2–3).
Nothing new to invent — just follow those, tracked here.

Important distinction from the earlier phase of this work: that was
**bug-hunting** (find things that are actually broken). This is
**modernization/tech-debt** (find things that work but are outdated,
inefficient, or have a better idiom available now). A finding here
doesn't need a user-visible symptom to be worth fixing — but per the
Justify step, it does need a concrete benefit (performance, security,
maintainability, correctness-under-edge-cases), not novelty for its
own sake. "Do not replace working code merely because a newer syntax
exists" (`MODERNIZATION_CODE_QUALITY.md` §1) still applies.

## 2. Scope and current stack versions

Confirmed directly from the repo, not assumed:

| Area | Path | Stack | Version |
|---|---|---|---|
| Backend | `src/main/java/...` | Spring Boot | 4.1.1 |
| Backend | | Java | 26 |
| Frontend web | `frontend/` | Vanilla HTML/CSS/JS | no build step, no package.json, CDN-loaded Chart.js |
| Mobile | `mobile/` | Expo | ~57.0.21 |
| Mobile | | React Native | 0.86.3 |
| Mobile | | React | 19.2.3 |
| E2E tests | `e2e/` | Playwright | ^1.63.0 |
| E2E tests | | TypeScript | ^7.0.2 |

Note: this is a fairly current stack across the board (Spring Boot 4.x,
React 19, RN 0.86). So "outdated dependency version" is less likely to
be the dominant finding than **outdated usage patterns/idioms within a
current stack** — e.g. not using a language/framework feature that
shipped since the code was written, or a pattern the framework itself
has since superseded even at the same major version.

Branch: `refactor/modernize-codebase`. Not yet merged to `main` — draft
PR #29 exists (`refactor/modernize-codebase` → `main`).

## 3. What's already been done this conversation (context, not to redo)

Full detail lives in git history and in `/areas/expense-tracker-pro.md`
memory (if reading this from a fresh session with that memory
available). Summary:

- **7 real bugs found and fixed**, each independently verified (not just
  read-and-guessed): Chart.js missing font defaults + a hardcoded
  pre-standardization font override; a runtime script causing a
  duplicate Google Fonts fetch on every page load; a dead CSS guard
  (`theme-switching` class set by JS, consumed by zero CSS, meant to
  stop a transition storm on populated dashboards during theme swap);
  a ledger-tab active-state font-weight bump that snapped the tab
  wider on selection; a WCAG AA contrast audit that found and fixed 4
  color tokens failing as small text/icons in both themes; a broken
  `onclick` handler (wrong-order escaping) that threw a JS syntax error
  for any budget/subscription/goal name containing an apostrophe.
  Commits: `b3c4c3a`, `d3cbe36`, `a92cc71`, `4d896e2`, `0266fff`,
  `446bdce` on `refactor/modernize-codebase`.
- **Backend security audit**: IDOR/authorization (50 call sites checked,
  several patterns spot-verified by hand) and SQL-injection surface
  both came back clean.
- **A broader frontend sweep** (debounce coverage, client-side money
  float-math, double-submit guards, duplicate-listener risk) also came
  back clean — diminishing returns on more blind grepping there.
- **A real, repo-wide CI bug**: `.github/workflows/ci.yml` had a YAML
  syntax error since 2026-09-10 that silently broke *every* CI run on
  *every branch, including `main`* (zero jobs, bare failure — the file
  simply couldn't parse). Fixed on both `refactor/modernize-codebase`
  (`7afea2e`) and `main` (`25d8401`). Real CI now runs: backend tests,
  Playwright UI/WebAuthn checks, and repository hygiene all pass on
  both branches for real, for the first time.
- **Known open item**: fixing that YAML bug exposed a second, smaller
  bug — the `dashboard-chart-refactor` guard job (meant to only fire on
  an exact magic commit-message string) incorrectly evaluates true and
  runs (then fails) on ordinary commits. A corrected version (removes
  the colon from the trigger string instead of quote-wrapping the `if:`
  expression) is pushed to `refactor/modernize-codebase` (`1804600`)
  but **unverified** — CI stopped triggering on new pushes to that
  branch partway through verification (no run appeared after 7+
  minutes, unlike every prior push which triggered within ~90s; not
  investigated further). **Not** pushed to `main` since it's unverified.
  This doesn't affect the validity of the other jobs' pass/fail results.
- **Mobile white-strip layout question** (from the original recovery
  task, not this audit): inspected via a real rendering pipeline
  (`wkhtmltoimage`/Qt WebKit, engine details below) — no white-strip
  band visible on the modal itself, but the engine predates `dvh`
  support so this is partial, not conclusive, evidence. Needs the
  user's own phone/browser to close out. Live Netlify deploy preview
  for real testing: `https://deploy-preview-29--cozy-narwhal-3099ad.netlify.app`

## 4. Environment constraints confirmed this session (don't re-discover)

- No real interactive browser available by default. `playwright install`
  and WebKitGTK/Selenium (`webkit2gtk-driver` via apt) both fail — the
  former blocked at the CDN (network), the latter hangs at session
  creation even with sandbox/compositing/GL workarounds (real effort
  spent, not just assumed).
- **What does work**: `apt-get install wkhtmltopdf` (provides
  `wkhtmltoimage` too), run with `QT_QPA_PLATFORM=offscreen` — no Xvfb
  needed, renders real HTML/CSS to PNG reliably. Old Qt WebKit engine
  though: no `dvh` support, weak native-select-control theming, doesn't
  reliably compute `transition-duration` on shorthand properties using
  `var()`. Good for layout/visual checks, not trustworthy for anything
  depending on very new CSS or for fine-grained computed-style checks.
- Background daemons (`cmd &`) do **not** persist between separate bash
  tool calls — every dependency (http.server, any driver) plus the
  actual work must launch inside one script file invoked as a single
  call. Inline chained backgrounding is unreliable.
- Maven Central (`repo.maven.apache.org`), `repo1.maven.org`,
  `maven.pkg.github.com`, and JitPack are all blocked (403) — confirmed
  by direct request, not assumed. No local `.m2` cache exists either.
  So `mvn test`/`mvn compile` cannot run in this sandbox at all.
  **This is what makes GitHub Actions CI valuable** — a runner there has
  real unrestricted internet access and can actually build/test the
  backend. Use it for anything requiring a real Maven build or a real
  browser (Playwright is already wired up in `ci.yml`/`web-regression-e2e.yml`).
- GitHub Actions job logs and artifacts redirect to Azure Blob Storage
  (`*.blob.core.windows.net`), not reachable from this sandbox (403,
  confirmed directly). To see actual failure output, add a temporary
  workflow step that posts it via `api.github.com` (reachable) as a PR
  comment, then revert the step once diagnosed.
- `workflow_dispatch` API dispatch can be mysteriously rejected
  ("workflow does not have trigger") if the workflow YAML has *any*
  parse error anywhere in the file, even unrelated to the trigger
  block — this is what happened here. If dispatch is ever rejected
  again, check `yaml.safe_load()` on the file before assuming a
  permissions issue.
- A real GitHub PAT was shared in this conversation's chat history —
  treat any such token from this session as compromised; it should be
  rotated, not reused.

## 5. Survey tracker

Not started yet as of this handoff. Fill in as the analyze-first pass
proceeds — one row per area surveyed, with candidate findings before
any file gets touched.

| Area | Surveyed? | Modern-alternative candidates found | Notes |
|---|---|---|---|
| Backend — Java language/records/pattern matching usage | ☐ | | Java 26 — check for pre-records DTOs, old switch statements, manual null checks vs modern patterns |
| Backend — Spring Boot idioms | ☐ | | Boot 4.x — check for outdated config style, deprecated annotations |
| Backend — JPA/Hibernate patterns | ☐ | | N+1 risk, fetch strategy, outdated repository patterns |
| Frontend — JS language features | ☐ | | Vanilla JS, no build step — check ES-version-appropriate modern syntax usage vs older patterns |
| Frontend — CSS modern features | ☐ | | Already uses some modern CSS (`dvh`, custom properties, `:has()`) — check consistency and remaining old patterns (float layouts? old flexbox workarounds now replaceable by `grid`/`gap`/container queries?) |
| Frontend — DOM APIs | ☐ | | Check for outdated DOM manipulation patterns with modern equivalents available |
| Mobile — React/RN patterns | ☐ | | React 19 — check for pre-hooks patterns, unnecessary re-renders, outdated navigation/state patterns |
| Mobile — Expo APIs | ☐ | | Expo ~57 — check for deprecated Expo SDK APIs with documented replacements |
| E2E — Playwright/TS patterns | ☐ | | Lower priority (test code), but in scope |

## 6. Immediate next action

Start the analyze-first survey pass per §5, beginning wherever makes
sense (backend Java is a reasonable first stop — largest single
codebase, Java 26 is new enough that there's likely real language-level
opportunity). Populate the candidate list for each area *before*
implementing anything, per the user's explicit instruction. Once a
credible candidate list exists across a few areas, switch to one-file-
at-a-time deep inspection and implementation, multiple files per
session, each verified independently (Discover → Inspect → Justify →
Implement → Verify) before moving to the next.
