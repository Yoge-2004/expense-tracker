const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function getFileSize(filePath) {
  try { return (fs.statSync(filePath).size / (1024 * 1024)).toFixed(2) + ' MB'; }
  catch { return 'N/A'; }
}

function getSha256(filePath, fallbackHashFile) {
  try {
    if (fallbackHashFile && fs.existsSync(fallbackHashFile)) {
      const token = fs.readFileSync(fallbackHashFile, 'utf8').trim().split(/\s+/)[0];
      if (token && token.length === 64) return token;
    }
    if (fs.existsSync(filePath)) return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  } catch (err) { console.warn('Could not compute SHA-256:', err); }
  return 'Pending verification';
}

function main() {
  const baseDir = path.resolve(__dirname, '..');
  const appJsonPath = path.join(baseDir, 'app.json');
  const apkPath = path.join(baseDir, 'expense-tracker.apk');
  const apkShaPath = path.join(baseDir, 'expense-tracker.apk.sha256');
  const ipaPath = path.join(baseDir, 'expense-tracker.ipa');
  const ipaShaPath = path.join(baseDir, 'expense-tracker.ipa.sha256');
  const outputPath = path.join(baseDir, 'release-notes.md');

  let version = '1.0.9';
  let versionCode = 11;
  let packageId = 'com.yoge.expensetracker';
  let bundleId = 'com.yoge.expensetracker';
  if (fs.existsSync(appJsonPath)) {
    try {
      const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
      version = appJson.expo?.version || version;
      versionCode = appJson.expo?.android?.versionCode || versionCode;
      packageId = appJson.expo?.android?.package || packageId;
      bundleId = appJson.expo?.ios?.bundleIdentifier || bundleId;
    } catch (e) { console.warn('Error reading app.json:', e); }
  }

  const commitSha = process.env.GITHUB_SHA || 'main';
  const shortSha = commitSha.length > 7 ? commitSha.slice(0, 7) : commitSha;
  const hasApk = fs.existsSync(apkPath);
  const hasIpa = fs.existsSync(ipaPath);
  const apkSize = getFileSize(apkPath);
  const apkSha = getSha256(apkPath, apkShaPath);
  const ipaSize = getFileSize(ipaPath);
  const ipaSha = getSha256(ipaPath, ipaShaPath);

  const rows = [
    '| Attribute | Details |',
    '| :--- | :--- |',
    '| **Release Version** | ' + version + ' |',
    '| **Android Version Code** | ' + versionCode + ' |',
    '| **Package ID** | ' + packageId + ' |',
    '| **iOS Bundle ID** | ' + bundleId + ' |',
    '| **Commit SHA** | ' + shortSha + ' |'
  ];
  if (hasApk) rows.push('| **Android APK Size** | ' + apkSize + ' |', '| **Android APK SHA-256** | ' + apkSha + ' |');
  if (hasIpa) rows.push('| **iOS IPA Size** | ' + ipaSize + ' |', '| **iOS IPA SHA-256** | ' + ipaSha + ' |');

  const lines = [
    '# Expense Tracker Mobile v' + version,
    '',
    'A performance and cross-platform release focused on **zero-latency theme switching, scroll context isolation for infinite virtualized transaction ledgers, accurate ledger loading lifecycle states, iOS Retina scrollbar gutter separation, and strict iOS App Store & sandbox compliance**.',
    '',
    '---',
    '',
    "## What's New in v" + version,
    '',
    '### Instant, Zero-Latency Theme Switching',
    '- Removed React Navigation stack animation delays by disabling route transitions (`animation: "none"`) on the main tab navigator, eliminating the artificial 180ms screen fade delay during theme switching.',
    '- Upgraded theme toggle button to a high-priority `Pressable` with `onPressIn` and `hitSlop={8}` to trigger theme shifts at t = 0ms upon initial touch contact.',
    '- Removed synthetic rotation animations and decoupled heavy background blur aura renders (`AmbientAura.tsx` memoization) to eliminate GPU/CPU rasterization contention during theme swaps.',
    '',
    '### Infinite Virtualized Ledger & Accurate Loading States',
    '- Resolved React Native nested virtualized list warnings using `(ScrollView as any).Context` isolation (`<ScrollContext.Provider value={null}>`).',
    '- Fixed premature display of final state banner: while transactions are being fetched from backend (`isLoading || refreshing`) or dynamically streaming rows on scroll, an active spinner (`"Loading transactions..."` / `"Loading more transactions..."`) is displayed.',
    '- The final indicator (`— ✓ ALL {N} TRANSACTIONS LOADED —`) is strictly and exclusively rendered once all records have actually loaded into view and network sync is complete.',
    '- Progressive streaming auto-reveals batches of 25 records on scroll (`onEndReached`) ensuring zero lag, instant startup, and seamless infinite scrolling.',
    '- Adjusted bottom padding to prevent transaction card clipping against the ledger container boundary.',
    '',
    '### iOS Platform Fidelity & Sandbox Safeguards',
    '- Increased list right padding to provide a dedicated 5px gutter separating cards from the custom gold scrollbar track on high-DPI iOS Retina displays.',
    '- Disabled bouncing and overscroll on inner nested lists (`bounces={false}`, `overScrollMode="never"`) to prevent nested scroll traps and momentum lock on iOS devices.',
    '- Configured `NSFaceIDUsageDescription` in `app.json` for Apple biometric compliance.',
    '- Guarded SMS clipboard reading against iOS 14+ paste privacy banners.',
    '- Handled platform-specific update installation: Android supports in-app APK sideloading, while iOS safely routes users to Safari/TestFlight in compliance with App Store guidelines.',
    '',
    '---',
    '',
    '## Release & Artifact Summary',
    '',
    rows.join('\n'),
    '',
    '---',
    '',
    '## Installation',
    '',
    '1. Android: download the expense-tracker.apk asset from the release.',
    hasIpa ? '2. iOS: an IPA is available in Assets; Apple provisioning requirements still apply.' : '2. Verify: optionally compare the published SHA-256 checksum with your downloaded APK.',
    '',
    '### Notes',
    '',
    '- Reports reflect the selected date range and the persisted server-side ledger at export time.',
    '- iOS build availability is credential-dependent; the Android release is the primary downloadable artifact when no Apple credentials are linked to EAS.'
  ];

  fs.writeFileSync(outputPath, lines.join('\n') + '\n', 'utf8');
  console.log('Generated release notes: ' + outputPath);
}

main();
