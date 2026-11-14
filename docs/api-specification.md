# Expense Tracker REST API Specification

This document defines the REST API contract for the Expense Tracker platform. 

All endpoints accept and return JSON payloads (`application/json`) unless otherwise specified (e.g. multipart statement uploads, binary Excel/PDF report downloads).

---

## 1. Global Conventions & Headers

### Request Headers
| Header | Description | Required |
|---|---|---|
| `Authorization` | `Bearer <JWT_TOKEN>` | Yes (for protected endpoints) |
| `Content-Type` | `application/json` | Yes (for POST, PUT requests) |
| `X-Correlation-ID` | UUID tracing identifier for distributed log correlation | Optional (generated automatically if omitted) |
| `X-Admin-PIN` | 4-to-6 digit numeric step-up PIN | Required for sensitive admin endpoints |

### Standard Error Response (`GlobalExceptionHandler`)
```json
{
  "timestamp": "2026-11-15T01:00:00Z",
  "status": 400,
  "error": "Bad Request",
  "message": "Validation failed: amount must be greater than 0",
  "path": "/api/expenses/user/1"
}
```

---

## 2. Authentication & Identity (`/api/auth`)

### `POST /api/auth/register`
Creates a new user account.
- **Request Body:**
  ```json
  {
    "username": "jane_doe",
    "email": "jane@example.com",
    "password": "SecurePassword123!"
  }
  ```
- **Responses:**
  - `201 Created`: Returns user object with `id`, `username`, `email`, `role`.
  - `400 Bad Request`: Email or username already taken or validation failure.

### `POST /api/auth/login`
Authenticates user credentials and issues a JWT token.
- **Request Body:**
  ```json
  {
    "identifier": "jane@example.com",
    "password": "SecurePassword123!"
  }
  ```
- **Responses:**
  - `200 OK`:
    ```json
    {
      "token": "eyJhbGciOi...",
      "userId": 1,
      "username": "jane_doe",
      "email": "jane@example.com",
      "role": "ROLE_USER"
    }
    ```
  - `401 Unauthorized`: Invalid credentials.

### `POST /api/auth/google`
Authenticates via Google OAuth2 ID token.
- **Request Body:** `{"idToken": "<google_jwt_token>"}`
- **Responses:** `200 OK` (returns application session JWT).

### `GET /api/auth/config`
Retrieves public authentication capabilities (Google Client ID, WebAuthn availability).

---

## 3. WebAuthn FIDO2 Passkeys (`/api/webauthn`)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/webauthn/register/options` | Generates WebAuthn registration credential creation options |
| `POST` | `/api/webauthn/register/verify` | Verifies and stores authenticator public key |
| `POST` | `/api/webauthn/login/options` | Generates WebAuthn authentication assertion options |
| `POST` | `/api/webauthn/login/verify` | Verifies signed assertion challenge and issues session JWT |
| `POST` | `/api/webauthn/recovery/initiate` | Initiates passkey recovery via verified email token |
| `POST` | `/api/webauthn/recovery/confirm` | Confirms recovery token and resets credentials |

---

## 4. Users & Preferences (`/api/users`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/users/{userId}` | Retrieves user profile and account details |
| `PUT` | `/api/users/{userId}` | Updates username, email, or password |
| `DELETE` | `/api/users/{userId}` | Cascades account deletion and associated ledgers |
| `GET` | `/api/users/{userId}/appearance` | Retrieves custom theme, palette, and wallpaper config |
| `PUT` | `/api/users/{userId}/appearance` | Saves customized UI appearance settings |
| `POST` | `/api/users/{userId}/pin` | Sets or updates user step-up security PIN |
| `POST` | `/api/users/{userId}/pin/verify` | Verifies step-up security PIN |

---

## 5. Expense Management (`/api/expenses`)

### `GET /api/expenses/user/{userId}`
Retrieves all expenses for the user. Supports query parameters `startDate`, `endDate`, `category`.
- **Response `200 OK`:**
  ```json
  [
    {
      "id": 101,
      "title": "Grocery Shopping",
      "amount": 84.50,
      "date": "2026-11-14",
      "category": { "id": 2, "name": "Groceries" },
      "notes": "Weekly produce and pantry refill"
    }
  ]
  ```

### `POST /api/expenses/user/{userId}`
Records a new expense. Automatically checks budget utilization and generates alert notifications if thresholds are crossed.
- **Request Body:**
  ```json
  {
    "title": "Electric Bill",
    "amount": 120.00,
    "date": "2026-11-15",
    "categoryId": 4,
    "notes": "November power consumption"
  }
  ```
- **Response:** `201 Created`

### `PUT /api/expenses/{id}/user/{userId}`
Updates an existing expense entry.

### `DELETE /api/expenses/{id}/user/{userId}`
Deletes an expense entry.

### `POST /api/expenses/transfer`
Executes an inter-account or ledger balance adjustment.

