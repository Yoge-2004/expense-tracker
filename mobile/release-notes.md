# Expense Tracker Mobile v1.0.11

A theming and polish release: **colours now follow your palette everywhere, and the build runs on updated libraries**.

---

## What's New in v1.0.11

### Colours that follow your palette
- Spend-by-category and other chart colours come from your chosen theme colours instead of the wallpaper image.
- Primary Brand and Primary Gradient are now two separate choices in the theme studio; picking one no longer overwrites the other.
- Buttons, chips, badges, the avatar, the calculator and spinners use text colours chosen for readability on your palette.
- Progress bars and the offline banner follow the theme instead of fixed colours.

### Under the hood
- Updated TypeScript, Expo packages and test tooling to their latest compatible versions.
- The data-safety tools from 1.0.10 (safety copy, compare and restore) are unchanged.

---

## Release & Artifact Summary

| Attribute | Details |
| :--- | :--- |
| **Release Version** | 1.0.11 |
| **Android Version Code** | 13 |
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
