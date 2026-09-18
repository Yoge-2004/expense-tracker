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

Completed survey phase per directive. Candidate list populated across all in-scope domains:

| Area | Surveyed? | Modern-alternative candidates found | Notes |
|---|---|---|---|
| Backend — Java language/records/pattern matching usage | ☑ | 1. `ErrorResponse.java`: convert pure immutable DTO (all-final fields, getters only) to Java `record`.<br>2. Stream modern syntax: replace `Stream.collect(Collectors.toList())` with unmodifiable, cleaner Java 16+ `Stream.toList()` across services/controllers.<br>3. `GlobalExceptionHandler.java`: deduplicate repeated multi-instance unreachability traversal into a single reusable helper. | Verified via IntelliJ IDEA engine. |
| Backend — Spring Boot idioms | ☑ | 1. Remove field injection in `WebMvcConfig.java` (`RateLimitInterceptor`) and `ExportServiceImpl.java` (`BudgetRepository`) in favor of constructor injection.<br>2. Retire deprecated `xssProtection` header in `SecurityConfig.java` and use lambda/method reference modern idioms. | Constructor injection is standard in Spring Boot 4.x. |
| Backend — JPA/Hibernate patterns | ☑ | 1. `Budget.java` & `RecurringExpense.java`: add `fetch = FetchType.LAZY` to `@ManyToOne` (defaults to EAGER, causing unneeded entity graph loading).<br>2. `ExpenseRepository.findByUser`: add `LEFT JOIN FETCH e.category` to eliminate N+1 select queries during DTO mapping. | Solves real database performance bottlenecks. |
| Frontend — JS language features | ☑ | 1. Add request timeout guard using modern `AbortSignal.timeout()` in `apiRequest()` in `frontend/js/api.js` to protect against hung network requests during cold starts. | Prevents silent infinite loading hangs. |
| Frontend — CSS modern features | ☑ | 1. `frontend/css/modals.css` & `layout.css`: eliminate un-scoped `transition: all` on buttons and status badges, targeting explicit visual properties (`border-color, background-color, box-shadow, transform, opacity`). | Eliminates unwanted layout reflows and paint jank during state changes. |
| Frontend — DOM APIs | ☑ | 1. Replace legacy `element.innerHTML = ""` with modern `element.replaceChildren()` in `frontend/js/custom-controls.js` and `frontend/js/dashboard.js`. | High-performance, avoids HTML parser overhead and memory leaks. |
| Mobile — React/RN patterns | ☑ | 1. `mobile/services/api.ts`: fix TS2345 type error (`AbortSignal | null | undefined` vs `AbortSignal | undefined` in `waitForRetry`).<br>2. `mobile/app/(tabs)/_layout.tsx`: optimize tab listeners and memoization. | Ensures clean TypeScript compilation. |
| Mobile — Expo APIs | ☑ | 1. `mobile/jest.config.js`: convert from invalid raw JSON to valid Node module `module.exports = { ... };` so Jest tests run successfully. | Enables local mobile test runner. |
| E2E — Playwright/TS patterns | ☑ | 1. Verify locator resilience (`getByRole`, `getByLabel`) in Playwright test suites. | Playwright best practice. |

## 6. Implementation & Verification Status

Completed multi-file implementation and verification across Modules 1–6 following the Discover → Inspect → Justify → Implement → Verify cycle:

### Module 1: Java Backend Dependency Injection & JPA Optimization (COMPLETED)
- **`WebMvcConfig.java`**: Replaced `@Autowired(required = false)` and `@Value` field injections with constructor injection and `final` fields.
- **`ExportServiceImpl.java`**: Replaced `@Autowired(required = false)` field injection with constructor injection; added overloaded constructor for backward-compatible instantiation.
- **`Budget.java` & `RecurringExpense.java`**: Added explicit `(fetch = FetchType.LAZY)` to `@ManyToOne` associations for `User` and `Category`, eliminating default eager query cascades.
- **`ExpenseRepository.java`**: Added `LEFT JOIN FETCH e.category` to `findByUser` query, resolving N+1 database queries on expense retrieval.
- **Verification**: Validated via IntelliJ IDEA MCP `get_file_problems` (`errors: []`), `lint_files` (`problems: []`), and `build_project` (`isSuccess: true, problems: []`).

### Module 2: Java Backend Records, Exception Deduplication & Modern Streams (COMPLETED)
- **`ErrorResponse.java`**: Modernized from boilerplate class to immutable Java `record` with getter compatibility aliases for tests and serializers.
- **`AuthResponse.java`**: Modernized from class to immutable Java `record` with backward-compatible JavaBean-style getters.
- **`GlobalExceptionHandler.java`**: Extracted duplicate multi-exception database unreachability inspection loop into `findDatabaseUnavailableCause(Throwable)`.\n- **Stream API Modernization**: Modernized 13 occurrences of `Stream.collect(Collectors.toList())` to modern Java 16+ `Stream.toList()` across `ExportServiceImpl.java`, `IncomeServiceImpl.java`, `SavingsGoalServiceImpl.java`, `MonthlyReportServiceImpl.java`, `ExpenseController.java`, `CategoryController.java`, and `RangeReportController.java`.
- **`application.properties`**: Enabled Java 21+ Project Loom virtual threads (`spring.threads.virtual.enabled=true`) for non-blocking high-throughput concurrency.
- **Verification**: Validated via IntelliJ IDEA MCP `get_file_problems` and `build_project` (`isSuccess: true, problems: []`).

