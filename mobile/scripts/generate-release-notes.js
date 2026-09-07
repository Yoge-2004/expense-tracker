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
  const apkSha256Path = path.join(baseDir, 'expense-tracker.apk.sha256');
  const ipaPath = path.join(baseDir, 'expense-tracker.ipa');
  const ipaSha256Path = path.join(baseDir, 'expense-tracker.ipa.sha256');
  const outputPath = path.join(baseDir, 'release-notes.md');

  let version = '1.0.2';
  let versionCode = 3;
  let packageId = 'com.yoge.expensetracker';
  let bundleId = 'com.yoge.expensetracker';

  if (fs.existsSync(appJsonPath)) {
    try {
      const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
      version = appJson.expo?.version || version;
      versionCode = appJson.expo?.android?.versionCode || versionCode;
      packageId = appJson.expo?.android?.package || packageId;
      bundleId = appJson.expo?.ios?.bundleIdentifier || bundleId;
    } catch (e) {
      console.warn('Error reading app.json:', e);
    }
  }

  const runNumber = process.env.GITHUB_RUN_NUMBER || 'latest';
  const commitSha = process.env.GITHUB_SHA || 'main';
  const shortSha = commitSha.length > 7 ? commitSha.substring(0, 7) : commitSha;

  const hasApk = fs.existsSync(apkPath);
  const apkSize = getFileSize(apkPath);
  const apkSha256 = getSha256(apkPath, apkSha256Path);

  const hasIpa = fs.existsSync(ipaPath);
  const ipaSize = getFileSize(ipaPath);
  const ipaSha256 = getSha256(ipaPath, ipaSha256Path);

  let artifactsTable = `| Attribute | Details |
| :--- | :--- |
| **Release Version** | \`${version}\` |
| **Version Code / Build** | Android: \`${versionCode}\` / iOS: \`${versionCode}\` |
| **Package / Bundle ID** | \`${packageId}\` |
| **Build Number** | \`#${runNumber}\` |
| **Commit SHA** | [\`${shortSha}\`](https://github.com/Yoge-2004/expense-tracker/commit/${commitSha}) |`;

  if (hasApk) {
    artifactsTable += `
| **Android APK Size** | \`${apkSize}\` |
| **Android APK SHA-256** | \`${apkSha256}\` |`;
  }

  if (hasIpa) {
    artifactsTable += `
| **iOS IPA Size** | \`${ipaSize}\` |
| **iOS IPA SHA-256** | \`${ipaSha256}\` |`;
  }

  const markdown = `# 🚀 Expense Tracker Mobile v${version} (Build #${runNumber})

A major update for **Expense Tracker Mobile**, featuring the brand-new 3D wallet brand identity, intuitive year navigation steppers and selectors, natural security PIN cursor positioning, and verified Google OAuth authentication.

---

### ✨ What's New & Key Highlights

* **👛 New App Icon & Visual Identity**:
  * Premium 3D-styled leather wallet motif with white stitching, gold Indian Rupee (₹) coin, receipt, and payment card.
  * Rendered against an elegant warm cream (\`#F9F6EF\`) background with Android adaptive icon safe-zone centering.

* **📅 Intuitive Year & Month Navigation**:
  * Dual dedicated steppers: **\`‹ Sep ▾ ›\`** and **\`‹ ${new Date().getFullYear()} ▾ ›\`**.
  * **1-Tap Year Jump**: Directly tap **\`‹\`** or **\`›\`** beside the year to step forward or backward by a full year without nested menus.
  * **Full Year Selector Grid**: Tap the year dropdown **\`${new Date().getFullYear()} ▾\`** to open a 12-year grid view with decade navigation.
  * **Month Selector Grid**: Tap **\`Sep ▾\`** to jump to any month in one tap.

* **🔒 Security PIN Cursor Fix**:
  * Updated PIN input layout with left alignment and comfortable padding, ensuring the cursor (\`|\`) blinks naturally at the beginning of the textbox.
  * Added clear, friendly placeholders (\`Enter 6-digit PIN\` / \`Confirm 6-digit PIN\`).

* **🛡️ Category Dependency Protection**:
  * Informative lock dialog preventing silent deletion of categories actively linked to budgets, subscriptions, or transactions.

* **⏱️ Chronological Expense Ledger**:
  * Reverse-chronological insertion-order sorting (\`id DESC\`) on both mobile client and Spring Boot JPA backend.

---

### 📦 Build & Artifact Summary

${artifactsTable}

---

### 📲 Installation & Update Guide

1. **Android Users**: Download **\`expense-tracker.apk\`** below under **Assets** and open to install.
${hasIpa ? '2. **iOS Users**: Download **`expense-tracker.ipa`** below and install via Apple Configurator, TestFlight, or ad-hoc provisioning.\n3.' : '2.'} **In-Place Upgrade**: All your existing login sessions, local caches, and biometric preferences remain safe and untouched.

#### 🔐 Checksum Verification (Optional)
\`\`\`bash
# Linux / macOS
sha256sum expense-tracker.apk

# Windows PowerShell
Get-FileHash -Algorithm SHA256 .\\expense-tracker.apk
\`\`\`
`;

  fs.writeFileSync(outputPath, markdown, 'utf8');
  console.log(`Successfully generated release notes at: ${outputPath}`);
}

main();
