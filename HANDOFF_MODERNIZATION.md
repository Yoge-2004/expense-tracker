# Expense Tracker — Modernization Handoff

> **Purpose:** durable instructions for continuing the modernization effort without requiring a separate approval/`Continue` prompt for every file.
>
> **Scope of this handoff:** remaining work only. Do **not** treat this document as a changelog.

## 1. Overall objective

Modernize the Expense Tracker codebase to current web/platform capabilities while preserving the application's existing behavior, visual identity, accessibility, responsiveness, and working integrations.

This is a **capability-driven modernization**, not a blind rewrite and not a mechanical search-and-replace exercise. Every change must answer at least one of these questions:

- Does a modern platform capability provide a real benefit here?
- Does the change improve performance, maintainability, accessibility, compatibility, security, or correctness?
- Does it remove unnecessary runtime work or duplicated responsibility?
- Does it make behavior more robust across current browsers and devices?
- Does it reduce technical debt without changing the product contract?

Avoid changes whose only justification is that a syntax/pattern is old.

## 2. Repository/workflow rules

- **Never commit directly to `main`.**
- Use the single long-lived branch **`refactor/modernize-codebase`** for this modernization effort.
- Do not create a new modernization branch for each language or subsystem.
- Work from the latest state of that branch and keep it aligned with the current `main` baseline as appropriate.
- The user reviews the **application as a whole**; implementation should proceed by **one technical concern/language at a time**.
- The user should **not** have to say `Continue` for every file.
- For a language phase, independently enumerate the relevant files, inspect each complete file, follow dependencies when required, and process the entire language phase in one sustained workflow.
- A file is a review boundary, **not** an investigation boundary. Inspect related modules/dependencies whenever necessary to understand behavior.
- Do not stop after finding one matching line. Inspect the whole file and make all justified changes for that file together.
- If a file needs no modernization, record that internally and move on; do not manufacture a commit.
- Keep commits coherent by technical concern. Do not make dozens of tiny pattern-only commits merely to mirror file boundaries.
- Never guess current file contents, SHAs, branches, or dependencies. Re-read the current branch before writing.
- Do not pile on `!important` as a shortcut for cascade problems.
- Preserve existing public/global APIs when compatibility requires them.
- Do not introduce regressions merely to achieve stylistic consistency.

## 3. Phase strategy — language at a stretch

The remaining modernization should be performed in **language/platform phases**, rather than one file per user prompt.

### Phase A — CSS / styling platform

Finish the **entire website CSS modernization audit first**. This includes every CSS file under the website/frontend tree, not just files previously identified by searches.

For each CSS file:

1. Read the complete current file.
2. Understand what owns its selectors and properties.
3. Follow imports, tokens, component selectors, responsive rules, animation definitions, and overrides as needed.
4. Evaluate modern CSS capabilities against the actual use case.
5. Make all justified improvements in that file in the same coherent change.
6. Check for interactions with later/earlier cascade layers and responsive overrides.
7. Avoid mechanical replacements that can alter interaction, animation, layout, or theme behavior.

CSS focus areas:

- Replace unjustified `transition: all` with property-scoped transitions where the animated properties are known and behavior is preserved.
- Prefer CSS-owned visual transitions/animations over JavaScript animation orchestration.
- Audit animation performance, especially full-screen effects, expensive filters, gradients, transforms, and paint-heavy effects.
- Use `prefers-reduced-motion` appropriately and preserve usable interaction without motion.
- Evaluate modern CSS custom properties and semantic design tokens.
- Evaluate **cascade layers (`@layer`)** where they can reduce fragile import-order/specificity coupling without changing behavior.
- Evaluate **CSS nesting** where it materially improves maintainability and browser compatibility is sufficient.
- Evaluate **container queries** for component-level responsive behavior instead of viewport-only rules where appropriate.
- Evaluate `@scope` where it can safely reduce selector leakage.
- Evaluate modern color functions, relative colors, and other current CSS capabilities only where they improve the existing design/system.
- Evaluate `content-visibility`, `contain`, `contain-intrinsic-size`, and related rendering optimizations for genuinely expensive/off-screen content.
- Review layout primitives: grid/flex sizing, overflow, intrinsic sizing, responsive breakpoints, and mobile clipping.
- Review focus-visible states, keyboard interaction styling, contrast, target sizes, and reduced-motion behavior.
- Remove dead/duplicated CSS only when ownership is understood and the behavior is covered elsewhere.
- Avoid introducing unnecessary frameworks or preprocessors.

### CSS architecture goal

End the CSS phase with a coherent, understandable ownership model:

**tokens → base/reset → components → page/feature layers → responsive overrides → intentional animation/motion layers**

Do not reorganize the entire stylesheet tree merely for aesthetics. Restructure only where it materially improves ownership, cascade safety, or maintainability.

## 4. Phase B — JavaScript / browser platform

