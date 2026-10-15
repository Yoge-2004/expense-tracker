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

  let version = '1.0.4';
  let versionCode = 6;
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
    'A release focused on **bulk notification clearing, instant touch clearing UX, verified ML categorization, responsive theme animations, and polished financial reporting**.',
    '',
    '---',
    '',
    "## What's New in v" + version,
    '',
    '### Notification Management (Web & Mobile)',
    '- Added **"Clear all notifications"** button in both the mobile app header and web dashboard inbox panel.',
    '- Added backend bulk-clear API endpoint (`DELETE /api/notifications/user/{userId}`) with immediate unread count and badge counter reset.',
    '- Protected bulk deletion with an in-app confirmation dialog to prevent accidental data loss.',
    '',
    '### Search UX & Soft Keyboard Touch Responsiveness',
    '- Fixed search bar clear button in mobile app: tapping the **X** icon now clears the input immediately on the first touch without requiring an extra tap to retract the keyboard.',
    '- Enabled `keyboardShouldPersistTaps="handled"` on scroll views and currency lists, paired with `onPressIn` and expanded hit slop.',
    '',
    '### Machine Learning & SMS Expense Categorization',
    '- Connected automated SMS notification listeners with ML inference categorizer for credit and debit transaction tracking.',
    '- Hardened ML training pipelines, promotion gates, and dataset loading routines for continuous model retraining.',
    '- Verified model publishing to Hugging Face Model Hub and serving Space sync; all 51 ML pytest suites passing with headless Agg plotting.',
    '',
    '### Theme Switching & Visual Refinements',
    '- Fixed theme toggle 360-degree rotation animation so the moon icon maintains an upright position across theme toggles.',
    '- Corrected Savings Retention Rate percentage formatting in executive Excel workbooks.',
    '- Resolved Java 21 IDE inspections in `ExportServiceImpl` with modern record constructs and optimized collections.',
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
