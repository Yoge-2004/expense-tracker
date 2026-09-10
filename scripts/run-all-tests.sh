#!/usr/bin/env bash
#
# run-all-tests.sh — Run all test suites in the Expense Tracker project.
#
# Usage:
#   ./scripts/run-all-tests.sh [options]
#
# Options:
#   --backend          Run only backend Java tests (JUnit + Mockito + Cucumber)
#   --playwright-java  Run only Playwright Java E2E tests (requires browser binary)
#   --playwright-ts    Run only Playwright TypeScript E2E tests (requires Node.js)
#   --mobile-unit      Run only mobile Jest unit tests (requires Node.js)
#   --mobile-e2e       Run only mobile Detox E2E tests (requires simulator/emulator)
#   --all              Run all test suites (default)
#   --install-deps     Install dependencies before running tests
#   --help, -h         Show this help message
#
# Examples:
#   ./scripts/run-all-tests.sh                    # run all tests
#   ./scripts/run-all-tests.sh --backend          # backend only
#   ./scripts/run-all-tests.sh --mobile-unit      # mobile unit tests only
#   ./scripts/run-all-tests.sh --install-deps     # install deps then run all
#
# Prerequisites:
#   - Java 26 (JDK) + Maven (or use ./mvnw)
#   - Node.js 18+ and npm
#   - For Playwright: npx playwright install chromium
#   - For mobile E2E: detox-cli + iOS simulator or Android emulator
#
set -euo pipefail

# ─── Colors ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[PASS]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail()    { echo -e "${RED}[FAIL]${NC}  $*"; }

# ─── Defaults ───────────────────────────────────────────────────────────────
RUN_BACKEND=true
RUN_PLAYWRIGHT_JAVA=false
RUN_PLAYWRIGHT_TS=false
RUN_MOBILE_UNIT=false
RUN_MOBILE_E2E=false
INSTALL_DEPS=false
TOTAL_FAIL=0

# ─── Parse Arguments ────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --backend)          RUN_BACKEND=true; RUN_PLAYWRIGHT_JAVA=false; RUN_PLAYWRIGHT_TS=false; RUN_MOBILE_UNIT=false; RUN_MOBILE_E2E=false; shift ;;
        --playwright-java)  RUN_BACKEND=false; RUN_PLAYWRIGHT_JAVA=true; shift ;;
        --playwright-ts)    RUN_BACKEND=false; RUN_PLAYWRIGHT_TS=true; shift ;;
        --mobile-unit)      RUN_BACKEND=false; RUN_MOBILE_UNIT=true; shift ;;
        --mobile-e2e)       RUN_BACKEND=false; RUN_MOBILE_E2E=true; shift ;;
        --all)              RUN_BACKEND=true; RUN_PLAYWRIGHT_JAVA=true; RUN_PLAYWRIGHT_TS=true; RUN_MOBILE_UNIT=true; RUN_MOBILE_E2E=false; shift ;;
        --install-deps)     INSTALL_DEPS=true; shift ;;
        --help|-h)
            head -35 "$0" | tail -33
            exit 0
            ;;
        *)
            fail "Unknown option: $1"
            exit 1
            ;;
    esac
done

# ─── Detect Platform ────────────────────────────────────────────────────────
PLATFORM=$(uname -s)
case "$PLATFORM" in
    Darwin*) PLATFORM="macOS" ;;
    Linux*)  PLATFORM="Linux" ;;
    MINGW*|MSYS*|CYGWIN*|Windows_NT) PLATFORM="Windows" ;;
esac
info "Detected platform: $PLATFORM"

# ─── Check Prerequisites ────────────────────────────────────────────────────
check_prereq() {
    if ! command -v "$1" &>/dev/null; then
        warn "$1 not found — skipping related tests"
        return 1
    fi
    return 0
}

# ─── Install Dependencies ──────────────────────────────────────────────────
if [[ "$INSTALL_DEPS" == true ]]; then
    info "Installing dependencies..."
    if check_prereq java; then
        info "  Installing Maven dependencies..."
        ./mvnw dependency:resolve -q || warn "Maven dependency install failed (may need network)"
    fi
    if check_prereq npm; then
        info "  Installing e2e/ Playwright dependencies..."
        (cd e2e && npm install) || warn "e2e npm install failed"
        info "  Installing mobile/ Jest dependencies..."
        (cd mobile && npm install) || warn "mobile npm install failed"
    fi
fi

# ─── Backend Java Tests ─────────────────────────────────────────────────────
run_backend() {
    echo ""
    info "═══════════════════════════════════════════════════════════════"
    info "  Backend Java Tests (JUnit + Mockito + Cucumber BDD)"
    info "═══════════════════════════════════════════════════════════════"

    if ! check_prereq java; then
        fail "Java not installed — skipping backend tests"
        TOTAL_FAIL=$((TOTAL_FAIL + 1))
        return
    fi

    info "Running: ./mvnw test"
    if ./mvnw test 2>&1 | tail -30; then
        success "Backend tests passed ✓"
    else
        fail "Backend tests failed ✗"
        TOTAL_FAIL=$((TOTAL_FAIL + 1))
    fi
}