After CSS is complete, audit the **entire website JavaScript** as one language phase.

Do not blindly convert everything to modules. First understand script loading order, globals, inline handlers, page-specific APIs, and cross-file dependencies.

Focus areas:

- Modern ES2025/ES2026 language features where they improve clarity or correctness.
- ES modules and dependency boundaries where they can be introduced safely.
- Remove dead code, redundant listeners, duplicate DOM work, and unnecessary polling.
- Prefer event-driven readiness APIs/callbacks over polling when the platform/library provides one.
- Use `AbortController`/`AbortSignal` for cancellable fetches and event/listener lifecycles where appropriate.
- Review fetch error handling, cancellation, retries, race conditions, stale responses, and loading states.
- Review DOM querying/mutation frequency and avoid unnecessary layout/style recalculation.
- Use `requestAnimationFrame` only for frame-synchronized visual work.
- Use `requestIdleCallback` only for genuinely deferrable non-critical work, with a fallback where compatibility requires it.
- Evaluate scheduler/prioritization APIs only where they solve a real workload problem.
- Evaluate Web Workers for CPU-heavy work only after measuring/identifying a suitable workload; do not add workers just to appear modern.
- Review timers, intervals, and background work for lifecycle leaks.
- Keep CSS responsible for presentation animations wherever possible.
- Preserve required global functions for legacy inline HTML handlers until those handlers are safely migrated.
- Prefer semantic event listeners and progressive migration over risky all-at-once handler removal.
- Review storage, theme handling, authentication flows, and browser APIs for current best practices.
- Review Google Identity Services/WebAuthn integration for current browser/library behavior without introducing compatibility regressions.
- Review accessibility behavior in JavaScript: focus management, keyboard behavior, dialogs, live regions, and form validation.

### JavaScript architecture goal

Move toward clear responsibilities such as:

**API/data → state/domain logic → UI/controller logic → platform integration**

Keep page-specific behavior isolated where practical. Avoid creating a large generic abstraction layer that obscures simple code.

## 5. Phase C — TypeScript (if/where introduced or present)

Audit TypeScript as its own phase after JavaScript.

Focus on:

- Current TypeScript 6 capabilities and compiler behavior.
- Strict typing at actual integration boundaries.
- Removing unsafe `any` usage where the type can be known.
- Better discriminated unions and domain types for application state.
- Correct DOM/browser API types.
- Type-safe API response boundaries.
- Avoiding type-level complexity that provides little runtime/product value.
- Keeping generated/build output out of source ownership where applicable.

Do not convert JavaScript to TypeScript solely for the label. Conversion must have a maintainability/correctness payoff.

## 6. Phase D — React / frontend framework layer, if applicable

If/when React is part of the active website architecture, audit it as a separate phase.

Focus on current React 19.x capabilities, including:

- Correct component boundaries.
- Modern state/data flow.
- Avoiding unnecessary effects.
- Proper cleanup of subscriptions and async work.
- Suspense/concurrency capabilities where they solve a real loading/rendering problem.
- Accessibility and semantic HTML.
- Avoiding unnecessary memoization and abstraction.
- Preserving responsive behavior and existing visual requirements.

Do not introduce React into a working vanilla website merely because it is modern.

## 7. Phase E — Build/tooling/developer experience

After application-language phases, audit the frontend build and development workflow.

Focus on:

- Current dependency versions and supported browser targets.
- Removing obsolete/polyfill configuration that current browser baselines no longer require, after compatibility verification.
- Fast development feedback and deterministic builds.
- Source maps and production output quality.
- Dependency duplication and unnecessary packages.
- Linting/formatting/static analysis where useful.
- Security/dependency audit practices.
- CI checks that actually validate the frontend.

Do not upgrade dependencies blindly. For each major upgrade, inspect release notes/migration requirements and test the affected behavior.

## 8. Phase F — Testing / verification

Testing is part of modernization, not an afterthought.

The website must be validated at the application level after language phases and after high-risk changes.

Prioritize verification of:

- Login/register flows.
- Google OAuth readiness and fallback behavior.
- WebAuthn behavior.
- Theme switching and persistence.
- Theme transition visual consistency; avoid mixed light/dark states and unnecessary runtime animation work.
- Dashboard loading and refresh behavior.
- Expense/income creation, editing, deletion, and validation.
- Filters, date ranges, custom selects, and date pickers.
- Charts/reports and responsive data presentation.
- Budget/savings/subscription cards.
- Modals/dialogs and keyboard/focus behavior.
- Mobile navigation/top-bar/action areas.
- Ledger/table scrolling and overflow.
- Input icons, form states, and error states.
- Logout/profile/account actions.
- Responsive layouts across narrow mobile, tablet, laptop, and large desktop widths.
- Reduced-motion behavior.
- Keyboard-only navigation and visible focus.

Use Playwright/browser automation where it provides meaningful coverage. Keep tests behavior-oriented rather than implementation-oriented.

