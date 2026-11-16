# Modernization report

Method: configured versions read from the build files, claims checked against official documentation, then measured
with Ruff (`UP`, `FURB`, `PTH`, `PERF`), ESLint (core `prefer-*` plus `eslint-plugin-unicorn`), PMD 7 and source scans.
Baseline: Java 27, Spring Boot 4.1.2, Python 3.14, TypeScript strict, classic-script browser JavaScript.
Counts are for `src/main/java` (289 files) unless stated.

## Deprecated API check (compiler)
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
