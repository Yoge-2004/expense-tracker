# Playwright E2E Tests

End-to-end browser tests for the Expense Tracker frontend.

## Quick Start

```bash
cd e2e
npm install
npx playwright install chromium
npm test
```

## Prerequisites

1. **Backend running** on `http://localhost:8080` (default)
   ```bash
   cd .. && ./mvnw spring-boot:run
   ```
2. **Frontend served** on `http://localhost:5500` (default)
   ```bash
   cd ../frontend && python -m http.server 5500
   ```
3. **Demo user** created by `DataInitializer`:
   - Email: `demo@expensetracker.com`
   - Password: `Demo1234!`

## Configuration

| Env Var     | Default                  | Purpose                        |
|-------------|--------------------------|--------------------------------|
| `BASE_URL`  | `http://localhost:5500`  | Frontend URL                   |
| `API_URL`   | `http://localhost:8080`  | Backend API URL (informational)|

Override at runtime:
```bash
BASE_URL=http://my-frontend.com npm test
```

## Commands

| Command                    | Description                          |
|----------------------------|--------------------------------------|
| `npm test`                 | Run all tests (headless)            |
| `npm run test:headed`      | Run tests with visible browser      |
| `npm run test:ui`          | Run tests with Playwright UI mode   |
| `npm run test:debug`       | Debug mode (step through tests)     |
| `npm run test:report`      | Open the HTML test report           |
| `npm run install-browsers` | Download Chromium binary            |
| `npm run install-deps`     | Install OS-level browser deps (Linux)|

## Test Files

| File                   | Tests                                           |
|------------------------|-------------------------------------------------|
| `login.spec.ts`        | Login page, registration page, forgot-password  |
| `dashboard.spec.ts`    | Dashboard rendering, charts, export buttons     |
| `expenses.spec.ts`     | Expense form, table, filters                    |

## CI Integration

Add this to your GitHub Actions workflow:

```yaml
- name: Run Playwright E2E tests
  run: |
    cd e2e
    npm install
    npx playwright install chromium
    npx playwright install-deps chromium
    npx playwright test
```

## Notes

- Tests inject a fake auth token into `localStorage` for DOM-rendering tests that
  don't need a live backend.
- The "login with demo credentials" test requires the backend running with the
  `DataInitializer` demo user.
- Screenshots and videos are captured on failure and saved in `test-results/`.
- The HTML report is generated in `playwright-report/`.
