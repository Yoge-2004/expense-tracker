# Expense Tracker Mobile v1.0.9

A performance and cross-platform release focused on **zero-latency theme switching, scroll context isolation for infinite virtualized transaction ledgers, accurate ledger loading lifecycle states, iOS Retina scrollbar gutter separation, and strict iOS App Store & sandbox compliance**.

---

## What's New in v1.0.9

### Instant, Zero-Latency Theme Switching
- Removed React Navigation stack animation delays by disabling route transitions (`animation: "none"`) on the main tab navigator, eliminating the artificial 180ms screen fade delay during theme switching.
- Upgraded theme toggle button to a high-priority `Pressable` with `onPressIn` and `hitSlop={8}` to trigger theme shifts at t = 0ms upon initial touch contact.
- Removed synthetic rotation animations and decoupled heavy background blur aura renders (`AmbientAura.tsx` memoization) to eliminate GPU/CPU rasterization contention during theme swaps.

### Infinite Virtualized Ledger & Accurate Loading States
- Resolved React Native nested virtualized list warnings using `(ScrollView as any).Context` isolation (`<ScrollContext.Provider value={null}>`).
- Fixed premature display of final state banner: while transactions are being fetched from backend (`isLoading || refreshing`) or dynamically streaming rows on scroll, an active spinner (`"Loading transactions..."` / `"Loading more transactions..."`) is displayed.
- The final indicator (`— ✓ ALL {N} TRANSACTIONS LOADED —`) is strictly and exclusively rendered once all records have actually loaded into view and network sync is complete.
- Progressive streaming auto-reveals batches of 25 records on scroll (`onEndReached`) ensuring zero lag, instant startup, and seamless infinite scrolling.
- Adjusted bottom padding to prevent transaction card clipping against the ledger container boundary.

### iOS Platform Fidelity & Sandbox Safeguards
- Increased list right padding to provide a dedicated 5px gutter separating cards from the custom gold scrollbar track on high-DPI iOS Retina displays.
- Disabled bouncing and overscroll on inner nested lists (`bounces={false}`, `overScrollMode="never"`) to prevent nested scroll traps and momentum lock on iOS devices.
- Configured `NSFaceIDUsageDescription` in `app.json` for Apple biometric compliance.
- Guarded SMS clipboard reading against iOS 14+ paste privacy banners.
- Handled platform-specific update installation: Android supports in-app APK sideloading, while iOS safely routes users to Safari/TestFlight in compliance with App Store guidelines.

---

## Release & Artifact Summary

| Attribute | Details |
| :--- | :--- |
| **Release Version** | 1.0.9 |
| **Android Version Code** | 11 |
| **Package ID** | com.yoge.expensetracker |
| **iOS Bundle ID** | com.yoge.expensetracker |
| **Commit SHA** | main |

---

## Installation

1. Android: download the expense-tracker.apk asset from the release.
2. Verify: optionally compare the published SHA-256 checksum with your downloaded APK.

### Notes

- Reports reflect the selected date range and the persisted server-side ledger at export time.
- iOS build availability is credential-dependent; the Android release is the primary downloadable artifact when no Apple credentials are linked to EAS.