# ─── Playwright Java E2E Tests ──────────────────────────────────────────────
run_playwright_java() {
    echo ""
    info "═══════════════════════════════════════════════════════════════"
    info "  Playwright Java E2E Tests (29 browser tests)"
    info "═══════════════════════════════════════════════════════════════"

    if ! check_prereq java; then
        fail "Java not installed — skipping Playwright Java tests"
        TOTAL_FAIL=$((TOTAL_FAIL + 1))
        return
    fi

    info "These tests require a Playwright browser binary."
    info "If this is your first run, the binary will be downloaded automatically."

    info "Running: ./mvnw test -Dtest=PlaywrightE2ETest -Dplaywright=true"
    if ./mvnw test -Dtest=PlaywrightE2ETest -Dplaywright=true 2>&1 | tail -30; then
        success "Playwright Java E2E tests passed ✓"
    else
        fail "Playwright Java E2E tests failed ✗"
        TOTAL_FAIL=$((TOTAL_FAIL + 1))
    fi
}

# ─── Playwright TypeScript E2E Tests ────────────────────────────────────────
run_playwright_ts() {
    echo ""
    info "═══════════════════════════════════════════════════════════════"
    info "  Playwright TypeScript E2E Tests (162 browser tests)"
    info "═══════════════════════════════════════════════════════════════"

    if ! check_prereq npm; then
        fail "npm not installed — skipping Playwright TypeScript tests"
        TOTAL_FAIL=$((TOTAL_FAIL + 1))
        return
    fi

    if [[ ! -d e2e/node_modules ]]; then
        info "Installing e2e dependencies..."
        (cd e2e && npm install) || { fail "npm install failed"; TOTAL_FAIL=$((TOTAL_FAIL + 1)); return; }
    fi

    info "Ensuring Chromium browser is installed..."
    (cd e2e && npx playwright install chromium) || warn "Playwright browser install failed"

    info "Running: cd e2e && npm test"
    if (cd e2e && npm test) 2>&1 | tail -30; then
        success "Playwright TypeScript E2E tests passed ✓"
    else
        fail "Playwright TypeScript E2E tests failed ✗"
        TOTAL_FAIL=$((TOTAL_FAIL + 1))
    fi
}

# ─── Mobile Jest Unit Tests ─────────────────────────────────────────────────
run_mobile_unit() {
    echo ""
    info "═══════════════════════════════════════════════════════════════"
    info "  Mobile Jest Unit Tests (60+ tests)"
    info "═══════════════════════════════════════════════════════════════"

    if ! check_prereq npm; then
        fail "npm not installed — skipping mobile unit tests"
        TOTAL_FAIL=$((TOTAL_FAIL + 1))
        return
    fi

    if [[ ! -d mobile/node_modules ]]; then
        info "Installing mobile dependencies..."
        (cd mobile && npm install) || { fail "npm install failed"; TOTAL_FAIL=$((TOTAL_FAIL + 1)); return; }
    fi

    info "Running: cd mobile && npm test"
    if (cd mobile && npm test) 2>&1 | tail -30; then
        success "Mobile Jest unit tests passed ✓"
    else
        fail "Mobile Jest unit tests failed ✗"
        TOTAL_FAIL=$((TOTAL_FAIL + 1))
    fi
}

# ─── Mobile Detox E2E Tests ─────────────────────────────────────────────────
run_mobile_e2e() {
    echo ""
    info "═══════════════════════════════════════════════════════════════"
    info "  Mobile Detox E2E Tests (20+ tests)"
    info "═══════════════════════════════════════════════════════════════"

    if [[ "$PLATFORM" == "macOS" ]]; then
        info "Platform: macOS — using iOS simulator"
        CONFIG="ios.sim.debug"
    elif [[ "$PLATFORM" == "Linux" ]]; then
        info "Platform: Linux — using Android emulator"
        CONFIG="android.emu.debug"
    else
        warn "Detox E2E tests are best run on macOS (iOS) or Linux (Android). Skipping on $PLATFORM"
        return
    fi

    if ! command -v detox &>/dev/null; then
        warn "detox-cli not found. Install with: npm install -g detox-cli"
        warn "Skipping mobile E2E tests"
        TOTAL_FAIL=$((TOTAL_FAIL + 1))
        return
    fi

    if [[ ! -d mobile/node_modules ]]; then
        info "Installing mobile dependencies..."
        (cd mobile && npm install) || { fail "npm install failed"; TOTAL_FAIL=$((TOTAL_FAIL + 1)); return; }
    fi

    info "Building app for $CONFIG..."
    (cd mobile && detox build -c "$CONFIG") || { fail "detox build failed"; TOTAL_FAIL=$((TOTAL_FAIL + 1)); return; }

    info "Running: cd mobile && detox test -c $CONFIG"
    if (cd mobile && detox test -c "$CONFIG") 2>&1 | tail -30; then
        success "Mobile Detox E2E tests passed ✓"
    else
        fail "Mobile Detox E2E tests failed ✗"
        TOTAL_FAIL=$((TOTAL_FAIL + 1))
    fi
}

# ─── Run Selected Suites ────────────────────────────────────────────────────
if [[ "$RUN_BACKEND" == true ]]; then         run_backend; fi
if [[ "$RUN_PLAYWRIGHT_JAVA" == true ]]; then run_playwright_java; fi
if [[ "$RUN_PLAYWRIGHT_TS" == true ]]; then   run_playwright_ts; fi
if [[ "$RUN_MOBILE_UNIT" == true ]]; then     run_mobile_unit; fi
if [[ "$RUN_MOBILE_E2E" == true ]]; then      run_mobile_e2e; fi

# ─── Summary ────────────────────────────────────────────────────────────────
echo ""
info "═══════════════════════════════════════════════════════════════"
if [[ $TOTAL_FAIL -eq 0 ]]; then
    success "  ALL TEST SUITES PASSED ✓"
else
    fail "  $TOTAL_FAIL TEST SUITE(S) FAILED ✗"
fi
info "═══════════════════════════════════════════════════════════════"

exit $TOTAL_FAIL