### Module 3: Frontend CSS Transitions & DOM Modernization (COMPLETED)
- **`frontend/css/modals.css`**: Eliminated all 8 occurrences of performance-degrading `transition: all` on status badges, OAuth buttons, filter tabs, and modal actions; replaced with explicit composited properties (`color, background, border-color, box-shadow, transform, opacity`).
- **`frontend/css/auth/dashboard/layout.css`**: Scoped remaining un-targeted `transition: all` on `.suggestion-chip` to explicit properties (`background, color, transform, box-shadow`).
- **`frontend/js/api.js`**: Added modern `AbortSignal.timeout(...)` and `AbortSignal.any(...)` timeout management to `apiRequest()` to prevent hanging network requests during backend cold starts.
- **`frontend/js/custom-controls.js`**: Added `{ passive: true }` to window resize event listener to prevent main thread event loop contention.
- **`frontend/js/custom-controls.js` & `frontend/js/dashboard.js`**: Replaced `.innerHTML = ""` with standard DOM `.replaceChildren()` on select lists, datepicker grids, and report period chips to avoid HTML parsing overhead and DOM reflow thrashing.

### Module 4: Mobile TypeScript & Jest Test Runner (COMPLETED)
- **`mobile/services/api.ts`**: Fixed TS2345 type mismatch in `waitForRetry` (`AbortSignal | null | undefined`), making TypeScript compilation 100% clean.
- **`mobile/app/(tabs)/_layout.tsx`**: Replaced loose `any` typing on `TabIconProps.color` with `ColorValue | string`.\n- **`mobile/jest.config.js`**: Converted from invalid raw JSON to CommonJS module `module.exports = { ... };`.
- **`mobile/services/currency.ts`**: Corrected currency formatting to use `'en-US'` locale for non-INR currencies (fixing bug where USD `$1,000,000` was rendered as `$10,00,000`).
- **`mobile/__tests__/setup.ts` & `auth-context.test.ts`**: Configured `@react-native-async-storage/async-storage` and `expo-secure-store` mocks, and updated dynamic imports to CommonJS `require()`.\n- **Verification**: `npm --prefix mobile run ts:check` exited with code 0. `npm --prefix mobile test` passed 3/3 test suites, 44/44 tests passed!

### Module 5: Comprehensive Sequential Backend Modernization (Java 26 / Spring Boot 4.1.1) (COMPLETED)
- **Package 1 (`dto/` - 23/23 files)**: Modernized 100% of DTOs into canonical Java `record`s. Replaced every call site across services, controllers, mappers, and test suites with canonical record accessors (`.field()`), completely eliminating all JavaBean getter shims (`get*()`). (Commit: `b9cd935`).
- **Package 2 (`model/` - 12/12 files)**: Inspected line by line. Verified JPA annotations, equals/hashCode contracts, and bidirectional entity associations.
- **Package 3 (`repository/` - 11/11 files)**: Inspected line-by-line. Added custom deletion queries to `MonthlyReportLogRepository` and `WebAuthnCredentialRepository` for complete cascade deletions on user account removal. (Commit: `30f8807`).
- **Package 4 (`service/` & `service/impl/` - 27 files)**: Inspected line-by-line. Hardened `RecurringExpenseScheduler` against potential infinite loops during next-due recalculations. Wired complete user account deletion cascade into `UserServiceImpl.deleteUser` (`monthlyReportLogRepository.deleteByUser(user)` and `webAuthnCredentialRepository.deleteByUser(user)`). (Commits: `b3332b8`, `30f8807`).
- **Package 5 (`mapper/` - 5/5 files)**: Inspected line-by-line. Verified conversion fidelity between JPA models and modern immutable records.
- **Package 6 (`config/` & `security/` - 23 files)**: Inspected line-by-line. Verified modern JJWT 0.12+ parser API, Spring Security 6/Boot 4 lambda DSL, sliding window rate limiter, and virtual thread concurrency configuration.
- **Package 7 (`controller/` - 12/12 files)**: Inspected line-by-line. Pruned unused imports (`Collectors`) and removed dead authorization method `hasAuthenticatedSession` in `SyncController`. Verified IDOR security validation (`userSecurity.validateUserAccess`) across all user endpoints. (Commit: `0b95c68`).
- **Package 8 (`exception/` - 3 files)**: Inspected line-by-line. Confirmed central exception mapping to `ErrorResponse` record, handling all data integrity, constraint, type mismatch, and rate-limiting errors.
- **Package 9 (`ExpenseTrackerSystemApplication.java`)**: Inspected line-by-line. Verified clean Spring Boot 4 bootstrap and scheduled task enablement.
- **Verification**: Full test suite `./mvnw test` executed: **157 tests run, 0 failures, 0 errors, 19/19 Cucumber BDD scenarios passed (100% BUILD SUCCESS)**. IntelliJ IDEA `build_project` compiled with zero problems.

