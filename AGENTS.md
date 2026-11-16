# Instructions for AI coding tools

This file is read by AI assistants and agents (Claude Code, Codex, Copilot, Cursor and others) and is also
the engineering policy for people. Training data for these tools lags the languages. Left alone they write
the idioms they saw most often, which are usually a few versions old. Check the baseline below first.

## Project baseline (verify against the build files, they win over this table)

| Area | Version | Source of truth |
|---|---|---|
| Java | 27 (non-LTS: Oracle updates end March 2027; Java 25 is the current LTS) | `pom.xml` `java.version` |
| Spring Boot | 4.1.x (Spring Framework 7, Jakarta EE 11) | `pom.xml` parent |
| Jackson | 3.x is Spring Boot's default. This project still uses Jackson 2 (`com.fasterxml.jackson.databind`) by hand | `pom.xml`, `JacksonConfig` |
| Python (ML service) | 3.14 | `ml/pyproject.toml` |
| TypeScript (mobile) | strict mode | `mobile/tsconfig.json` |
| Web frontend | plain browser JavaScript, classic `<script>` tags (no bundler, no ES modules yet) | `frontend/` |

Do not use preview or incubator features (for example structured concurrency, lazy constants, primitive
patterns, the Vector API) without explicit approval. They need `--enable-preview` and can change.

## Language version awareness
- Read the configured version before writing code. Do not assume the version you remember.
- Check official language and framework documentation and release notes for anything newer than you are sure about.
- Never use a feature the configured minimum runtime does not support.

## Modern idioms to prefer (Java 27 / Spring Boot 4)
Only when they improve readability, safety or maintainability. Do not rewrite working code just to look modern.

| Prefer | Instead of | Since |
|---|---|---|
| `record` for immutable data carriers and DTOs | classes with getters/constructors | 16 |
| `sealed` types with pattern-matching `switch` for closed sets | `if/else` chains on type or enum plus default | 17 / 21 |
| `switch` expressions with `->` | `switch` statements with `break` | 14 |
| `instanceof Foo foo` | `instanceof` followed by a cast | 16 |
| text blocks | multi-line `"..." +` concatenation (SQL, JSON, HTML) | 15 |
| `stream.toList()` | `collect(Collectors.toList())` when the list is not mutated (note: result is unmodifiable) | 16 |
| `getFirst()` / `getLast()` | `get(0)` / `get(size() - 1)` on non-empty lists | 21 |
| `_` for unused variables and catch parameters | names like `ignored` | 22 |
| `String.isBlank()` / `strip()` | `trim().isEmpty()` (not identical: Unicode whitespace) | 11 |
| `Path.of`, `Files.readString` | `Paths.get`, manual readers | 11 |
| `HttpClient`, `RestClient` | `HttpURLConnection`, `RestTemplate` | 11 / Spring 6.1 |
| `java.time` | `Date`, `Calendar`, `SimpleDateFormat` (unless a library API requires `Date`, e.g. JJWT) | 8 |
| constructor injection | field `@Autowired` | n/a |
| `existsBy...` | `findBy...().isPresent()` just to test existence | n/a |
| virtual threads (already on: `spring.threads.virtual.enabled`) | custom thread pools for blocking I/O | 21 |

Java 24+ no longer pins virtual threads on `synchronized`, so do not replace `synchronized` with locks for that reason.

New JSON code: do not add more direct Jackson 2 usage than the existing injected `ObjectMapper`. Jackson 2 support in
Spring Boot is deprecated and will be removed in a future 4.x release.

## Python 3.14 and TypeScript
- Python: `pathlib` over `os.path`; `match` for structured branching; no `typing.List`/`Optional` (use `list[...]`, `X | None`).
  Annotations are evaluated lazily from 3.14, so `from __future__ import annotations` is not needed in new files.
- TypeScript: `strict` stays on; prefer `unknown` over `any`, `satisfies`, optional chaining and `??`.
- Web frontend: `getElementById`, `window` and `isNaN` are fine. Do not "modernize" them (`querySelector`, `globalThis` and
  `Number.isNaN` change nothing useful or change behaviour).

## Deprecated API handling
- CI prints compiler deprecation and for-removal warnings in the backend job summary. Read it before adding code.
- Find out whether an API is deprecated for removal and whether a replacement exists.
- Never swap an API without checking behavioural compatibility (null handling, exceptions, mutability, ordering).

## Verification
- Compile, run unit and integration tests, and run static analysis (CI does this on every pull request).
- For performance-sensitive changes, show a measurement or a reason.
- Confirm existing behaviour is preserved.

## Reporting a modernization opportunity
Give: the existing code, the limitation, the modern alternative, the minimum language version, benefits and drawbacks,
and whether the change is safe to automate. Prioritise measurable improvements over style. See `docs/modernization-report.md`.
