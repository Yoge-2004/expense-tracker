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

## App update notices

When a newer version of the mobile app is published, people with the app installed are told in three places.

| Where | What | Works for |
|---|---|---|
| Push notification (phone's notification shade, app closed) | "Update available — Expense Tracker v1.0.5 is ready." Tapping it opens the app's update popup. | Every installed version, because the server sends it. |
| Popup on launch | Shows the new version, the release notes and an **Update now** button (downloads the APK inside the app and hands it to the installer, with progress). **Later** closes it; it returns on the next launch. | Versions that contain this feature. |
| Banner at the top of the app | "Update available · v1.0.5" with an **Update** button, shown for as long as the update is pending. Tapping it reopens the popup. | Versions that contain this feature. |

How it works:

- The server asks GitHub for the latest non-draft, non-prerelease release every six hours (`AppUpdateNotifier`). The APK
  workflow publishes one release per version, so publishing a release is what triggers the notice. The workflow stays
  manual (`workflow_dispatch`); nothing here builds an APK.
- Each phone reports its installed app version when it registers for push (`device_tokens.app_version`). A phone is told once
  per release and only if it is behind. Phones that never reported a version are older than any release with this feature,
  so they count as behind. The newest version a phone was told about is kept in `device_tokens.update_announced_version`.
- The notice is also stored in the notification inbox (kind **App updates**), which can be switched off in notification
  settings. A user who switched it off is not marked as told, so enabling it later still delivers it.
- The app checks GitHub itself on launch and when it returns to the foreground after 30 minutes. The last answer is cached,
  so a known update still shows when the phone is offline.

Settings: `app.release.repo` (default `Yoge-2004/expense-tracker`), `app.release.notify.enabled` (default `true`; the
existing `app.notifications.scheduler.enabled` also applies).

Note: phones that already have an older app get only the push notification. The popup and banner arrive with the first
release that includes this feature.

## Not included yet

- Browser push for the website (needs VAPID keys and a Web Push library). The website shows the inbox only.
- Security notices (password changed, new sign-in).
