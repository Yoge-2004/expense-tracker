# Backend Production Code Audit — 2026-09-22

> Scope: `src/main/java`, `src/test`, `pom.xml`, configuration and build wiring
> (146 production classes, 50 test classes). Methodology and every decision
> below follow the Discover → Inspect → Justify → Implement → Verify loop.
>
> **Build limitation (stated up front):** this sandbox has **no JDK/Maven and no
> reachable Maven repository** (repo1.maven.org, repo.maven.apache.org,
> Google/Aliyun/Tencent/Huawei/JBoss/Sonatype/JitPack mirrors, archive.apache.org
> and Adoptium/Zulu/Oracle CDNs were all probed and are network-blocked; only
> npm/PyPI/GitHub-API are reachable). `mvn compile` / `mvn test` / the
> dependency:tree therefore **could not be executed here**. Compensating
> controls used instead: `java-parser` syntax verification of every changed and
> audited file (18/18 pass), line-by-line semantic review against the existing
> test harnesses, and conservative, test-mirroring changes only. CI
> (`.github/workflows/ci.yml` → `mvn -B test` on Temurin 26) is the authoritative
> gate and should be watched on merge.

---

## 1. Original architecture

Layered Spring Boot 4.1.1 / Java 26 monolith serving a vanilla-JS web client
(`frontend/`) and an Expo/React-Native mobile app, over a REST API:

- **Web/API layer** — 14 `@RestController`s under `/api/**`, one
  `@RestControllerAdvice` (`GlobalExceptionHandler`) producing a uniform
  `ErrorResponse`, Swagger/springdoc OpenAPI annotations throughout.
- **Security** — stateless JWT (jjwt 0.13, HS256, ≥256-bit key enforced at
  startup), `OncePerRequestFilter` bearer parsing, `UserSecurity` object-level
  ownership checks (IDOR guard) called from every user-scoped endpoint,
  WebAuthn (Yubico) second factor, sliding-window in-memory rate limiting via a
  `@RateLimited` annotation + `HandlerInterceptor`, password/OTP/PIN recovery
  with BCrypt hashing and lockout counters.
- **Service layer** — `*Service` interfaces + `*ServiceImpl` (`@Transactional`
  boundaries, `@Cacheable("userExpenses")`), recurring-expense/income/savings
  schedulers, monthly report/mail, CSV/JSON/PDF/XLSX import-export (OpenPDF,
  POI), encrypted SQLite snapshot export/import (AES-256-GCM + PBKDF2 600k)
  with Hugging Face Hub upload/download failover.
- **Persistence** — Spring Data JPA; H2 file DB by default (`MODE=PostgreSQL`),
  PostgreSQL (Neon) in production; Flyway-free hand-rolled idempotent startup
  migrations (`DatabaseMigrationConfig`) + `ddl-auto=update`.
- **ML integration** — Spring facade (`/api/ml/classify`, `/api/ml/status`,
  `/api/ml/feedback`, `/api/internal/ml/feedback/*`) in front of the FastAPI
  inference service; training feedback stored via `MlFeedbackService`.
- **Config** — env-driven secrets, permissive-free explicit CORS allowlist,
  CSP/HSTS/permissions-policy headers, virtual threads enabled, async logback
  appenders with a masking conversion rule.

Overall: above-average discipline for a project this size (ownership checks
everywhere, constant-time token compares, masked logging, fail-fast JWT secret,
explicit CORS). The defects cluster in **edge-case auth surface** (sync
endpoint), **seeded credentials**, and **legacy remnants**.

---

## 2. Findings

### Critical

| # | Finding | Location | Status |
|---|---------|----------|--------|
| C1 | **Authentication bypass on the sync/backup surface behind a reverse proxy.** `isLoopbackRequest` trusted `getRemoteAddr() == 127.0.0.1` unconditionally. The production topology (nginx :7860 → Spring :8080) makes *every* request arrive from 127.0.0.1, so `POST /api/sync/file-to-db`, `/db-to-file` (and, for the same shape, anything else relying on that check) executed **database snapshot/backup operations without any credential**. | `SyncController` | **Fixed** |

