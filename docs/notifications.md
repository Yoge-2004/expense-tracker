# Notifications

Every notification is stored in the user's inbox (web bell, app Notifications screen). On phones it is
also pushed through Expo's push service, so it arrives with the app closed.

## What is sent

| Kind | When | Default |
|---|---|---|
| Budget warning | A budget reaches 80% of its limit | on |
| Budget limit reached | Spending reaches or passes the limit | on |
| Upcoming bills | A recurring bill is due in 3 days, 1 day, or today | on |
| Savings milestones | A goal reaches 25 / 50 / 75 / 100% | on |
| Unusually large expenses | Yesterday's expense is at least 3x the 90-day average (needs 5 past expenses; auto-created bills ignored) | on |
| Weekly summary | Sunday 18:00: spend, change vs last week, top category | on |
| Account and system | Important notices; cannot be switched off | always |

Each kind except the last can be switched off per user (web: bell, Notification settings; app: Notifications screen).
An event is only ever notified once (each notification carries a key such as `budget:12:2026-10-01:80`).

Jobs run at 09:00 daily and 18:00 on Sundays in the zone `NOTIFICATIONS_ZONE` (default `Asia/Kolkata`).
Set `NOTIFICATIONS_ENABLED=false` to switch every job off. Notifications older than 90 days are removed nightly.

## One-time setup for Android push (required)

Expo cannot give an Android build a push token without Firebase credentials. Until this is done, registration
fails quietly and the app keeps showing its own on-device alerts.

1. Create a Firebase project and add an Android app with the package name from `mobile/app.json`.
2. Download `google-services.json` into `mobile/` and set `"android": { "googleServicesFile": "./google-services.json" }` in `mobile/app.json`.
3. In Firebase, create a service account key (FCM HTTP v1) and upload it with `eas credentials` (Android, Push Notifications).
4. Rebuild the app. Expo Go cannot receive remote push.

iOS needs an Apple developer account; `eas credentials` creates the push key.

## Checking that it works

1. Sign in on a real build and allow notifications (asked at sign-up).
2. Open Notifications, then **Send a test notification**. It should appear in the list and arrive as a push.
3. Nothing arrives: confirm the phone registered (a row in `device_tokens`), then the setup above.

## API

All under `/api/notifications/user/{userId}` and require the user's own JWT:
`GET` (inbox + unread count), `POST /read`, `GET|PUT /preferences`, `POST|DELETE /devices`, `POST /test`.

## Not included yet

- Browser push for the website (needs VAPID keys and a Web Push library). The website shows the inbox only.
- Security notices (password changed, new sign-in).
