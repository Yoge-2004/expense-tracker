# Expense Tracker — Modernization & Code Quality Guide

> Engineering guardrails for modernizing the repository safely. This document complements `CLAUDE.md` and `HANDOFF_MODERNIZATION.md` and is intended to remain useful after the current recovery work.

## 1. Core rule

Modernize for a concrete benefit: correctness, security, performance, accessibility, compatibility, maintainability, observability, or reduced technical debt.

Do not replace working code merely because a newer syntax exists.

Use:

**Discover → Inspect → Justify → Implement → Verify**

## 2. Code-smell policy

Continuously identify and reduce:

- dead/unreachable code;
- duplicated logic and duplicated constants;
- unused imports/dependencies/listeners;
- overly large functions/classes/modules;
- unclear ownership and mixed responsibilities;
- unnecessary global state;
- hidden side effects;
- fragile ordering assumptions;
- repeated DOM queries or API calls;
- unnecessary polling/timers;
- broad exception/error swallowing;
- magic values that belong in configuration/tokens;
- stale compatibility code with no verified consumer;
- copy-pasted validation/business rules;
- inconsistent naming and public API contracts;
- premature abstractions and abstraction layers with no real reuse;
- comments that describe obsolete behavior;
- tests coupled to implementation details rather than behavior.

A smell is not automatically a bug. Remove or refactor it only after understanding its callers, dependencies, and runtime behavior.

## 3. Deprecated-code policy

For every deprecated API, annotation, library, configuration, or platform pattern:

1. Locate every usage.
2. Identify the deprecation reason and replacement.
3. Check the project's actual framework/runtime version.
4. Check migration notes or official documentation when the change is version-sensitive.
5. Verify all callers and compatibility requirements.
6. Replace it only when the replacement preserves or intentionally improves behavior.
7. Remove now-dead compatibility code after its consumers are verified.
8. Run the relevant tests and runtime checks.

Do not silence deprecation warnings merely to obtain a clean build.

## 4. Java quality checks — Spring Boot

For Java/Spring code, inspect:

### Correctness

- nullability and Optional usage at boundaries;
- validation and constraint placement;
- transaction boundaries and propagation;
- entity lifecycle behavior;
- JPA relationship ownership, fetch strategy, and N+1 risks;
- pagination and query correctness;
- date/time and timezone handling;
- authorization checks at service/controller boundaries;
- idempotency for operations that may be retried;
- exception mapping and useful HTTP status codes.

### Maintainability

- single responsibility for controllers/services/repositories;
- constructor injection;
- coherent DTO/entity boundaries;
- avoid business logic hidden in controllers or entities without a reason;
- remove unused methods and stale compatibility APIs only after caller analysis;
- avoid unnecessary Lombok magic when it obscures behavior;
- keep method signatures consistent with actual callers.

### Security

- never hard-code secrets;
- validate and constrain user-controlled input;
- review authentication and authorization paths;
- password handling must use a strong password encoder;
- review CORS and CSRF decisions against the deployment architecture;
- avoid sensitive information in logs/errors;
- review dependency vulnerabilities.

### Performance

- inspect generated SQL for expensive paths;
- prevent N+1 queries;
- paginate potentially large collections;
- avoid loading unnecessary entity graphs;
- review transaction scope;
- avoid repeated repository calls when one query can provide the required data.

## 5. JavaScript/browser quality checks

For frontend JavaScript:

- preserve public/global APIs until all consumers are migrated;
- inspect script loading order and inline handlers before module conversion;
- prefer modules with explicit dependencies where safe;
- use event-driven APIs instead of polling where possible;
- cancel stale fetches with AbortController when appropriate;
- handle network errors, retries, cancellation, and race conditions;
- avoid duplicate event listeners;
- avoid unnecessary DOM reads/writes and layout thrashing;
- keep visual animation in CSS where practical;
- use requestAnimationFrame only for frame-synchronized work;
- clean up timers, observers, listeners, and subscriptions;
- avoid accidental global variables;
- validate API response shapes at boundaries;
- avoid unsafe HTML injection and review URL/input handling;
- test real browser behavior, not only source-level assumptions.

### Browser performance

When a UI action is slow, inspect:

- long tasks;
- style recalculation;
- layout/reflow;
- paint/compositing;
- expensive filters/backdrop effects;
- animation frame workload;
- duplicate network requests;
- chart redraw cost;
- large DOM updates.

Do not hide performance problems by removing useful UI behavior without understanding the cost.

## 6. CSS quality checks

For every CSS file:

- identify ownership of selectors;
- remove dead rules only after checking consumers;
- avoid `transition: all` when animated properties are known;
- audit specificity and cascade conflicts;
- consider `@layer` when it materially improves ownership;
- consider nesting/container queries/`@scope` only where they improve maintainability and support is appropriate;
- use semantic design tokens;
- avoid duplicated theme values;
- inspect responsive overflow and intrinsic sizing;
- review expensive filters and large-area effects;
- preserve focus-visible states and touch targets;
- support reduced motion;
- verify both light and dark themes;
- verify computed styles in a real browser.

Never introduce malformed/generated CSS. After programmatic edits, inspect the actual file contents and load it in a browser.

## 7. React / React Native / Expo quality checks

Where React or React Native/Expo is present:

- component boundaries should reflect real responsibilities;
- avoid unnecessary effects and derived state stored as state;
- clean up subscriptions/listeners on unmount;
- avoid unnecessary re-renders and expensive list rendering;
- use stable keys;
- virtualize large lists;
- keep navigation and screen state predictable;
- handle loading/error/empty states;
- preserve accessibility semantics and touch target sizes;
- use platform APIs according to current supported versions;
- avoid assuming web APIs exist on native platforms;
- verify behavior on actual device/emulator for platform-specific features.

For Expo/native notifications, permissions and notification delivery must be tested against the actual target OS behavior rather than mocked assumptions.

## 8. TypeScript quality checks

If TypeScript is introduced or present:

- enable strict checking where practical;
- eliminate avoidable `any`;
- type API boundaries and domain objects;
- use discriminated unions for meaningful state machines;
- type DOM/native platform APIs correctly;
- avoid excessive generic/type-level cleverness;
- ensure build output does not become source ownership;
- keep runtime validation where compile-time types cannot protect external data.

## 9. HTML/accessibility checks

- semantic elements before ARIA;
- labels associated with controls;
- keyboard operation for interactive controls;
- visible focus states;
- dialogs with correct focus management;
- status/error messaging accessible to assistive technology;
- sufficient contrast in both themes;
- no hover-only critical interactions;
- appropriate mobile target sizes;
- reduced-motion support;
- valid document structure and no accidental duplicate IDs.

## 10. Tests — improvement policy

Tests should increase confidence, not merely increase line count.

### Test pyramid

Use multiple layers:

1. **Unit tests** — pure domain/business logic and deterministic utilities.
2. **Integration tests** — Spring services/repositories/security and real application boundaries where practical.
3. **Browser/E2E tests** — critical user-visible workflows.
4. **Real-device tests** — platform-specific mobile behavior such as notifications, biometrics, permissions, and deep links.

### Test quality rules

- test behavior and user outcomes;
- keep tests deterministic;
- avoid arbitrary sleeps;
- use explicit readiness conditions;
- avoid weakening assertions to make CI pass;
- include negative/error cases;
- include empty/loading states where relevant;
- test authorization boundaries;
- test duplicate/idempotent operations;
- test responsive behavior at representative breakpoints;
- test light/dark theme behavior;
- test reduced motion where motion is important;
- test keyboard/focus behavior for dialogs and forms;
- clean up test data and browser state;
- keep mocks faithful to real contracts.

### Critical regression coverage

Maintain coverage for:

- authentication and registration;
- OAuth fallback/readiness;
- WebAuthn;
- expense/income CRUD;
- validation;
- dashboard refresh;
- charts;
- filters/date ranges;
- subscriptions/budgets;
- modals;
- profile/logout/account actions;
- theme switching with populated data;
- mobile navigation and action areas;
- ledger tabs/counters/overflow;
- input icons;
- notification permission and ingestion behavior when implemented.

## 11. Verification before completion

A change is not complete because a file was edited or a focused test passed.

Before claiming completion, provide evidence from the appropriate checks:

- static/build/lint/type checks;
- focused automated tests;
- broader test suite where appropriate;
- browser runtime verification for web behavior;
- device/emulator verification for native behavior;
- performance measurements for performance claims;
- inspection of changed public APIs and their callers;
- clean git diff with no accidental unrelated changes.

If verification cannot be performed, state exactly what was and was not verified.

## 12. Documentation discipline

Keep these documents aligned:

- `CLAUDE.md` — agent workflow and project-level instructions;
- `HANDOFF_MODERNIZATION.md` — current modernization recovery scope and phase strategy;
- `MODERNIZATION_CODE_QUALITY.md` — durable engineering/code-quality rules;
- `PRODUCT_ROADMAP.md` — future product features and intelligent-expense direction;
- `docs/superpowers/specs/2026-09-14-financial-transaction-ml-design.md` — future ML transaction-intelligence design.

When implementation changes materially alter a documented contract, update the relevant document in the same coherent change.