### Module 6: Production Structured Logging & Resilient HTTP Error Handling (COMPLETED)
- **MDC Correlation & Distributed Tracing**: Added `CorrelationIdFilter` to automatically extract or generate `traceId` (UUID) across all incoming HTTP requests, recording `userId`, `clientIp`, `method`, `uri`, and request completion duration in milliseconds. Propagated `traceId` via HTTP response header `X-Trace-Id`.
- **Credential & PII Redaction**: Built `MaskingPatternConverter` to automatically sanitize sensitive credentials (passwords, tokens, bearer headers, refresh tokens, WebAuthn raw credentials) in log streams using regex masking. Built `LoggingUtils` with email anonymization (e.g., `e***r@test.com`).
- **Profile-Specific Log Appenders**: Configured `logback-spring.xml` with async, rolling-file loggers (`logs/expense-tracker.log`) configured with max history, size capping, and clean pattern formatting.
- **Deep Service & Controller Instrumentation**: Implemented detailed, contextual log statements across authentication (`AuthController`, `UserServiceImpl`, `PasswordResetServiceImpl`), financial transactions (`ExpenseController`, `ExpenseServiceImpl`, `IncomeController`, `IncomeServiceImpl`), exports (`RangeReportController`, `ExportServiceImpl`), and WebAuthn ceremonies (`WebAuthnController`, `WebAuthnService`).
- **Comprehensive HTTP Status Code Handling**: Expanded `GlobalExceptionHandler` to cleanly map:
  - `HttpRequestMethodNotSupportedException` -> HTTP 405 Method Not Allowed
  - `HttpMediaTypeNotSupportedException` -> HTTP 415 Unsupported Media Type
  - `HttpMediaTypeNotAcceptableException` -> HTTP 406 Not Acceptable
  - `MissingServletRequestParameterException` -> HTTP 400 Bad Request
  - `MultipartException` -> HTTP 400 Bad Request
  - `NoResourceFoundException` -> HTTP 404 Not Found
- **Resilient File Import Validation**: Hardened `ImportServiceImpl` with null and empty multipart file checks and Jackson `JsonProcessingException` trapping, turning malformed JSON payloads into client-safe 400 Bad Request errors rather than unhandled 500s.
- **Verification**: Executed `./mvnw test`: **163 tests run, 0 failures, 0 errors, 19/19 Cucumber BDD scenarios passed (100% BUILD SUCCESS)**. (Commits: `ce20ce0`, `80f29ab`).

### Module 7: Fail-Fast Screaming Architecture, Global Exception Mapping & Frontend Sync (COMPLETED)
- **Eliminated Silent Failures in Email Delivery**:
  - In `PasswordResetServiceImpl.java`, replaced swallowed `MailException` with fail-fast `throw new EmailDeliveryException(...)`, cleanly caught and mapped to HTTP 503 SERVICE_UNAVAILABLE while preserving 6-digit PIN zero-email recovery.
- **Fail-Fast File Import Validation**:
  - In `ImportServiceImpl.java`, hardened all 6 import pipelines (Expenses & Incomes CSV/JSON/Excel) with screaming checks: throws `IllegalArgumentException` fail-fast if a file contains 0 data rows or if 100% of rows fail parsing/validation, preventing silent empty imports.
- **Sync & Backup Real HTTP Error Status Codes**:
  - In `SyncController.java`, converted silent fake 200 responses to real HTTP 500 `INTERNAL_SERVER_ERROR` when backup or pull operations report error status. Updated `SyncControllerTest.java` to assert 500.
- **WebAuthn Credential Management Endpoint**:
  - Added `@DeleteMapping("/credentials")` to `WebAuthnController.java` to complete biometric credential management and pass all WebMvc tests.
- **Frontend-Backend Currency & Default Alignment**:
  - Synchronized default fallback currency across `frontend/dashboard.html`, `frontend/js/api.js`, `frontend/js/auth.js`, and `frontend/js/dashboard.js` to `INR` to match backend user entity defaults.
  - Added screaming UI toasts and error logs for user currency persistence failures in `dashboard.js` and data fetch failures in `dashboard-data.js` instead of silent console swallows.
- **Verification**: Executed `./mvnw test`: **163 tests run, 0 failures, 0 errors, 19/19 Cucumber BDD scenarios passed (100% BUILD SUCCESS)**.

### Module 8: Decoupled Service Interfaces & Architecture Modernization (COMPLETED)
- **Extracted Interfaces for All Concrete Services**:
  - `WebAuthnService`: Converted to clean interface `WebAuthnService` with implementation moved to `com.example.expensetracker.service.impl.WebAuthnServiceImpl`.
  - `DatabaseSnapshotService`: Converted to interface `DatabaseSnapshotService` with implementation moved to `com.example.expensetracker.service.impl.DatabaseSnapshotServiceImpl`, preserving static cryptographic helpers (`encrypt`/`decrypt`).
  - `FileDbSyncService`: Converted to interface `FileDbSyncService` with implementation moved to `com.example.expensetracker.service.impl.FileDbSyncServiceImpl`.
  - `HuggingFaceDatabaseFailoverService`: Converted to interface `HuggingFaceDatabaseFailoverService` with implementation moved to `com.example.expensetracker.service.impl.HuggingFaceDatabaseFailoverServiceImpl`.
  - `JwtService`: Converted to interface `JwtService` with implementation moved to `com.example.expensetracker.security.impl.JwtServiceImpl`.
  - `RateLimiterService`: Converted to interface `RateLimiterService` with implementation moved to `com.example.expensetracker.security.impl.RateLimiterServiceImpl`.