### Recurring Expenses (`/api/expenses/recurring`)
- `GET /api/expenses/recurring/user/{userId}`: Lists active recurring schedules.
- `POST /api/expenses/recurring/user/{userId}`: Schedules a recurring expense (`frequency`: `DAILY`, `WEEKLY`, `BIWEEKLY`, `MONTHLY`, `QUARTERLY`, `YEARLY`).
- `DELETE /api/expenses/recurring/{id}/user/{userId}`: Cancels recurring schedule.

---

## 6. Income Management (`/api/incomes`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/incomes/user/{userId}` | Lists all recorded income entries |
| `POST` | `/api/incomes/user/{userId}` | Records new income (`title`, `amount`, `date`, `source`, `category`) |
| `PUT` | `/api/incomes/{id}/user/{userId}` | Updates an existing income record |
| `DELETE` | `/api/incomes/{id}/user/{userId}` | Deletes an income record |
| `GET` | `/api/incomes/recurring/user/{userId}` | Lists active recurring income streams |
| `POST` | `/api/incomes/recurring/user/{userId}` | Creates new recurring income stream |

---

## 7. Budgets (`/api/expenses/budget`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/expenses/budget/user/{userId}` | Retrieves all budget allocations for the user |
| `POST` | `/api/expenses/budget/user/{userId}` | Creates a budget (`categoryId`, `limitAmount`, `period`: `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`) |
| `PUT` | `/api/expenses/budget/{id}/user/{userId}` | Updates budget limit or period |
| `DELETE` | `/api/expenses/budget/{id}/user/{userId}` | Deletes budget |
| `GET` | `/api/expenses/budget/status/user/{userId}` | Computes live spent amount, remaining amount, and % utilization for each budget |

---

## 8. Savings Goals (`/api/savings/goals`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/savings/goals/user/{userId}` | Lists active savings goals |
| `POST` | `/api/savings/goals/user/{userId}` | Creates goal (`name`, `targetAmount`, `currentAmount`, `targetDate`) |
| `PUT` | `/api/savings/goals/{id}/user/{userId}` | Updates goal or deposits contribution |
| `DELETE` | `/api/savings/goals/{id}/user/{userId}` | Removes savings goal |

---

## 9. Loans & Debt Tracking (`/api/loans`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/loans/user/{userId}` | Retrieves debt and loan records |
| `POST` | `/api/loans/user/{userId}` | Creates loan/borrow record (`borrowerName`, `amount`, `direction`, `dueDate`) |
| `PUT` | `/api/loans/{id}/settle/user/{userId}` | Toggles settlement status |
| `DELETE` | `/api/loans/{id}/user/{userId}` | Deletes loan record |
| `GET` | `/api/loans/metrics/user/{userId}` | Aggregates total lent, total borrowed, and outstanding balance |

---

## 10. Reports & Statement Exports (`/api/reports`)

### Extensible Range Export Strategy
- **`GET /api/reports/user/{userId}/export/range/{format}`**
  - Polymorphic format dispatch (`excel`, `pdf`).
  - Query parameters: `startDate=YYYY-MM-DD`, `endDate=YYYY-MM-DD`, `currency=USD`.
  - Returns binary document stream with formatted headers:
    - Excel: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
    - PDF: `application/pdf`

### Statement Import Strategy
- **`POST /api/reports/user/{userId}/import/statement`**
  - Content-Type: `multipart/form-data`
  - Param: `file` (CSV, Excel bank statement)
  - Automatically matches statement parser strategy (`HDFC`, `ICICI`, `Chase`, Generic CSV) to extract and categorize transactions.

---

## 11. Machine Learning Inference (`/api/ml`)

Forwarded to the Python FastAPI microservice:

| Endpoint | Method | Input | Output |
|---|---|---|---|
| `/api/ml/categorize` | `POST` | `{"text": "Starbucks Coffee", "amount": 5.40}` | `{"category": "Food & Dining", "confidence": 0.94}` |
| `/api/ml/normalize-merchant` | `POST` | `{"rawMerchant": "AMZN MKTP US*281A"}` | `{"normalizedMerchant": "Amazon", "similarity": 0.98}` |
| `/api/ml/detect-duplicates` | `POST` | `{"transactions": [...]}` | `{"duplicateClusters": [...]}` |
| `/api/ml/score-anomaly` | `POST` | `{"amount": 1250.0, "category": "Food"}` | `{"anomalyScore": 0.89, "isAnomaly": true}` |
| `/api/ml/forecast-spending` | `POST` | `{"history": [...]}` | `{"forecast": [120.4, 98.2, 110.0, ...]}` |

---

## 12. System Health & DR Sync (`/api/health`, `/api/sync`)

- `GET /api/health` &rarr; Checks database connection pool and returns `{"status": "UP"}`.
- `GET /api/sync/hf-status` &rarr; Reports encrypted Hugging Face disaster recovery snapshot status.
- `POST /api/sync/push-to-hf` &rarr; Forces an encrypted AES-256 backup snapshot sync to cloud DR storage.
