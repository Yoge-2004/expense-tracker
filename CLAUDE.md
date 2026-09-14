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
