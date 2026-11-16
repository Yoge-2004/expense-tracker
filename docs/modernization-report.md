# Modernization report

Two separate questions: **Part A** is modern capabilities the project never adopted; **Part B** is deprecated or outdated code.

Method: configured versions read from the build files, claims checked against official documentation, then measured
with Ruff (`UP`, `FURB`, `PTH`, `PERF`), ESLint (core `prefer-*` plus `eslint-plugin-unicorn`), PMD 7 and source scans.
Baseline: Java 27, Spring Boot 4.1.2, Python 3.14, TypeScript strict, classic-script browser JavaScript.
Counts are for `src/main/java` (289 files) unless stated.

## Part A: modern capabilities this project does not use

Deprecation is a different question. A linter cannot report a feature that was never adopted, because the old way
still works. These come from `python3 scripts/adoption-audit.py` (counts per layer), then each zero was checked
against the code for a real problem the feature would solve. Items where the problem was not there were dropped
(for example a non-root container user: the Dockerfile already creates one).

### Highest value, each tied to a problem found in this project

| # | Gap (count) | Problem it would solve here | Modern alternative (baseline) | Benefit / drawback | Safe to automate |
|---|---|---|---|---|---|
| 1 | Hand-built modals: 23 `.modal-overlay`, 35 manual Escape handlers, 0 `<dialog>`, no `aria-modal` in `admin.html` | The admin Model Specifications modal was invisible because of nesting inside an `opacity:0` overlay (fixed in #76). No focus trap or inert background | `<dialog>` with `showModal()` (Baseline 2022) | Top layer ends z-index and nesting bugs; free focus trap, Esc and accessibility. Needs `::backdrop` styling and JS changes per modal | No. Pilot one modal first |
| 2 | Schema changes: `ddl-auto=update` (6 properties), no Flyway or Liquibase | Unreviewed schema changes in production, for example the new `tokens_valid_after` column | Flyway or Liquibase migrations (Boot supports both) | Reviewable, repeatable schema; needs a baseline for the existing database and care with the SQLite fallback | No |
| 3 | Concurrent edits: 0 `@Version`, no ETag or `If-Match` | Web and mobile can edit the same expense and silently overwrite each other | JPA `@Version` plus a 409 response | Detects lost updates; needs a column, a backfill and client handling of 409 | No |
| 4 | CSS cascade: 0 `@layer`, 1,506 `!important`, 0 nesting in 29,747 lines | Specificity wars. The override files adopted in #70 exist because of this | `@layer` (Baseline 2022), native nesting (Baseline 2023) | Removes the need for most `!important`; a wrong layer order changes the look silently, so check visually | No |
| 5 | Delivery: 56 requests per dashboard load (48 JS, 8 CSS), nothing minified, no ES modules | Dashboard transferred about 350 KB gzip; 473 undeclared cross-file globals | **Minification done** (`scripts/minify-frontend.mjs`, run by the Netlify build): frontend transfer 532 to 384 KB gzip (about 28% less), 2,389 to 1,535 KB raw. ES modules are still open | Faster first load and less parsing; the Netlify build now needs Node and one pinned dependency. Sources stay readable | Minification yes (done), modules no |
| 6 | Money formatting by hand: 60 `.toFixed(`, 12 with a currency symbol, against 11 `Intl` uses | Multi-currency app; digit grouping (for example en-IN lakh style) is locale-specific | `Intl.NumberFormat(locale, {style: 'currency', currency})` | Correct symbols and grouping; output text can change, so tests that assert strings need updating | Per site, with review |
| 7 | Error format: 0 `ProblemDetail`; custom error body in a 492-line handler | Every client parses a private error shape | `ProblemDetail`, RFC 9457 (Spring 6+) | Standard format; changes the JSON the web and mobile apps parse | No |
| 8 | Configuration: 55 `@Value`, 0 `@ConfigurationProperties` | Settings are scattered and unvalidated at startup | `@ConfigurationProperties` records with validation | Fails fast on bad config; moderate refactor | Per class |
| 9 | Time: 90 `now()` calls, 5 `Clock` uses | Month-boundary logic (reports, budgets) is hard to test | Inject `Clock` | Deterministic tests; touches many signatures | Per class |

### Worth considering
- **Resilience:** Spring Framework 7 has `@Retryable` and `@ConcurrencyLimit` built in (0 used). Candidates: mail sending, ML and Hugging Face calls.
- **Observability:** no structured logging (`logging.structured.format.console`), no Micrometer metrics or tracing. Graceful shutdown, compression and HTTP/2 are not set; check Boot 4 defaults before adding.
- **Pagination:** no keyset scrolling (`Window` and `ScrollPosition`); the ledger export uses offset paging.
- **Declarative HTTP:** 0 `@HttpExchange` against 8 `RestClient` call sites.
- **CSS:** 18 `100vh` against 8 `dvh` (mobile address bar), 0 `light-dark()`, 0 `text-wrap: balance`, 81 vendor prefixes that may no longer be needed. `dvh` can be added as a progressive fallback per site.
- **Web APIs:** 20 hand-built query strings with 0 `URLSearchParams`; 1 `AbortController` (stale responses can overwrite newer ones); 0 `ResizeObserver` for charts.
- **PWA:** manifest has no `shortcuts` or `share_target` (sharing a receipt photo to the app); service worker has no `navigationPreload`.
- **Mobile:** 10 `FlatList` and no `FlashList` (measure first); 66 uses of `any` and no `satisfies`; 106 `useMemo`/`useCallback` and 46 `memo` that React Compiler can replace (check Expo SDK 58 support).
- **Tests:** 671 `assertEquals` against 19 AssertJ; 0 `MockMvcTester`. Testcontainers is not needed while CI provides PostgreSQL.
- **Repository hygiene:** no formatter or quality gate in the Maven build (Spotless, Error Prone, NullAway, dependency-check), 31 GitHub Actions pinned by tag and 1 by commit SHA. Added in this change: Dependabot for all ecosystems, cancellation of superseded pull-request CI runs, and `.editorconfig`.

### Checked and fine
Non-root container user, `async/await` (193 against 15 `.then`), optional chaining (737) and `??` (47), `:has()` and `:is()`, `@starting-style`,
`@view-transition`, `clamp()`, `color-mix()`, `AbortSignal.timeout`, virtual threads, Python 3.14 (`pathlib`, slotted dataclasses; no features it needs).
React Native 0.88 enables the New Architecture by default, so the missing `newArchEnabled` flag is not a gap.

## Part B: deprecated or outdated APIs

### Deprecated API check (compiler)
CI compiles on Java 27 with `-Xlint:deprecation -Xlint:removal`. The build log contains no deprecated or for-removal API
warnings for main or test code (5 unrelated warning lines, none mentioning removal). The Jackson 2 item below is a
framework-level deprecation, not a deprecated API call, so the compiler does not report it. Re-check after dependency upgrades.

## Already modern (no action)
64 records, 57 text blocks, 27 `instanceof` patterns, 17 arrow-`switch` uses, no `switch` with `break`, virtual threads
enabled (`spring.threads.virtual.enabled=true`), no `Vector`, `Hashtable`, `Executors` or `HttpURLConnection`.
`Date` appears only where JJWT requires it, and `java.sql.Timestamp` only where JDBC returns it.
The main class already uses the relaxed non-public `static void main`.

## Deprecated APIs (compiler-verified)
CI compiles with `-Xlint:deprecation -Xlint:removal`. The first run over main and test code on JDK 27 and Spring Boot 4.1.2
logged 5 warnings in total and none were about deprecated or for-removal APIs, so no deprecated API calls need replacing today.
The deprecated item is the Jackson 2 dependency itself (below), which is a library-level deprecation the compiler does not flag.
Each CI run lists any new ones in the backend job summary.

## Worth doing

### 1. Jackson 2 to Jackson 3 (highest value)
- **Existing:** 11 main and about 12 test files use `com.fasterxml.jackson.databind` through a hand-built `@Primary` `ObjectMapper`.
  Spring MVC itself uses Jackson 3, so the app runs two mappers.
- **Limitation:** Spring Boot documents Jackson 2 support as deprecated and to be removed in a future 4.x release.
- **Alternative:** `tools.jackson.databind.json.JsonMapper` (Jackson 3). `JacksonException` is unchecked, annotations keep their package.
- **Minimum:** Java 17 (met). **Blocker:** `jjwt-jackson` depends on Jackson 2, so check for a Jackson 3 JJWT release first.
- **Benefit:** one mapper, no removal surprise. **Drawback:** serialization defaults differ, so response-body tests are needed.
- **Safe to automate:** no.

### 2. JDK 27 is not an LTS release
- **Existing:** `java.version` 27, Docker image `eclipse-temurin:27-jre`.
- **Limitation:** Oracle updates for 27 end March 2027, so the project has to move every six months or fall out of support.
- **Alternative:** Java 25 (LTS), or accept a planned upgrade to 28 in March 2027.
- **Benefit:** a supported baseline. **Drawback:** 27 brings G1 as the default collector everywhere and compact object headers by default, which you give up on 25.
- **Safe to automate:** a version change is a one-line edit, but run the full suite and a memory check.

### 3. Field injection (`@Autowired`, 28 sites)
- **Limitation:** hides dependencies, blocks `final` fields, needs reflection in tests.
- **Alternative:** constructor injection (`@RequiredArgsConstructor`). **Minimum:** any.
- **Drawback:** tests that use `@InjectMocks` or construct manually need checking. **Safe to automate:** per class, with tests.

### 4. `catch (X ignored)` (19 sites): done in this change
- Replaced by `catch (X _)`. **Minimum:** Java 22. Behaviour identical. One site uses the variable and was left alone.

## Optional, low value
| Existing | Alternative | Min | Note |
|---|---|---|---|
| `findBy...().isPresent()` to test existence (3 registration checks) | `existsBy...` | n/a | avoids loading the row; tests stub the old method |
| `trim().isEmpty()` (8) | `isBlank()` | 11 | not identical: `trim` strips control characters, `isBlank` uses Unicode whitespace |
| `collect(Collectors.toList())` (2) | `.toList()` | 16 | result is unmodifiable; check the callers do not mutate it |
| `list.get(0)` after an emptiness check (10) | `getFirst()` | 21 | cosmetic; exception type on empty lists differs |
| multi-line `"..." +` (4) | text block | 15 | cosmetic; whitespace must stay exact for the CSP header |

## Leave alone
- `String.format` (70): `formatted()` is cosmetic.
- `Collections.emptyList()` (12): `List.of()` rejects `null` lookups, so it is not a drop-in change.
- `synchronized` (16): since Java 24 it no longer pins virtual threads, so do not replace it with locks.
- Instance `void main()` (Java 25): meant for small programs. Spring Boot tooling support was not verified, so keep a static `main`.
- Frontend `getElementById` to `querySelector` (1,304 lint hits) and `window` to `globalThis` (648): no benefit in browser-only code.
  `isNaN` to `Number.isNaN` (94) changes behaviour for non-numbers.

## Python (ML service, 67 files)
Only 7 findings: two `open()` calls that could use `pathlib`, two `try/except/pass` blocks (`contextlib.suppress`),
`os.path.getsize`, a comprehension. Safe to fix by hand. `from __future__ import annotations` (35 files) is redundant on 3.14
because annotations are evaluated lazily; removal is safe but low value.

## Web frontend (59 JS files)
- **Existing:** 128 classic `<script>` tags, no ES modules, 473 references to globals defined in other files.
- **Limitation:** no scoping or explicit dependencies; load order is the architecture.
- **Alternative:** ES modules (`type="module"`), universally supported. **Drawback:** large refactor and a new load-order test. **Not automatable.**
- Autofixable and safe: `no-var` (25), `prefer-const` (13), `prefer-string-replace-all` (60).
