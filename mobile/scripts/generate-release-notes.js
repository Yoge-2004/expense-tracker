const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return (stats.size / (1024 * 1024)).toFixed(2) + ' MB';
  } catch {
    return 'N/A';
  }
}

function getSha256(filePath, fallbackHashFile) {
  try {
    if (fallbackHashFile && fs.existsSync(fallbackHashFile)) {
      const content = fs.readFileSync(fallbackHashFile, 'utf8').trim();
      const firstToken = content.split(/\s+/)[0];
      if (firstToken && firstToken.length === 64) {
        return firstToken;
      }
    }
    if (fs.existsSync(filePath)) {
      const fileBuffer = fs.readFileSync(filePath);
      return crypto.createHash('sha256').update(fileBuffer).digest('hex');
    }
  } catch (err) {
    console.warn('Could not compute SHA-256:', err);
  }
  return 'Pending verification';
}

function main() {
  const baseDir = path.resolve(__dirname, '..');
  const appJsonPath = path.join(baseDir, 'app.json');
  const apkPath = path.join(baseDir, 'expense-tracker.apk');
  const sha256Path = path.join(baseDir, 'expense-tracker.apk.sha256');
  const outputPath = path.join(baseDir, 'release-notes.md');

  let version = '1.0.1';
  let versionCode = 2;
  let packageId = 'com.yoge.expensetracker';

  if (fs.existsSync(appJsonPath)) {
    try {
      const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
      version = appJson.expo?.version || version;
      versionCode = appJson.expo?.android?.versionCode || versionCode;
      packageId = appJson.expo?.android?.package || packageId;
    } catch (e) {
      console.warn('Error reading app.json:', e);
    }
  }

  const runNumber = process.env.GITHUB_RUN_NUMBER || 'latest';
  const commitSha = process.env.GITHUB_SHA || 'main';
  const shortSha = commitSha.length > 7 ? commitSha.substring(0, 7) : commitSha;
  const apkSize = getFileSize(apkPath);
  const sha256 = getSha256(apkPath, sha256Path);

  const markdown = `# 🚀 Expense Tracker Mobile v${version} (Build #${runNumber})

A major update for **Expense Tracker Mobile**, introducing the brand-new modern visual brand identity, interactive calendar navigation, chronological expense ledger ordering, enhanced security PIN modal layout, and comprehensive category usage protection.

---

### ✨ What's New & Key Highlights

* **🎨 Modern App Icon & Brand Identity**:
  * Ultra-premium fintech shield emblem featuring emerald (\`#10B981\`) and electric cyan (\`#06B6D4\`) accents set against a deep obsidian background.
  * Designed with full Android adaptive icon safe-zone compliance.

* **📅 Interactive Calendar Picker**:
  * Rigid 7-column grid alignment (\`14.285%\`) ensuring day headers and dates align perfectly across all device widths.
  * Fixed trailing empty days padding to prevent month-end row wrapping or scattering.
  * Interactive **Month & Year Selector**: Tap the month header to jump across years and months directly in a clean 3-column grid without tedious pagination.

* **⏱️ Chronological Expense Ledger**:
  * Upgraded sorting engine with insertion-order tie-breaking (\`id DESC\`). Transactions recorded on the same date now reliably appear newest-first.
  * Synchronized with Spring Boot backend JPA query (\`ORDER BY e.expenseDate DESC, e.id DESC\`).

* **🔒 Account Security PIN Modal**:
  * Centered full-width stretch layout with edge-anchored close button \`(×)\`.
  * Perfectly aligned 6-digit PIN input fields with clear typography and tactile feedback.

* **🛡️ Category Dependency Protection**:
  * Replaced silent failures with informative lock dialogs when attempting to delete categories actively referenced by expenses, subscriptions, or budgets.

---

### 📦 Build & Artifact Summary

| Attribute | Details |
| :--- | :--- |
| **Release Version** | \`${version}\` |
| **Android Version Code** | \`${versionCode}\` |
| **Application ID** | \`${packageId}\` |
| **Build Profile** | EAS Preview (Standalone APK) |
| **Build Number** | \`#${runNumber}\` |
| **Commit SHA** | [\`${shortSha}\`](https://github.com/Yoge-2004/expense-tracker/commit/${commitSha}) |
| **APK File Size** | \`${apkSize}\` |
| **SHA-256 Checksum** | \`${sha256}\` |

---

### 📲 Installation & Update Guide

1. **Download APK**: Download **\`expense-tracker.apk\`** below under **Assets**.
2. **Install / Upgrade**: Open the APK on your Android device to install (allow "Install from Unknown Sources" if prompted).
3. **Seamless In-Place Upgrade**: Upgrading preserves existing local SQLite storage, Google OAuth tokens, and biometric preferences without conflicts.

#### 🔐 Checksum Verification (Optional)
\`\`\`bash
# Linux / macOS
sha256sum expense-tracker.apk

# Windows PowerShell
Get-FileHash -Algorithm SHA256 .\\expense-tracker.apk
\`\`\`
Expected Hash:
\`\`\`
${sha256}
\`\`\`
`;

  fs.writeFileSync(outputPath, markdown, 'utf8');
  console.log(`Successfully generated release notes at: ${outputPath}`);
}

main();