- **Cleaned Scheduling Architecture**:
  - Refactored `RecurringExpenseScheduler`, `RecurringIncomeScheduler`, and `RecurringSavingsScheduler` from `@Service` to `@Component` to strictly align background scheduled tasks with Spring lifecycle conventions.
- **Verification**: Executed `./mvnw test`: **163 tests run, 0 failures, 0 errors, 19/19 Cucumber BDD scenarios passed (100% BUILD SUCCESS)**.

## 7. Next Actions

1. Review and proceed to frontend web modernizations (HTML/CSS/JS) if requested.
2. Push commits to `origin/refactor/modernize-codebase`.

## 8. Division of labor (to avoid parallel-session conflicts)

As of this update: the project owner + a Gemini-based agent are working
directly on **backend Java and frontend JS**. Claude (this chat) is
scoped to **HTML, CSS, and TypeScript** (`mobile/`, `e2e/`) only, to
avoid the kind of overwrite conflicts parallel sessions have caused
before (see `/areas/expense-tracker-pro.md` memory). Concretely:

- **Off-limits to Claude for now**: `src/main/java/**`, `frontend/js/**`
- **Claude's scope**: `frontend/*.html`, `frontend/css/**`, `mobile/**/*.ts(x)`,
  `e2e/**/*.ts`
- Module 3 above already did `transition: all` cleanup in
  `frontend/css/modals.css` and `frontend/css/auth/dashboard/layout.css`
  — check current state of a file before assuming it's untouched.
- Always `git fetch`/`git log HEAD..origin/<branch>` before starting new
  work in this shared branch — the other session commits independently
  and this doc may be stale relative to the actual repo state.

## 9. Claude's HTML/CSS/TS survey (scoped per §8)

Survey only — nothing implemented yet, pending priority direction.

| Area | Finding | Confidence | Notes |
|---|---|---|---|
| HTML | 22 `<script>` tags in dashboard.html, zero use `defer`/`type="module"` | Real, but low-priority | Implementing properly means converting `window.X =` global exports to ES module `export`/`import` — that's a JS-architecture change, not an HTML-only one. **Needs coordination before touching**, since it crosses into the JS scope owned by user+Gemini. |
| HTML | DOCTYPE, `lang`, charset-first ordering, semantic elements (`main`/`header`/`section`), image alt text | All already correct | No finding |
| CSS | `-ms-overflow-style: none` (4 occurrences: `tables/controls.css`, `auth/forms.css`, `auth/layout.css`, `auth/dashboard/layout.css`) | High confidence, safe | IE-only prefix; IE has been EOL since 2022. Dead code. |
| CSS | `-webkit-overflow-scrolling: touch` (2 occurrences) | Medium confidence | Legacy iOS Safari momentum-scroll hint, default behavior in modern iOS for years now. Likely removable, harmless either way. |
| CSS | `-webkit-background-clip`/`-webkit-text-fill-color`, `-webkit-calendar-picker-indicator` | Not a finding | Still genuinely required for current Safari/WebKit — don't remove. |
| CSS | `transition: all`, float-based layout | Already clean | Module 3 (transitions) and earlier session work (floats never present) already covered this. |
| TS (mobile) | 17 files use `any` somewhere | Real, needs per-instance review | Not a blanket-fix candidate — some may be genuinely justified (untyped third-party APIs). |
| TS (mobile) | `ErrorBoundary.tsx` is a class component | Not a finding | React error boundaries have no functional/hooks equivalent in React 19 — this is the correct, required pattern. |
| TS (mobile) | strict mode on, zero `@ts-ignore`/`@ts-nocheck` | Already clean | No finding |

---

## Module 9: Comprehensive Service Modernization (Lombok, Declarative Transactions & Logging)

### 1. Objective
Modernize all service implementations and background schedulers across the backend architecture to eliminate boilerplate constructors and manual logger instances while establishing enterprise-grade declarative transactional boundaries (`@Transactional(readOnly = true)` at class level, explicit `@Transactional` on mutation methods).

### 2. Modernized Components & Architectural Standards

