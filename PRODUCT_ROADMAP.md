# Expense Tracker — Product Roadmap

> Durable product-direction document for future feature development. This roadmap is separate from the current modernization recovery work. Do not implement roadmap features until the modernization baseline is stable and the relevant feature is explicitly brought into an implementation phase.

## 1. Product direction

Evolve Expense Tracker from a manual CRUD expense application into an intelligent, privacy-conscious financial companion that can capture transactions, understand them, protect the user from duplicates/errors, and provide useful financial intelligence without becoming intrusive.

Product development must preserve the existing SaaS/enterprise visual quality, responsive behavior, accessibility, performance, security, and user control.

## 2. Transaction ingestion and automatic capture

### App / payment notification capture

Support an opt-in mobile ingestion path that can detect relevant purchase/payment notifications generated on the user's device, subject to OS capabilities, permissions, privacy requirements, and platform policy.

The intended flow is:

1. A user makes a purchase through a supported payment/banking app.
2. The payment/banking app produces a transaction notification.
3. Expense Tracker's mobile ingestion layer receives an allowed notification event or other supported user-authorized signal.
4. The system extracts likely merchant, amount, currency, date/time, transaction type, and available account/payment context.
5. The transaction is normalized and classified.
6. Duplicate protection checks whether the transaction already exists.
7. High-confidence transactions can be auto-created according to the user's policy; uncertain transactions go to a review inbox.
8. The user can correct the result, and corrections can improve future personalization/classification.

Do not assume unrestricted notification access. Implement only APIs and permissions actually supported by the target mobile platforms, and make the feature explicit, opt-in, transparent, and revocable.

### Other ingestion channels

Future ingestion sources include:

- receipt/photo OCR;
- bank SMS where legally and technically appropriate;
- bank/payment app notifications;
- PDF/CSV/statement import;
- email/transaction-message ingestion where supported and explicitly authorized;
- manual natural-language transaction entry.

All ingestion paths should converge on a common transaction-ingestion pipeline rather than creating independent business logic for each source.

## 3. Transaction intelligence

Planned intelligent capabilities include:

- merchant normalization;
- category classification;
- confidence scoring;
- configurable auto-create/review policies;
- duplicate detection and idempotency;
- recurring transaction detection;
- subscription detection and management;
- salary/income intelligence;
- refund matching;
- anomaly detection;
- budget intelligence;
- cash-flow forecasting;
- financial calendar;
- financial health dashboard;
- semantic transaction search;
- personalized classification based on user corrections and preferences;
- financial copilot / natural-language financial assistance.

The previously created financial transaction ML design is the design reference for this area: `docs/superpowers/specs/2026-09-14-financial-transaction-ml-design.md`.

The ML design is intentionally a future implementation specification, not permission to start ML implementation during the current modernization recovery.

## 4. Notification UX

Notifications should be useful rather than noisy. Future notification categories may include:

- newly detected transaction awaiting review;
- automatically recorded transaction confirmation;
- duplicate/possible duplicate warning;
- unusual spending/anomaly alert;
- recurring payment/subscription detection;
- budget threshold or budget-risk alert;
- refund detected/matched;
- salary/income event detected;
- forecast or cash-flow warning;
- important financial-calendar reminders.

Notification frequency must be configurable. Avoid random or unexplained notifications. A purchase-triggered notification should have a clear reason, meaningful content, and an obvious path to review or correct the transaction.

### Notification icon

Replace the current mobile notification icon with a clearer, modern notification-specific icon that is visually consistent with the Expense Tracker design system and remains legible at small sizes.

The notification icon should:

- work in light and dark system contexts where applicable;
- remain recognizable at small sizes;
- avoid unnecessary visual detail;
- follow platform notification/icon requirements;
- avoid blue/green gradient treatment;
- use the product's established non-purple visual direction;
- be tested on actual target devices where notification rendering is available.

Do not confuse the notification icon with the application launcher icon; they are separate assets with separate platform constraints.

## 5. Review and correction loop

Build a review inbox for uncertain or newly captured transactions.

Users should be able to:

- accept a suggested transaction;
- edit merchant/category/amount/date;
- reject or dismiss a detection;
- mark a duplicate;
- explain/correct classification when useful;
- control whether similar future transactions are auto-created.

Corrections should become useful learning signals while respecting privacy and avoiding opaque behavior.

## 6. Privacy, security, and user control

Automatic ingestion is sensitive functionality. Future implementation must include:

- explicit opt-in permissions;
- clear explanation of what data is read and why;
- minimal data collection;
- secure local/network handling;
- safe credential and token handling;
- revocation/disable controls;
- deletion controls for captured source data where appropriate;
- auditability of automatically created transactions;
- no silent background collection beyond the permission and product contract;
- platform-policy compliance.

Sensitive notification contents must not be logged unnecessarily.

## 7. Delivery order

Recommended high-level order after modernization:

1. Stable transaction domain and idempotency foundation.
2. Mobile notification ingestion proof of concept using only supported platform APIs.
3. Parsing and normalization pipeline.
4. Review inbox and correction flow.
5. Notification UX and notification icon refresh.
6. Recurring/subscription and duplicate intelligence.
7. OCR/statement import channels.
8. Classification/confidence/personalization.
9. Anomaly, budget, income, refund, and cash-flow intelligence.
10. Financial calendar/health dashboard.
11. Natural-language transaction entry and financial copilot.
12. Broader ML optimization and continuous learning.

Each stage requires its own acceptance criteria, privacy review, automated tests, and real-device/browser verification where applicable.
