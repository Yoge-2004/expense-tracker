# Claude Code Project Instructions

## Everything Claude Code

This project uses the **Everything Claude Code (ECC)** methodology as an optional agent-harness enhancement.

Upstream repository:
https://github.com/affaan-m/ECC

Before substantial implementation work, inspect the current ECC guidance and use the relevant skills, verification loops, research-first workflow, parallelization guidance, and context-management practices where they improve the task.

If ECC is not installed in the current Claude Code environment, do not block the task. Use the upstream repository as reference and continue with the project-specific instructions below.

For this repository, prioritize ECC practices around:

- systematic debugging before fixing
- research before unfamiliar implementation
- small, reversible changes
- preserving existing runtime contracts
- behavior-level verification rather than source-only checks
- browser/runtime verification for frontend work
- focused parallel work only when tasks are genuinely independent
- context preservation during long implementation sessions
- verification before claiming completion
- security-conscious handling of secrets

## Project documentation hierarchy

Treat these documents as durable project context and read the relevant ones before substantial work:

- `CLAUDE.md` — agent workflow, priorities, and project-wide rules.
- `HANDOFF_MODERNIZATION.md` — current modernization recovery scope and phase strategy.
- `MODERNIZATION_CODE_QUALITY.md` — language-specific modernization, code-smell, deprecation, testing, accessibility, security, and verification rules.
- `PRODUCT_ROADMAP.md` — future product capabilities, including automatic transaction ingestion, purchase/payment notification capture, notification UX, and intelligent-finance features.
- `docs/superpowers/specs/2026-09-14-financial-transaction-ml-design.md` — future ML transaction-intelligence architecture and design reference.

These documents are complementary. Do not discard the roadmap or ML design merely because implementation is currently paused.

## Expense Tracker project rules

- Main branch must remain protected until work is verified.
- Current modernization work belongs on `refactor/modernize-codebase` unless explicitly instructed otherwise.
- Never treat a passing focused test as proof that the complete application works.
- Inspect callers before changing public JavaScript functions or module boundaries.
- Verify computed styles and actual browser behavior for UI changes.
- Verify real theme switching with populated expense data.
- Do not weaken tests to make CI pass.
- Do not claim completion without actual verification evidence.
- Preserve existing functionality while modernizing.
- Avoid purple as a primary UI palette color.
- Do not begin future roadmap/ML implementation during modernization recovery unless explicitly instructed.

## Modernization and code quality

Modernization is capability-driven, not a blind rewrite. For every language/platform, use:

**Discover → Inspect → Justify → Implement → Verify**

Continuously reduce justified code smells, duplicated responsibility, dead code, fragile globals, unnecessary runtime work, stale compatibility code, unsafe patterns, and implementation-coupled tests. Do not remove or replace code merely because it is old-looking.

For deprecated APIs/framework features:

1. Find all consumers.
2. Confirm the actual project/runtime version.
3. Research the supported replacement and migration requirements.
4. Preserve behavior and compatibility.
5. Remove obsolete compatibility code only after consumers are verified.
6. Run the relevant tests and runtime checks.

Use `MODERNIZATION_CODE_QUALITY.md` for the detailed Java/Spring, JavaScript/browser, CSS, React/React Native/Expo, TypeScript, HTML/accessibility, testing, security, and performance checks.

## Future product capabilities to preserve as explicit roadmap

The future product direction includes an intelligent, privacy-conscious transaction-ingestion pipeline. In particular, do not lose these requirements while modernizing:

### Purchase/payment notification capture

A future mobile feature should support an **opt-in** path for detecting purchase/payment notifications from supported banking/payment apps, subject to actual Android/iOS capabilities, permissions, privacy requirements, and platform policy.

Intended flow:

**purchase → allowed notification event → extraction → merchant normalization → classification/confidence → duplicate/idempotency check → auto-create or review inbox → user correction → personalization**

Do not assume unrestricted access to notification contents. Implement only APIs/platform mechanisms actually available to the target platform and make permission, data use, disable/revoke behavior, and privacy explicit.

### Notification UX and icon

Future notifications should be useful and explainable rather than random/noisy. Potential events include newly detected transactions, review requests, duplicates, anomalies, recurring/subscription detection, budget risk, refunds, salary/income detection, cash-flow warnings, and financial-calendar reminders.

The mobile notification icon should be redesigned separately from the launcher icon: simple, recognizable at small sizes, platform-compliant, consistent with the product design, non-purple in direction, and without blue/green gradient treatment. Verify on real target devices where platform notification rendering matters.

### Broader intelligent-finance roadmap

Preserve the planned direction for:

- OCR/receipt capture;
- bank SMS/app/notification/statement ingestion where supported;
- merchant normalization;
- smart categorization and confidence scoring;
- review inbox and correction learning loop;
- duplicate protection;
- recurring/subscription intelligence;
- salary/income intelligence;
- refund matching;
- anomaly detection;
- budget intelligence;
- financial calendar;
- cash-flow forecasting;
- financial health dashboard;
- semantic transaction search;
- natural-language transaction entry;
- financial copilot;
- privacy-conscious personalization/ML.

Use `PRODUCT_ROADMAP.md` for sequencing and `docs/superpowers/specs/2026-09-14-financial-transaction-ml-design.md` for the ML design. These are future work, not current modernization scope.

## Current recovery priority

The immediate priority is recovering and stabilizing the modernization work, especially:

1. actual browser font rendering;
2. theme-switch performance with populated expense data;
3. chart/theme runtime behavior;
4. modal behavior;
5. mobile Record Expense/Income layout;
6. ledger tab/counter interaction;
7. input icons;
8. safe JavaScript modularization;
9. frontend and backend verification separately.

The detailed task context supplied with this project should be treated as the acceptance specification for the recovery work.

## Testing philosophy

Improve tests as part of modernization. Prefer a layered strategy:

- unit tests for deterministic domain logic;
- integration tests for Spring services/repositories/security and real boundaries;
- Playwright/browser tests for critical web workflows;
- real-device/emulator tests for mobile platform behavior such as notifications, permissions, biometrics, and deep links.

Tests must be behavior-oriented, deterministic, meaningful, and resistant to false positives. Include negative/error paths, authorization boundaries, empty/loading states, responsive behavior, theme switching, accessibility, and regression coverage for critical existing functionality.

Mocks must remain faithful to real API/platform contracts. Do not weaken assertions or add arbitrary sleeps to make CI pass.
