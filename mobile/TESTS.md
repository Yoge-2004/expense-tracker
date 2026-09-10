# Mobile App Tests

Comprehensive test suite for the Expense Tracker React Native / Expo mobile app.

## Test Structure

```
mobile/
├── __tests__/              # Jest unit tests
│   ├── currency.test.ts    # Currency service tests (40+ tests)
│   ├── api.test.ts         # API service / ApiError tests (20+ tests)
│   ├── auth-context.test.ts# AuthContext tests
│   ├── setup.ts            # Global test setup
│   └── __mocks__/
│       └── fileMock.js     # Static file mock for Jest
├── e2e/                    # Detox E2E tests
│   ├── login.e2e.ts        # Login & authentication flow tests
│   ├── dashboard.e2e.ts    # Dashboard & expense management tests
│   ├── config.json         # Detox Jest configuration
│   └── artifacts/          # E2E test artifacts (screenshots, logs)
├── jest.config.js          # Jest configuration
└── .detoxrc.js             # Detox configuration (iOS/Android)
```

## Running Unit Tests (Jest)

```bash
cd mobile
npm install
npm test                    # run all unit tests
npm run test:watch          # watch mode
npm run test:coverage       # with coverage report
npm run test:ci             # CI mode (coverage, max 2 workers)
```

### Unit Test Coverage

| File | Tests | What's covered |
|------|-------|----------------|
| `currency.test.ts` | 40+ | `WORLD_CURRENCIES` registry, `getCurrencySymbol()`, `formatCurrencyAmount()` — case insensitivity, null/undefined handling, NaN, large numbers, all major currencies |
| `api.test.ts` | 20+ | `ApiError` class — construction, defaults, `isTimeout`, `isNetworkError`, `isUnauthorized`, `validationErrors`, `rawPayload`, all `ApiErrorCode` variants |
| `auth-context.test.ts` | 2 | `AuthProvider` export, `useAuth` throws outside provider |

## Running E2E Tests (Detox)

### Prerequisites

1. **iOS**: Xcode + iOS simulator
2. **Android**: Android Studio + emulator
3. **Detox CLI**: `npm install -g detox-cli`

### Build & Test

```bash
cd mobile

# iOS (debug)
detox build -c ios.sim.debug
detox test -c ios.sim.debug

# iOS (release)
detox build -c ios.sim.release
detox test -c ios.sim.release

# Android (debug)
detox build -c android.emu.debug
detox test -c android.emu.debug
```

### E2E Test Coverage

| File | Tests | What's covered |
|------|-------|----------------|
| `login.e2e.ts` | 10+ | Login screen rendering, form input, invalid credentials, Google OAuth button, biometric login, navigation to register/forgot-password |
| `dashboard.e2e.ts` | 10+ | Dashboard metrics, bottom tab bar, charts, add expense flow (form fields, input, validation, save), subscriptions tab, profile tab (user info, theme toggle, logout) |

## CI Integration

Add to your GitHub Actions workflow:

```yaml
- name: Run mobile unit tests
  working-directory: mobile
  run: |
    npm install
    npm run test:ci
```

## Notes

- Unit tests run in Node.js (no simulator required) — fast and suitable for CI.
- E2E tests require a running simulator/emulator and a built app binary.
- The E2E tests assume a demo user exists: `demo@expensetracker.com` / `Demo1234!`
- Screenshots are saved in `e2e/artifacts/` on failure (Detox).
- Coverage reports are in `coverage/` (Jest).