| Service Implementation | Lombok Annotations | Transaction Strategy | Key Refactoring Changes |
|---|---|---|---|
| [`CategoryServiceImpl`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/service/impl/CategoryServiceImpl.java) | `@Slf4j`, `@RequiredArgsConstructor` | `@Transactional(readOnly = true)` class-level, `@Transactional` on `createCategory`, `deleteCategory` | Replaced manual `LoggerFactory.getLogger` and 2-parameter constructor. |
| [`ExpenseServiceImpl`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/service/impl/ExpenseServiceImpl.java) | `@Slf4j`, `@RequiredArgsConstructor` | `@Transactional(readOnly = true)` class-level, `@Transactional` on `createExpense`, `updateExpense`, `deleteExpense` | Removed boilerplate constructor, optimized read-only queries. |
| [`IncomeServiceImpl`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/service/impl/IncomeServiceImpl.java) | `@Slf4j`, `@RequiredArgsConstructor` | `@Transactional(readOnly = true)` class-level, `@Transactional` on `createIncome`, `updateIncome`, `deleteIncome` | Modernized constructor and transactional boundary. |
| [`SavingsGoalServiceImpl`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/service/impl/SavingsGoalServiceImpl.java) | `@Slf4j`, `@RequiredArgsConstructor` | `@Transactional(readOnly = true)` class-level, `@Transactional` on mutations | Removed manual constructor, secured goal transactions. |
| [`UserServiceImpl`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/service/impl/UserServiceImpl.java) | `@Slf4j`, `@RequiredArgsConstructor` | `@Transactional(readOnly = true)` class-level, `@Transactional` on mutations | Eliminated 10-parameter manual constructor, enhanced logging. |
| [`PasswordResetServiceImpl`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/service/impl/PasswordResetServiceImpl.java) | `@Slf4j`, `@RequiredArgsConstructor` | `@Transactional(readOnly = true)` class-level, `@Transactional` on OTP requests/verifications | Preserved full dual-recovery PIN fallback and dark-mode notification templates. |
| [`MonthlyReportServiceImpl`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/service/impl/MonthlyReportServiceImpl.java) | `@Slf4j`, `@RequiredArgsConstructor` | `@Transactional(readOnly = true)` class-level, `@Transactional` on email/scheduler writes | Eliminated 7-parameter manual constructor. |
| [`WebAuthnServiceImpl`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/service/impl/WebAuthnServiceImpl.java) | `@Slf4j` | `@Transactional(readOnly = true)` class-level, `@Transactional` on `finishRegistration`, `finishAuthentication` | Added missing `@Transactional` on mutating WebAuthn challenge consumption ceremonies. |
| [`DatabaseSnapshotServiceImpl`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/service/impl/DatabaseSnapshotServiceImpl.java) | `@Slf4j` | `@Transactional(readOnly = true)` class-level, `@Transactional` on snapshot restoration | Detailed logging for table exports and failovers. |
| [`FileDbSyncServiceImpl`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/service/impl/FileDbSyncServiceImpl.java) | `@Slf4j`, `@RequiredArgsConstructor` | Method-level `@Transactional` on sync | Modernized constructor and logging. |
| [`HuggingFaceDatabaseFailoverServiceImpl`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/service/impl/HuggingFaceDatabaseFailoverServiceImpl.java) | `@Slf4j`, `@RequiredArgsConstructor` | N/A | Removed manual constructor. |
| [`ImportServiceImpl`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/service/impl/ImportServiceImpl.java) | `@Slf4j`, `@RequiredArgsConstructor` | `@Transactional(readOnly = true)` class-level, `@Transactional` on all 6 batch import routines | Standardized on `log` SLF4J, initialized `ObjectMapper` field inline. |
| [`ExportServiceImpl`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/service/impl/ExportServiceImpl.java) | `@Slf4j` | `@Transactional(readOnly = true)` class-level | Standardized logging and read-only optimization for large dataset exports. |
| [`CustomUserDetailsService`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/security/CustomUserDetailsService.java) | `@Slf4j`, `@RequiredArgsConstructor` | `@Transactional(readOnly = true)` class-level | Added structured logging on auth attempts. |
| [`JwtServiceImpl`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/security/impl/JwtServiceImpl.java) | `@Slf4j` | N/A | Replaced manual logger. |
| [`RateLimiterServiceImpl`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/security/impl/RateLimiterServiceImpl.java) | `@Slf4j` | N/A | Added diagnostic bucket cleanup logging. |
| [`RecurringExpenseScheduler`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/service/RecurringExpenseScheduler.java) | `@Slf4j`, `@RequiredArgsConstructor` | `@Transactional` on cron and startup execution | Removed manual constructor, ensured atomic recurring generation. |
| [`RecurringIncomeScheduler`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/service/RecurringIncomeScheduler.java) | `@Slf4j`, `@RequiredArgsConstructor` | `@Transactional` on cron and startup execution | Removed manual constructor, ensured atomic recurring income creation. |
| [`RecurringSavingsScheduler`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/service/RecurringSavingsScheduler.java) | `@Slf4j`, `@RequiredArgsConstructor` | `@Transactional` on cron and startup execution | Removed manual constructor, auto-advances due dates atomically. |

### 3. Verification Results
- **Full Maven Compilation:** Clean build on Java 26 preview mode.
- **JUnit 5 & Cucumber Test Suite:** All 163 tests passed, 0 failures, 0 errors, 19 BDD scenarios passed (129 steps passed).

---

## Module 10: File Upload / Download Streaming, CORS Headers & Progress Tracking

### 1. Objective
Address performance and UX deficiencies in file handling:
- Enable chunked streaming transfer progress observation by exposing `Content-Length` in CORS configurations.
- Provide explicit `.contentLength(bytes.length)` on all file export endpoints across controllers (`ExpenseController`, `IncomeController`, `RangeReportController`, `ReportController`).
- Introduce visual real-time progress bar UI (`loadingProgressTrack`, `loadingProgressBar`, `setProgress(percent, text)`) in the frontend client (`api.js`) and wire into `downloadAuthenticated` and `uploadFileWithProgress` in `dashboard.js`.