### High

| # | Finding | Location | Status |
|---|---------|----------|--------|
| H1 | **Hard-coded default credentials seeded in production.** `@Profile("!test")` startup seeding created `demo@expensetracker.com` with default password `Demo1234!` (the default was even `@SuppressWarnings("java:S6437")`-muted). On any deployed instance this is a standing default-credential account. | `DataInitializer` | **Fixed** |
| H2 | **JWT subject enumeration → 500s.** A valid-signature token whose account was deleted after issuance made `loadUserByUsername` throw `UsernameNotFoundException` out of the filter chain → container-level 500 instead of a clean 401. | `JwtAuthenticationFilter` | **Fixed** |
| H3 | **JSON/URL injection in the HF Hub client.** The NDJSON request body was built by raw string concatenation of `path`, and `repo`/`path` were interpolated into URLs unvalidated (config-sourced, but one YAML/env compromise from request forgery and NDJSON smuggling). No request timeouts meant a stalled Hub could pin threads indefinitely. | `HuggingFaceFileClient` | **Fixed** (segment allowlists + JSON escaping + connect/request timeouts) |

### Medium

| # | Finding | Location | Status |
|---|---------|----------|--------|
| M1 | **Miswired fallback-DB credential**: read from `System.getProperty("app.fallback-db.password")` while every other secret is env/Spring-configured — the intended `FALLBACK_DB_PASSWORD` wiring silently never applied. | `DatabaseSnapshotServiceImpl` | **Fixed** (Spring `@Value("${app.fallback-db.password:}"), env-mapped, null-safe) |
| M2 | **Full API schema published unauthenticated** via `permitAll` `/swagger-ui/**` + `/v3/api-docs` (recon aid: full endpoint map incl. internal routes). | `SecurityConfig` | **Fixed as config switch** (`SWAGGER_ENABLED`, default `true` to preserve behavior — ops decision to flip) |
| M3 | **30-day JWT lifetime with no revocation** (`JWT_EXPIRATION` default 2592000000 ms) while OpenAPI docs advertise “24 hours”. Stolen token = month-long access. | `application.properties`, `AuthController` doc | **Reported — product decision** (see §11) |
| M4 | **God-controller / logic in presentation layer.** `ExpenseController` (~1000 lines, 3 sub-domains: expenses + budgets + recurring + import/export) assembles entities, validates frequency enums and computes recurrence dates (`nextOccurrence`) in the controller; uses `Map<String,Object>` DTO-free responses in the budget section. `UserController` binds raw `Map<String,String>` bodies. | `ExpenseController`, `UserController` | **Reported — architectural plan in §12** (surgical-only rule; a restructure without a runnable test suite was judged unacceptable risk) |
| M5 | **Whole-file memory use in snapshot crypto** (`Files.readAllBytes` for encrypt/decrypt and base64 upload) — O(file) heap for DB-sized payloads. | `DatabaseSnapshotServiceImpl`, `HuggingFaceFileClient` | **Reported** (streaming is a contained follow-up; behavior-compatible but sizeable) |

### Low

| # | Finding | Location | Status |
|---|---------|----------|--------|
| L1 | Legacy `"BYPASS"` OTP constant special-cased in register flow (treated as “no OTP”); a magic string has no place in an auth path. | `AuthController` | **Fixed** (any submitted code is now verified-or-rejected; the explicit BYPASS *rejection* in `PasswordResetServiceImpl` is retained — it is tested and defensive) |
| L2 | Obsolete `X-XSS-Protection: 1; mode=block` header — ignored by modern browsers, known to *introduce* XSS in legacy engines. | `SecurityConfig` | **Fixed** (removed; documented inline) |
| L3 | Dead repository query `findAllWithCategoryAndUser` + class-level `@SuppressWarnings("unused")` masking its existence. | `ExpenseRepository` | **Fixed** (method and blanket suppression removed; remaining methods verified in use) |
| L4 | Pre-JDBC-4 driver registration `Class.forName("org.sqlite.JDBC")` (obsolete since Java 6; SQLite JDBC ships the service provider). | `DatabaseSnapshotServiceImpl` | **Kept** (harmless, load-order insurance for the test harness — noted only) |
| L5 | `new HashMap<>()` allocation for empty JWT claims. | `JwtServiceImpl` | **Fixed** (`Map.of()`) |
| L6 | Swagger “valid for 24 hours” contradicts 30-day config. | `AuthController` | **Reported** (docs follow M3 decision) |
| L7 | Rate limiter state is per-instance memory — resets on restart, not shared across replicas. | `RateLimiterServiceImpl` | **Reported** (fine for the single-instance HF deploy; note for scale-out) |

### Improvement (non-defect observations)

- BCrypt work factor is Spring’s default 10; 12 is the modern recommendation (cost/latency tradeoff → ops decision).
- Password policy is consistently min-6 across register/reset (consistent = not a bug); consider 8+ and breach-list checking as product policy.
- `ImportServiceImpl` creates its own `ObjectMapper` instead of injecting the shared Spring bean (duplication, misses central Jackson config).
- `ddl-auto=update` plus hand-rolled `ALTER TABLE` migrations is fragile long-term; Flyway/Liquibase is the durable fix (deliberately out of scope).
- `HttpMessageNotReadableException` is not explicitly mapped (falls to the generic 500 handler rather than 400 — see §11).
- Blanket `@SuppressWarnings("unused")` remains on several repository interfaces (I removed only the one where a genuinely dead method was hiding).
- `HuggingFaceFileClient.upload` still base64-encodes the whole snapshot in one string (see M5).

**Clean bill (checked, no action needed):** no `javax.*` application-code usage (jakarta migration complete); no `new URL(`/`finalize`/`SimpleDateFormat`/`RestTemplate`/`WebSecurityConfigurerAdapter`/`@MockBean`-style deprecated API usage found; no raw-type warnings sources; BCrypt + per-user salt for passwords and PINs and OTP hashes; OTP/PIN/sync-token comparison via `passwordEncoder.matches`/`MessageDigest.isEqual` (constant-time); log masking (`%mask` converter + `LoggingUtils.maskEmail`) on all auth flows; CSV export formula-injection escaping present (`escapeCsv`); POI parse path uses `WorkbookFactory` with POI’s zip-bomb guard; JPA queries use `@Query`/derived queries (no string-concatenated SQL); snapshot import quotes and allowlists SQL identifiers; H2 console disabled by default; multipart caps 10/12 MB; `server.error` stacktraces not exposed (generic handler message); catch-all `Exception` handler logs server-side and returns no internals.

---

## 3. Files changed and why

| File | Change |
|---|---|
| `controller/SyncController.java` | C1: loopback bypass now opt-in (`app.sync.loopback-bypass-enabled`, default `false`) **and** refused when `X-Forwarded-For`/`X-Real-IP`/`Forwarded` present; token field now binds `app.sync.secret-key` (same env, consistent with the rest of the config surface). |
| `config/DataInitializer.java` | H1: seeding strictly opt-in (`app.demo.seed-enabled`) **and** refuses to seed without explicit `app.demo.password`; hard-coded default password and the S6437 suppression removed. |
| `security/JwtAuthenticationFilter.java` | H2: `UsernameNotFoundException` handled → warn + continue unauthenticated (no 500 from the filter). |
| `service/HuggingFaceFileClient.java` | H3: strict repo/path allowlists, JSON string escaping in the NDJSON body, connect (10 s) + request (120 s) timeouts. |
| `service/impl/DatabaseSnapshotServiceImpl.java` | M1: fallback DB password via Spring/env (`FALLBACK_DB_PASSWORD`), null-safe; constructor signature unchanged (test source-compatible). |
| `config/SecurityConfig.java` | L2: obsolete `X-XSS-Protection` writer removed (and its import). |
| `controller/AuthController.java` | L1: `"BYPASS"` magic constant removed from the register OTP gate. |
| `repository/ExpenseRepository.java` | L3: dead `findAllWithCategoryAndUser` + blanket `@SuppressWarnings("unused")` removed. |
| `security/impl/JwtServiceImpl.java` | L5: `Map.of()` for empty claims. |
| `resources/application.properties` | New keys (`app.demo.*`, `app.fallback-db.password`, `app.sync.loopback-bypass-enabled`, `springdoc.*`) with env mappings and security commentary. |
| `.../SyncControllerTest.java` | +3 tests locking the loopback/proxy hardening (default-off, opt-in on, proxy-headers refuse). |
| `.../JwtAuthenticationFilterTest.java` | +1 test: deleted-user token continues unauthenticated without throwing. |
| `.../config/DataInitializerTest.java` | New: 2 tests locking the secure-by-default seeding gate. |

(Also in this push: the separately-scoped aesthetics/ML changeset committed first,
which includes its own ML facade `MlStatusResponse`/`MlClassificationResponse`
`@JsonAlias` contract fix — the FastAPI service speaks snake_case and the Java
client previously dropped `model_revision`/`model_type`/`top_k` silently.)

## 4. Deprecated APIs removed/replaced

- Pre-JDBC-4 `Class.forName` driver loading: evaluated, **kept** (see L4 rationale).
- Obsolete `X-XSS-Protection` security header: **removed** (L2).
- Legacy `"BYPASS"` auth special-case: **removed** (L1).
- Static scan for `javax.persistence|servlet|validation`, `new URL(`, `finalize(`, `SimpleDateFormat`, `StringBuffer`, `SecurityManager`, `AccessController`, `Thread.stop`, `getRealPath`, `RestTemplate`, `WebSecurityConfigurerAdapter`, `antMatchers`, `authorizeRequests`, `@MockBean`: **zero hits**. The codebase is already on current Spring Boot 4 / jakarta / jjwt 0.12+ builder APIs.
- Unchecked/raw-type scan: **zero hits**. Suppression audit: removed one blanket and one justified-but-obsolete `@SuppressWarnings`; remaining suppressions are documented at method level with reasons (kept).

## 5. Security vulnerabilities fixed

C1 sync auth-bypass (critical), H1 seeded default credentials, H2 filter 500/user-enumeration noise, H3 HF-client injection + missing timeouts, L1 magic OTP constant, L2 obsolete XSS header, M2 swagger switch (ops-flippable), M1 secret miswiring.

## 6. Performance improvements made

- HF client timeouts bound stalled Hub calls (virtual-thread pinning / request pile-ups).
- (Fixed as hygiene) removed a per-token `HashMap` allocation.
- Evaluated and deliberately **not** changed: pagination on `GET /api/expenses/user/{id}` (contract change — documented in the OpenAPI as “not supported”; see §12), caching (already present via `@Cacheable` + `spring.cache.type=concurrent`), entity fetch graph (`findByUser` already `JOIN FETCH`es category → no N+1 on the hot list path), indexes (already declared on `expenses(user_id, expense_date)` / `expenses(user_id, category_id)`; derived queries match).

## 7. Code-quality improvements made

Removed dead repository method + blanket suppression; removed magic string; replaced obsolete pattern in JWT generation; aligned config binding with the property layer; added explanatory comments at every behavior-relevant security decision.

## 8. Dependencies changed

**None.** Versions (Spring Boot 4.1.1 parent, jjwt 0.13.0, POI 5.5.1, springdoc 3.1.0, webauthn 2.9.0, sqlite-jdbc 3.53.4.0, Cucumber 7.34.7, Playwright 1.51.0) are current for the toolchain this project targets; with no reachable Maven repository, dependency-tree/conflict analysis (`mvn dependency:tree`) and vulnerability scanning (OWASP DC / `mvn versions:display-dependency-updates`) could not be run — **run both in CI** as follow-up. Scopes reviewed statically: correct (`runtime` for drivers/jjwt-impl/jjwt-jackson, `test` for all test frameworks, `optional` for Lombok).

## 9. Tests added/modified

- `JwtAuthenticationFilterTest`: +1 (deleted-subject resilience).
- `SyncControllerTest`: +3 (loopback default-off, explicit opt-in, forwarded-header refusal).
- `DataInitializerTest`: new, 2 cases (disabled-by-default, refuses password-less seeding).
- No existing assertions were weakened. The `PasswordResetServiceImplTest` BYPASS-rejection test is intentionally unchanged (that guard remains).

## 10. Maven build/test results

**Not executable in this sandbox** (network isolation — see header). Verification performed instead:

| Check | Result |
|---|---|
| `java-parser` syntax, 18 changed/related Java files | 18/18 pass |
| Manual call-site cross-check for every deleted/renamed symbol | clean |
| Existing test-harness review for behavior compatibility | clean (no test constructs the changed constructors/signatures differently) |
| CI baseline | `.github/workflows/ci.yml` runs `mvn -B test` on Temurin 26 — will exercise all suites incl. Cucumber |

## 11. Remaining issues requiring manual decisions

1. **JWT lifetime (M3)** — shorten `JWT_EXPIRATION` (e.g. 1 h access + refresh flow) or accept 30 days? Not changed silently because it logs every existing client out on deploy and the refresh-token design is a product call. Also fix the “24 hours” OpenAPI text to match the decision.
2. **Demo seeding default (H1)** — the fix flips the previous behavior: next deploy seeds **no** demo account unless `APP_DEMO_SEED_ENABLED=true` + `APP_DEMO_PASSWORD=…` are set. If the public demo account is intentional, set those env vars in the Space — and still rotate the old password.
3. **Swagger exposure (M2)** — decide `SWAGGER_ENABLED=false` for the production Space.
4. **Password policy** — keep min-6 (consistent) or move register+reset to a stronger policy together (client-side validation must move in lockstep).
5. **CSV formula-injection tradeoff** — exports currently neutralize `=`/`@`/`+`/`-` prefixes in text; confirm this is acceptable for round-tripping data (it is deliberate and documented in code).

## 12. Recommendations deliberately NOT implemented (and why)

1. **Splitting `ExpenseController` (M4) into expense/budget/recurring controllers + moving `nextOccurrence`/validation into services.** Correct long-term, but it is a signature-moving refactor across controller+service+tests; with `mvn test` unrunnable in this environment the regression risk outweighs the incremental benefit of a partial move. Proposed shape: `ExpenseController` (CRUD+exports), `BudgetController`, `RecurringExpenseController`, with recurrence math in `RecurringSchedule` (pure domain helper) and `@Valid` request records for the budget endpoints.
2. **Pagination for `GET /api/expenses/user/{id}`** — the OpenAPI explicitly documents the unpaginated contract and both frontends consume the full array; adding `page/size` while keeping compatibility means a parallel endpoint or optional params + client work. Recommend `?page=&size=` optional params defaulting to current behavior in a coordinated change.
3. **Streaming snapshot crypto (M5)** — `CipherInputStream`/chunked base64 would remove the memory ceiling; safe but touches the binary snapshot format writer/reader and its tests together.
4. **Flyway/Liquibase migration layer** — replaces `DatabaseMigrationConfig` + `ddl-auto=update`; operational decision (baseline-on-existing-DB) required.
5. **BCrypt strength 12, rate-limiter shared store, refresh-token rotation** — each is an ops/product tradeoff (CPU budget, Redis dependency, session UX) documented in §2/§11 rather than imposed unilaterally.
6. **Explicit `@ExceptionHandler(HttpMessageNotReadableException)`** mapping malformed JSON to 400 — trivially safe but changes an observable status code for a malformed-body edge (currently 500 via catch-all); flagged rather than changed to avoid altering an API behavior without a decision.
7. **Dependency upgrades** — none attempted blind (see §8).
