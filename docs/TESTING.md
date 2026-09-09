# Expense Tracker Testing Standard

This repository treats tests as a defect-detection system, not as a test-count advertisement.
A test is valuable only when a failure tells us that a user-visible behavior, API contract,
data invariant, security boundary, integration, or deployment assumption is broken.

## Quality gates

A change is not considered ready when:

- Maven has compilation errors or test failures.
- Any test is skipped merely to make CI green.
- An API endpoint has no meaningful success, validation, authorization, and failure coverage appropriate to its contract.
- A security-sensitive endpoint is tested only for `200` responses.
- A UI test depends on fragile CSS position, generated text, or implementation-only DOM details when a stable semantic locator is available.
- Mobile behavior is tested only in portrait when the product supports responsive orientation.
- A regression bug is fixed without a regression test that would fail against the old behavior.

## Test pyramid

### 1. Unit tests

Fast, deterministic tests for business rules and pure logic:

- validation and normalization
- username generation and availability rules
- JWT creation/validation/expiry/tamper handling
- password reset and OTP lifecycle
- rate limiting
- report calculations
- import/export transformations
- encryption/decryption and tamper detection

### 2. Repository/integration tests

Run real persistence behavior against disposable databases. Verify:

- CRUD and relationships
- uniqueness and indexes/constraints
- transaction rollback
- date/time boundaries
- decimal/rounding behavior
- empty datasets
- duplicate records
- persistence after restart
- PostgreSQL/H2 compatibility where the application depends on it
- fallback database hydration and writes

### 3. API contract tests

Every controller endpoint must have a contract-oriented test. Coverage is organized by endpoint and includes, where applicable:

- valid request and response shape
- required/optional fields
- malformed JSON
- boundary values
- empty/null values
- invalid identifiers
- nonexistent resources
- duplicate resources
- ownership/IDOR attempts
- unauthenticated access
- invalid/expired/tampered JWT
- rate limiting
- content type and response headers
- pagination/filter/sort combinations
- download content type and filename
- downstream/service failures

The endpoint inventory currently includes authentication, users, expenses, incomes, categories,
savings goals, reports/range reports, health, synchronization, and WebAuthn/passkey routes.
The inventory must be refreshed whenever a controller changes.

### 4. Cucumber

Cucumber is reserved for business workflows that cross multiple components. It must not duplicate
hundreds of controller-unit assertions. Scenarios should describe outcomes such as:

- register → authenticate → create expense → filter dashboard
- create income → calculate cash flow
- create category → use it in a transaction
- export a selected period and verify totals
- Neon unavailable → hydrate encrypted HF snapshot → continue reading/writing
- invalid encrypted snapshot → remain safe and report recovery failure

### 5. Web UI end-to-end tests

Use Playwright for new browser coverage. Selenium tests should be migrated when they are brittle,
slow, or tied to browser-driver implementation details.

Critical flows include:

- landing/authentication
- registration and validation
- username suggestions
- login/logout/session expiry
- password reset
- Google OAuth integration boundary
- dashboard totals, filters, charts and insights
- expense/income CRUD
- categories, subscriptions, budgets and savings goals
- reports and downloads
- theme switching
- passkey/biometric browser flows where the environment supports WebAuthn
- error states and recovery

### 6. Responsive/regression UI matrix

Browser tests must exercise at least:

- phone portrait
- phone landscape
- tablet portrait
- tablet landscape
- desktop narrow
- desktop wide

Assertions should verify usable layout, visibility, overflow, dialogs, tables/cards, navigation,
forms and interactive controls. A screenshot comparison may be used for high-value pages, but
functional assertions remain mandatory.

### 7. Mobile application

The Expo/React Native application receives its own end-to-end suite rather than being treated as
a smaller web client. The suite covers:

- onboarding/authentication/OAuth boundary
- username suggestions
- dashboard and filter state
- expense/income/category CRUD
- subscriptions/budgets/savings
- reports and exports
- offline/error states
- session persistence and logout
- orientation changes and responsive breakpoints
- keyboard/input behavior
- modal and navigation behavior
- Android regression on release APKs

New native flows should use a stable mobile E2E framework such as Maestro or Detox. Unit/component
tests remain separate from device-level flows.

## Regression rule

Every production bug fixed in this repository must add a regression test at the lowest useful layer,
plus an end-to-end regression when the defect crossed a user-facing boundary.

## Mutation/quality strengthening

After the baseline suite is reliable, mutation testing should be introduced for the most critical
business/security packages. The goal is to prove that tests fail when production logic is deliberately
changed, exposing weak tests that merely execute code without checking behavior.

## CI tiers

- **Pull request gate:** compile + unit + repository/integration + API contract tests.
- **Main/release gate:** all PR tests + Cucumber + Playwright web E2E + build validation.
- **Scheduled/nightly:** full browser/device matrix, security regression, failover drills, and mutation testing.
- **Release candidate:** Android APK smoke/regression on the generated artifact.

A green pipeline means the tests passed. It must never mean that failures were ignored with
`continue-on-error`, broad exclusions, or disabled assertions.