### 2. Modernized Components

| Component | Target Location | Solution Details |
|---|---|---|
| CORS Configuration | [`CorsConfig.java`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/config/CorsConfig.java) | Added `"Content-Length"` to `exposedHeaders` in both `corsConfigurationSource()` and `corsConfigurer()` so browsers can read `res.headers.get("Content-Length")`. |
| Expense Exports | [`ExpenseController.java`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/controller/ExpenseController.java) | Added `.contentLength(bytes.length)` to CSV, JSON, PDF, and Excel export endpoints. |
| Income Exports | [`IncomeController.java`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/controller/IncomeController.java) | Added `.contentLength(bytes.length)` to CSV, JSON, PDF, and Excel export endpoints. |
| Executive & Range Reports | [`RangeReportController.java`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/controller/RangeReportController.java), [`ReportController.java`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/controller/ReportController.java) | Set explicit content-length headers on range Excel/PDF reports and financial statement downloads. |
| Frontend Feedback UI | [`frontend/js/api.js`](file:///home/yoge/IdeaProjects/expense-tracker-system/frontend/js/api.js) | Integrated `#loadingProgressTrack` and `#loadingProgressBar` inside `#appLoading`, added global `setProgress(percent, customText)` helper. |
| File Progress Handlers | [`frontend/js/dashboard.js`](file:///home/yoge/IdeaProjects/expense-tracker-system/frontend/js/dashboard.js) | Integrated `setProgress(pct, ...)` in `downloadAuthenticated` (via `ReadableStream` chunk accumulation) and `uploadFileWithProgress` (via `XMLHttpRequest.upload.onprogress`), with smooth progress updates and clean teardown. |

### 3. Verification
- Maven Compilation: 0 errors, 0 warnings.
- Test Suite: All 163 tests passed, 19 Cucumber BDD scenarios (129 steps) passed.

## Module 11: OAuth Username Derivation, WebAuthn Integrity & Frontend Select Synchronization

### 1. Objective
Synchronize frontend-to-backend model contracts and resolve security and credential constraints:
- Bind frontend proposed username from registration form to Google OAuth authentication payload (`OAuthRequest.username`).
- Re-architect WebAuthn user handle persistence to reuse consistent user handle across authenticators according to W3C WebAuthn standards, removing invalid `unique = true` DB constraint on `user_handle`.
- Expose `GET /api/webauthn/status` allowing frontend and clients to inspect user passkey registration status and presence.
- Modernize `WebAuthnController`, `WebAuthnCredentialRepositoryAdapter` with Lombok `@RequiredArgsConstructor` and `@Slf4j`.
- Synchronize `#goalFrequency` into custom luxury select initialization list in `custom-controls.js`.

### 2. Modernized Components

| Component | Target Location | Solution Details |
|---|---|---|
| Google Sign-In Username Sync | [`frontend/js/auth.js`](file:///home/yoge/IdeaProjects/expense-tracker-system/frontend/js/auth.js) | Added `username: document.getElementById("username")?.value?.trim() \|\| null` to OAuth request payload so proposed handle is propagated. |
| WebAuthn Entity Constraints | [`WebAuthnCredential.java`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/model/WebAuthnCredential.java) | Removed `unique = true` on `user_handle` (an account identifier across multiple credentials) while preserving index and unique constraint on `credential_id`. |
| WebAuthn User Handle Reuse | [`WebAuthnServiceImpl.java`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/service/impl/WebAuthnServiceImpl.java) | Implemented `userHandle` reuse across authenticators for existing users, added `isWebAuthnEnabled` implementation and cleanup logic. |
| WebAuthn Status Endpoint & Lombok | [`WebAuthnController.java`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/controller/WebAuthnController.java) | Added `@GetMapping("/status")` returning biometric enablement status, refactored with `@RequiredArgsConstructor` and `@Slf4j`. |
| Repository Adapter | [`WebAuthnCredentialRepositoryAdapter.java`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/security/WebAuthnCredentialRepositoryAdapter.java) | Modernized with `@RequiredArgsConstructor`. |
| Frontend Control Synchronization | [`frontend/js/custom-controls.js`](file:///home/yoge/IdeaProjects/expense-tracker-system/frontend/js/custom-controls.js) | Added `"goalFrequency"` to `selectIds` array in `initAllCustomSelects()`. |

### 3. Verification
- Maven Compilation: Clean, zero errors.
- Unit & Integration Tests: All tests in `WebAuthnControllerTest` and full suite passed with 100% success rate.

## Module 12: Comprehensive Backend Testing Scripts (BDD Cucumber & Unit Test Suite Expansion)

### 1. Objective
Achieve 100% test coverage and hermetic scenario isolation across all core financial management domain workflows:
- Expand Cucumber BDD feature scenarios across categories, expenses, budgets, incomes, savings goals, and file export/import pipelines.
- Hermetically isolate Cucumber scenario preconditions in `CategorySteps.java` to prevent duplicate category conflicts and state bleed across test executions.
- Verify comprehensive MockMvc web-layer unit tests and service-layer business logic test suites with fail-fast exception validation.

### 2. Modernized Components

| Component | Target Location | Solution Details |
|---|---|---|
| Category BDD Precondition | [`CategorySteps.java`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/test/java/com/example/expensetracker/cucumber/CategorySteps.java) | Implemented `Given I do not have a category named {string}` deleting pre-existing matching categories for hermetic scenario isolation. |
| Category Feature Suite | [`category.feature`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/test/resources/features/category.feature) | Added hermetic precondition step ensuring idempotency of category creation tests. |
| Modernized Service Unit Tests | `src/test/java/com/example/expensetracker/service/impl/*` | Comprehensive unit tests for `CategoryServiceImplTest`, `ExpenseServiceImplTest`, `IncomeServiceImplTest`, `SavingsGoalServiceImplTest`, `UserServiceImplTest`, `WebAuthnServiceImplTest`, `PasswordResetServiceImplTest`, `DatabaseSnapshotServiceImplTest`, `ExportServiceImplTest`, `FileDbSyncServiceImplTest`, `ImportServiceImplTest`, `MonthlyReportServiceImplTest`. |

### 3. Verification
- **Cucumber BDD Suite:** 38/38 scenarios passed, 257/257 steps passed, 0 failures, 0 errors across all 7 feature suites.
- **Service Unit Tests:** 95/95 service unit tests passed (33 in Batch 1, 62 in Batch 2).
- **Full Maven Test Suite:** 181/181 tests passed, 0 failures, 0 errors, 0 skipped.

## Module 13: Comprehensive Controller Modernization with Lombok & Screaming Architecture Audit

### 1. Objective
Systematically inspect, modernize, and enforce fail-fast screaming error handling across all REST controllers in `com.example.expensetracker.controller`:
- Replace boilerplate constructor dependency injection with Lombok `@RequiredArgsConstructor`.
- Replace verbose SLF4J manual logger declarations (`LoggerFactory.getLogger(...)`) with Lombok `@Slf4j`.
- Retain non-final fields for Spring `@Value` properties to ensure clean and correct constructor generation.
- Audit all endpoints for screaming error handling: no silent catch or default fallbacks; throw explicit domain exceptions (`ResourceNotFoundException`, `BadRequestException`, `ConflictException`, `AccessDeniedException`) that map to unambiguous HTTP status codes handled by `GlobalExceptionHandler`.
- Validate user tenant isolation and ownership before mutating or returning sensitive financial resources (preventing IDOR vulnerabilities).

### 2. Modernized Components

| Controller | Target Location | Modernization Details |
|---|---|---|
| CategoryController | [`CategoryController.java`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/controller/CategoryController.java) | Annotated with `@Slf4j` and `@RequiredArgsConstructor`. Removed explicit logger and 3-arg constructor. |
| SavingsGoalController | [`SavingsGoalController.java`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/controller/SavingsGoalController.java) | Added `@Slf4j` and `@RequiredArgsConstructor`. Removed explicit logger and constructor. Moved security check in `depositToGoal` before payload access. |
| IncomeController | [`IncomeController.java`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/controller/IncomeController.java) | Added `@Slf4j` and `@RequiredArgsConstructor`. Removed explicit logger and 5-arg constructor. |
| ExpenseController | [`ExpenseController.java`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/controller/ExpenseController.java) | Added `@Slf4j` and `@RequiredArgsConstructor`. Removed explicit logger and 9-arg constructor. Validated fail-fast screaming behavior on cross-tenant category assignments. |
| AuthController | [`AuthController.java`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/controller/AuthController.java) | Added `@Slf4j` and `@RequiredArgsConstructor`. Kept `@Value` email verification flag non-final. Removed manual constructor and logger. |
| ReportController | [`ReportController.java`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/controller/ReportController.java) | Added `@Slf4j` and `@RequiredArgsConstructor`. Removed explicit logger and 5-arg constructor. |
| RangeReportController | [`RangeReportController.java`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/controller/RangeReportController.java) | Added `@Slf4j` and `@RequiredArgsConstructor`. Removed explicit logger and 7-arg constructor. |
| SyncController | [`SyncController.java`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/controller/SyncController.java) | Added `@Slf4j` and `@RequiredArgsConstructor`. Kept `@Value` sync token non-final. Removed manual logger and constructor. |
| UserController | [`UserController.java`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/controller/UserController.java) | Added `@Slf4j` and `@RequiredArgsConstructor`. Removed explicit logger and 5-arg constructor. |
| HealthController | [`HealthController.java`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/controller/HealthController.java) | Added `@Slf4j` and `@RequiredArgsConstructor`. Removed explicit logger and constructor. |
| HomeController | [`HomeController.java`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/controller/HomeController.java) | Added `@Slf4j`. Removed explicit logger. |
| WebAuthnController | [`WebAuthnController.java`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/main/java/com/example/expensetracker/controller/WebAuthnController.java) | Verified existing `@Slf4j` and `@RequiredArgsConstructor` and fail-fast `ResponseStatusException` authentication assertions. |

### 3. Verification
- **Compilation:** `./mvnw test-compile` passed with zero errors across all 131 source and 31 test classes.
- **Cucumber BDD Suite:** 38/38 scenarios passed, 257/257 steps passed.
- **Full Test Suite:** 273/273 tests executed, 0 failures, 0 errors, 2 skipped (Playwright headless in non-CI environment).

## Module 14: Comprehensive Testing Scripts & Multi-Tier Verification (BDD, Schedulers, MockMvc & Playwright)

### 1. Objective
Fulfill the user requirement ("Now we are going to write the testing scripts" and fail-fast screaming error verification) by completing the remaining gaps across all testing layers:
- Implement Cucumber BDD feature specification for Budgets (`budget.feature`) and step definitions (`BudgetSteps.java`) covering creation, monthly/custom intervals, category-based caps, idempotency, updates, and threshold validations.
- Create unit test suites for all background schedulers (`RecurringExpenseSchedulerTest`, `RecurringIncomeSchedulerTest`, `RecurringSavingsSchedulerTest`) validating cron triggers, error isolation, and atomic state advancement without infinite loops.
- Bridge remaining MockMvc controller coverage gaps by implementing comprehensive tests for `ReportControllerTest` and `HealthControllerTest`.
- Expand frontend Playwright E2E coverage by authoring test suites for Budgets (`e2e/tests/budgets.spec.ts`) and Incomes (`e2e/tests/incomes.spec.ts`).

### 2. Modernized Components & Test Suites

| Component / Test Suite | Target Location | Solution Details |
|---|---|---|
| Budget BDD Feature | [`budget.feature`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/test/resources/features/budget.feature) | 6 scenarios covering budget creation with monthly interval, custom interval with start/end dates, retrieving status, updating limits, and deleting budgets. |
| Budget BDD Steps | [`BudgetSteps.java`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/test/java/com/example/expensetracker/cucumber/BudgetSteps.java) | Hermetic scenario execution with dynamic category binding, idempotency checks, and authenticated session integration. |
| Schedulers Unit Tests | [`RecurringExpenseSchedulerTest.java`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/test/java/com/example/expensetracker/service/RecurringExpenseSchedulerTest.java), [`RecurringIncomeSchedulerTest.java`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/test/java/com/example/expensetracker/service/RecurringIncomeSchedulerTest.java), [`RecurringSavingsSchedulerTest.java`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/test/java/com/example/expensetracker/service/RecurringSavingsSchedulerTest.java) | 17 unit tests verifying cron execution, safe handling of missing/overdue entries, next due date calculation, error containment, and transactional boundaries. |
| Report Controller MockMvc | [`ReportControllerTest.java`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/test/java/com/example/expensetracker/controller/ReportControllerTest.java) | 6 MockMvc tests covering monthly reports, trigger emails, custom timeframes, PDF/Excel binary downloads, and error conditions. |
| Health Controller MockMvc | [`HealthControllerTest.java`](file:///home/yoge/IdeaProjects/expense-tracker-system/src/test/java/com/example/expensetracker/controller/HealthControllerTest.java) | 3 MockMvc tests asserting application health check status, database connectivity checks, and uptime reporting. |
| Playwright Budget E2E | [`budgets.spec.ts`](file:///home/yoge/IdeaProjects/expense-tracker-system/e2e/tests/budgets.spec.ts) | 8 test cases verifying modal open/close, form inputs, dynamic CUSTOM interval display toggles, chart canvas presence, and usage badges. |
| Playwright Income E2E | [`incomes.spec.ts`](file:///home/yoge/IdeaProjects/expense-tracker-system/e2e/tests/incomes.spec.ts) | 7 test cases verifying modal interaction, recurring cadence toggle, CUSTOM interval field reveals, tab switching, and filter bar operations. |

### 3. Verification Results
- **Cucumber BDD Suite:** 44/44 scenarios passed, 306/306 steps passed (100% success rate across all 8 feature files).
- **Backend Test Suite:** 305 tests executed, 0 failures, 0 errors, 2 skipped (Playwright headless in non-CI environment).
- **Full Maven Build:** 100% BUILD SUCCESS.

## 10. Components layer migration progress

Round 1 (da0b050): 13 files with zero selector overlap anywhere in the
tree. Round 2 (3dda234): 4 more files that share a selector string with
a file still in `legacy`, cleared by checking the actual declared
properties on the shared selector are disjoint (or identical-value) in
every case - see style.css's own comment above the round-2 imports for
the full per-pair reasoning. Both rounds verified via real-Chromium CI
(Playwright UI and WebAuthn checks passes on both).

17 files now in `components`. Remaining `legacy` files mostly have
denser, more genuine overlap (reports.css, modals.css, ui-regression-
fixes.css, the animations/ tree) - future rounds should keep using the
same method (selector-string overlap first, then property-level check
before ruling a file unsafe) but expect smaller batches and more
multi-file groups as the easy candidates run out.

Round 3 (commit 42131f1): dashboard/enhancements/filter-panel.css,
tables/filters.css - 2 more disjoint-property overlaps cleared. 19 files
now in `components` total.

Note: a large parallel-session merge (ML feedback/retraining feature)
added frontend/css/ai-intelligence.css, linked as a separate top-level
stylesheet rather than through style.css's import chain - it's
unlayered CSS, which unconditionally beats every named layer regardless
of order. Currently harmless (zero selector overlap with anything else
checked), but worth being aware of if it ever needs to interact with
the legacy/components layer system - it isn't in it right now.
