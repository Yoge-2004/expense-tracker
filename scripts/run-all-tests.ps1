<#
.SYNOPSIS
    Run all test suites in the Expense Tracker project (Windows PowerShell).

.DESCRIPTION
    This script runs backend Java tests, Playwright E2E tests (Java and TypeScript),
    and mobile Jest unit tests. Each suite can be run individually or all together.

.PARAMETER Backend
    Run only backend Java tests (JUnit + Mockito + Cucumber BDD).

.PARAMETER PlaywrightJava
    Run only Playwright Java E2E browser tests (29 tests).

.PARAMETER PlaywrightTs
    Run only Playwright TypeScript E2E browser tests (162 tests).

.PARAMETER MobileUnit
    Run only mobile Jest unit tests (60+ tests).

.PARAMETER All
    Run all test suites (default).

.PARAMETER InstallDeps
    Install all dependencies before running tests.

.EXAMPLE
    .\scripts\run-all-tests.ps1
    Run all test suites.

.EXAMPLE
    .\scripts\run-all-tests.ps1 -Backend
    Run only backend Java tests.

.EXAMPLE
    .\scripts\run-all-tests.ps1 -MobileUnit -InstallDeps
    Install dependencies, then run only mobile unit tests.

.EXAMPLE
    .\scripts\run-all-tests.ps1 -PlaywrightTs
    Run only Playwright TypeScript E2E tests.

.NOTES
    Prerequisites:
    - Java 26 (JDK) + Maven (or use .\mvnw.cmd)
    - Node.js 18+ and npm
    - For Playwright: npx playwright install chromium
#>

param(
    [switch]$Backend,
    [switch]$PlaywrightJava,
    [switch]$PlaywrightTs,
    [switch]$MobileUnit,
    [switch]$All = $true,
    [switch]$InstallDeps
)

# If any specific suite is selected, disable "All"
if ($Backend -or $PlaywrightJava -or $PlaywrightTs -or $MobileUnit) {
    $All = $false
}

$totalFail = 0

function Write-Info($msg)    { Write-Host "[INFO]  $msg" -ForegroundColor Blue }
function Write-Pass($msg)    { Write-Host "[PASS]  $msg" -ForegroundColor Green }
function Write-Fail($msg)    { Write-Host "[FAIL]  $msg" -ForegroundColor Red }
function Write-Warn($msg)    { Write-Host "[WARN]  $msg" -ForegroundColor Yellow }

function Test-Command($name) {
    return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function Install-Dependencies {
    Write-Info "Installing dependencies..."

    if (Test-Command "java") {
        Write-Info "  Installing Maven dependencies..."
        & .\mvnw.cmd dependency:resolve -q 2>$null
    }

    if (Test-Command "npm") {
        Write-Info "  Installing e2e/ Playwright dependencies..."
        Push-Location e2e
        npm install 2>$null
        Pop-Location

        Write-Info "  Installing mobile/ Jest dependencies..."
        Push-Location mobile
        npm install 2>$null
        Pop-Location
    }
}

function Run-BackendTests {
    Write-Info "==============================================================="
    Write-Info "  Backend Java Tests (JUnit + Mockito + Cucumber BDD)"
    Write-Info "==============================================================="

    if (-not (Test-Command "java")) {
        Write-Fail "Java not found — skipping backend tests"
        $script:totalFail++
        return
    }

    Write-Info "Running: .\mvnw.cmd test"
    & .\mvnw.cmd test 2>&1 | Select-Object -Last 30
    if ($LASTEXITCODE -eq 0) {
        Write-Pass "Backend tests passed"
    } else {
        Write-Fail "Backend tests failed"
        $script:totalFail++
    }
}

function Run-PlaywrightJavaTests {
    Write-Info "==============================================================="
    Write-Info "  Playwright Java E2E Tests (29 browser tests)"
    Write-Info "==============================================================="

    if (-not (Test-Command "java")) {
        Write-Fail "Java not found — skipping Playwright Java tests"
        $script:totalFail++
        return
    }

    Write-Info "Running: .\mvnw.cmd test -Dtest=PlaywrightE2ETest -Dplaywright=true"
    & .\mvnw.cmd test -Dtest=PlaywrightE2ETest -Dplaywright=true 2>&1 | Select-Object -Last 30
    if ($LASTEXITCODE -eq 0) {
        Write-Pass "Playwright Java E2E tests passed"
    } else {
        Write-Fail "Playwright Java E2E tests failed"
        $script:totalFail++
    }
}

function Run-PlaywrightTsTests {
    Write-Info "==============================================================="
    Write-Info "  Playwright TypeScript E2E Tests (162 browser tests)"
    Write-Info "==============================================================="

    if (-not (Test-Command "npm")) {
        Write-Fail "npm not found — skipping Playwright TypeScript tests"
        $script:totalFail++
        return
    }

    if (-not (Test-Path "e2e\node_modules")) {
        Write-Info "Installing e2e dependencies..."
        Push-Location e2e
        npm install
        Pop-Location
    }

    Write-Info "Ensuring Chromium browser is installed..."
    Push-Location e2e
    npx playwright install chromium
    Write-Info "Running: npm test"
    npm test 2>&1 | Select-Object -Last 30
    Pop-Location

    if ($LASTEXITCODE -eq 0) {
        Write-Pass "Playwright TypeScript E2E tests passed"
    } else {
        Write-Fail "Playwright TypeScript E2E tests failed"
        $script:totalFail++
    }
}

function Run-MobileUnitTests {
    Write-Info "==============================================================="
    Write-Info "  Mobile Jest Unit Tests (60+ tests)"
    Write-Info "==============================================================="

    if (-not (Test-Command "npm")) {
        Write-Fail "npm not found — skipping mobile unit tests"
        $script:totalFail++
        return
    }

    if (-not (Test-Path "mobile\node_modules")) {
        Write-Info "Installing mobile dependencies..."
        Push-Location mobile
        npm install
        Pop-Location
    }

    Push-Location mobile
    Write-Info "Running: npm test"
    npm test 2>&1 | Select-Object -Last 30
    Pop-Location

    if ($LASTEXITCODE -eq 0) {
        Write-Pass "Mobile Jest unit tests passed"
    } else {
        Write-Fail "Mobile Jest unit tests failed"
        $script:totalFail++
    }
}

# ─── Main ───────────────────────────────────────────────────────────────────
Write-Info "Platform: Windows (PowerShell)"

if ($InstallDeps) {
    Install-Dependencies
}

if ($Backend)         { Run-BackendTests }
if ($PlaywrightJava)  { Run-PlaywrightJavaTests }
if ($PlaywrightTs)    { Run-PlaywrightTsTests }
if ($MobileUnit)      { Run-MobileUnitTests }

if ($All) {
    Run-BackendTests
    Run-PlaywrightTsTests
    Run-MobileUnitTests
}

# ─── Summary ────────────────────────────────────────────────────────────────
Write-Info "==============================================================="
if ($totalFail -eq 0) {
    Write-Pass "ALL TEST SUITES PASSED"
} else {
    Write-Fail "$totalFail TEST SUITE(S) FAILED"
}
Write-Info "==============================================================="

exit $totalFail
