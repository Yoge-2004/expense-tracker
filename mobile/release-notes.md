# Expense Tracker Mobile v1.0.13

A theme engine performance and typography release: **instant 0ms theme switching, custom `.ttf` / `.otf` font propagation across all weights and textboxes, and dynamic wallpaper theme inheritance across all banners and containers**.

---

## What's New in v1.0.13

### Theme Engine & Performance
- **Instant 0ms Theme Toggling**: Pre-warmed LRU theme caching completely eliminates calculation delays and re-render frame drops on dark/light toggle.
- **Dynamic Banner Theming**: Offline, cached data, device gap safety, peer loan migration, and receipt OCR banners now inherit the wallpaper theme engine tokens (`c.fillSubtle`, `c.primary`, `c.onPrimary`, and `c.text`) for WCAG-compliant contrast.
- **Themed Textboxes & Containers**: Textboxes, input borders, segment switchers, and elevated cards dynamically blend the active wallpaper palette.

### Typography & Custom Font Application
- **Custom Font (.ttf / .otf) Integration**: Full typography hierarchy (`display`, `body`, `bold`, `semibold`) resolves to imported custom fonts cleanly.
- **Android Typeface Reliability**: Automatic font-weight normalization for single-file custom fonts prevents native fallback to default system Roboto.

---

## Release & Artifact Summary

| Attribute | Details |
| :--- | :--- |
| **Release Version** | 1.0.13 |
| **Android Version Code** | 15 |
| **Package ID** | com.yoge.expensetracker |
| **iOS Bundle ID** | com.yoge.expensetracker |
| **Commit SHA** | main |

---

## Installation

1. Android: download the expense-tracker.apk asset from the release.
2. Verify: optionally compare the published SHA-256 checksum with your downloaded APK.

### Notes

- Reports reflect the selected date range and the persisted server-side ledger at export time.
