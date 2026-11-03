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

  let version = '1.0.11';
  let versionCode = 13;
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
    'A theming and polish release: **colours now follow your palette everywhere, and the build runs on updated libraries**.',
    '',
    '---',
    '',
    "## What's New in v" + version,
    '',
    '### Colours that follow your palette',
    '- Spend-by-category and other chart colours come from your chosen theme colours instead of the wallpaper image.',
    '- Primary Brand and Primary Gradient are now two separate choices in the theme studio; picking one no longer overwrites the other.',
    '- Buttons, chips, badges, the avatar, the calculator and spinners use text colours chosen for readability on your palette.',
    '- Progress bars and the offline banner follow the theme instead of fixed colours.',
    '',
    '### Under the hood',
    '- Updated TypeScript, Expo packages and test tooling to their latest compatible versions.',
    '- The data-safety tools from 1.0.10 (safety copy, compare and restore) are unchanged.',
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