## 9. Modern platform research checklist

For every major technology area, follow this cycle:

### Discover → Inspect → Justify → Implement → Verify

**Discover**
- Determine the current stable platform capability and relevant browser support.
- Prefer official specifications/documentation for platform behavior.

**Inspect**
- Find where the project currently solves that problem.
- Read the whole relevant file/module and its dependencies.

**Justify**
- Identify the actual problem, limitation, performance cost, compatibility issue, or maintenance burden.
- Compare the modern capability against the existing implementation.
- Consider fallback and regression risk.

**Implement**
- Make the smallest architecture-appropriate change that captures the real benefit.
- Keep responsibilities clear.
- Preserve externally observable behavior unless a deliberate product correction is required.

**Verify**
- Validate static correctness.
- Run focused browser/application checks.
- Run broader frontend checks after a language phase.
- Inspect visual behavior for UI/motion changes.
- Confirm no accidental API/global/script-order breakage.

## 10. Performance priorities

Performance work must target measurable or clearly explainable costs.

Prioritize:

- Main-thread CPU usage.
- Long tasks and unnecessary synchronous work.
- Layout/style recalculation.
- Paint/compositing cost.
- Full-screen effects and large-area filters.
- Excessive animation frame work.
- Network waterfalls and duplicate requests.
- Unnecessary polling.
- Large/off-screen DOM rendering.
- Event listener and timer lifecycle leaks.
- Repeated DOM queries/mutations.
- Bundle size and unused code.

Do not optimize by removing visual polish. Optimize the implementation of the visual polish.

## 11. Accessibility priorities

Modernization must not trade accessibility for visual effects.

Check:

- Semantic HTML first.
- Correct labels and form associations.
- Keyboard operability.
- `:focus-visible` and clear focus indicators.
- Dialog semantics and focus management.
- Appropriate ARIA only when native semantics are insufficient.
- Reduced motion.
- Contrast and readable states in both themes.
- Touch target sizing.
- Error/status announcements where needed.
- No interaction that depends exclusively on hover or animation.

## 12. Compatibility and browser-baseline strategy

Use modern capabilities where current browser support makes them appropriate, but do not assume every latest API is universally available.

For each capability:

- Determine the project's real supported browser/device range.
- Prefer progressive enhancement.
- Provide a simple fallback when the feature is non-essential.
- Do not ship feature-detection code for capabilities that are guaranteed by the project's actual baseline.
- Do not retain legacy complexity without a compatibility reason.

## 13. Visual/design preservation

The product should remain a modern SaaS/enterprise-style Expense Tracker rather than becoming a generic minimalist demo.

Preserve the established design intent while modernizing implementation:

- Rich, intentional visual hierarchy.
- Responsive behavior across device sizes.
- Full-page/ambient visual treatment where already part of the product design.
- Consistent interaction states and transitions.
- No unnecessary purple color direction.
- Avoid blue/green gradient treatment for the mobile app icon.
- Motion should feel deliberate and performant, with CSS owning visual transitions where possible.

Modernization is not permission to redesign the product from scratch.

## 14. What must NOT happen

- Do not perform a blind global `transition: all` replacement.
- Do not replace working code solely because a newer syntax exists.
- Do not migrate every script to modules without dependency analysis.
- Do not introduce React/TypeScript/workers/etc. without a concrete benefit.
- Do not move animation logic into JavaScript when CSS can own it cleanly.
- Do not remove compatibility code until its consumers are verified.
- Do not alter backend/mobile code during the current website modernization phase.
- Do not create a branch per file or per language.
- Do not require user confirmation between individual files.
- Do not commit directly to `main`.
- Do not make large unrelated UI redesigns under the name of modernization.

## 15. Completion criteria

The website modernization phase is complete only when:

- Every relevant website CSS file has been audited as a complete file.
- CSS modernization opportunities have been evaluated against current capabilities and actual usage.
- The website JavaScript has subsequently been audited as a complete language phase.
- Relevant TypeScript/framework/build layers have been audited if present.
- High-risk browser behavior has focused automated/manual verification.
- Responsive behavior has been checked across the supported device classes.
- Accessibility and reduced-motion behavior have been checked.
- Performance-sensitive changes have a concrete rationale.
- No unexplained dead infrastructure, duplicated ownership, or fragile cascade/runtime behavior remains from the modernization work.
- The final branch is clean, coherent, reviewable, and ready for a whole-application review before merging.

## 16. Immediate next action

**Start with the CSS phase and finish the entire website CSS audit in one sustained pass.**

Do not wait for another `Continue` between CSS files. Enumerate the current website CSS surface, process each relevant file using the **Discover → Inspect → Justify → Implement → Verify** cycle, and keep all changes on `refactor/modernize-codebase`.

After the CSS phase is complete and verified, move to JavaScript, then TypeScript/framework/tooling as applicable, followed by comprehensive verification.
