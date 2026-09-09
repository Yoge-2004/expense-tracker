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

  let version = '1.0.3';
  let versionCode = 5;
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
    'A release focused on **trustworthy financial reporting, filter-synchronized analytics, premium exports, responsive layouts, notifications, and CI reliability**.',
    '',
    '---',
    '',
    "## What's New",
    '',
    '### Dashboard Intelligence',
    '- **Filters now drive the dashboard itself**, not only the transaction ledger: KPIs, cash-flow metrics, top category, insights, and financial charts use the same active search/category/date-filtered dataset.',
    '- Search, category, Today, This Month, Last 30D, and Custom Range remain synchronized with the visible analytics.',
    '- Dashboard calculations use the freshest persisted records after synchronization.',
    '',
    '### Executive Export Center',
    '- Export now requires an explicit reporting period: **Month & Year**, **Custom Range**, or **All Time**.',
    '- PDF and Excel reports are generated from **live backend ledger data at export time**, reducing stale-cache and missed-record exports.',
    '- Custom ranges are passed directly to the backend reporting endpoints.',
    '',
    '### Premium PDF Report',
    '- Executive KPI block for spend, income, net cash flow, and transaction count.',
    '- Management-oriented insights including largest cost centre, average transaction value, and cash-flow interpretation.',
    '- Category breakdown with spend share.',
    '- Full transaction ledger for the selected reporting period.',
    '- Clean financial typography with no decorative glyph/icon noise.',
    '',
    '### Power BI-Inspired Excel Workbook',
    '- **Executive Dashboard** sheet with headline KPIs and insights.',
    '- **Category Analysis** sheet with spend, share, transaction count, and average transaction value.',
    '- **Transactions** sheet with a clean audit-friendly ledger.',
    '- **Cash Flow** sheet with monthly income, spend, and net movement.',
    '- Removed the previous glyph-heavy presentation in favour of a restrained executive reporting layout.',
    '',
    '### Download Experience',
    "- Export completion is routed through the app's custom alert UI instead of relying on the native Android download-success alert.",
    '- Export filenames include the selected reporting period.',
    '',
    '### Notifications & Responsive App',
    '- Android notification icon/channel configuration is aligned with the app visual identity.',
    '- iOS notification configuration is included in the Expo project; a final iOS IPA still depends on Apple Developer credentials being available to EAS.',
    '- Native orientation is now configured for default orientation, enabling landscape-aware layouts.',
    '- Calendar/date-selection controls were hardened against narrow-screen overflow.',
    '',
    '### Build & Delivery Reliability',
    "- GitHub Actions now use the Node 24-compatible action generations required ahead of GitHub's Node 20 removal.",
    '- EAS CLI and Expo Doctor versions are pinned for reproducible mobile builds.',
    '- Backend report compilation is covered by CI.',
    '- Spring Boot production JAR delivery can be published to the Hugging Face backend Space from GitHub Actions when the repository has an HF_TOKEN write secret.',
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
