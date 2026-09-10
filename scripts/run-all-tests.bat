@echo off
REM
REM run-all-tests.bat - Run all test suites in the Expense Tracker project (Windows)
REM
REM Usage:
REM   scripts\run-all-tests.bat [options]
REM
REM Options:
REM   --backend          Run only backend Java tests (JUnit + Mockito + Cucumber)
REM   --playwright-java  Run only Playwright Java E2E tests (requires browser binary)
REM   --playwright-ts    Run only Playwright TypeScript E2E tests (requires Node.js)
REM   --mobile-unit      Run only mobile Jest unit tests (requires Node.js)
REM   --all              Run backend + mobile-unit + playwright-ts (default)
REM   --install-deps     Install dependencies before running tests
REM   --help             Show this help message
REM
REM Examples:
REM   scripts\run-all-tests.bat                     REM run all tests
REM   scripts\run-all-tests.bat --backend           REM backend only
REM   scripts\run-all-tests.bat --mobile-unit       REM mobile unit tests only
REM   scripts\run-all-tests.bat --install-deps      REM install deps then run all
REM
setlocal enabledelayedexpansion

set TOTAL_FAIL=0
set RUN_BACKEND=1
set RUN_PLAYWRIGHT_JAVA=0
set RUN_PLAYWRIGHT_TS=0
set RUN_MOBILE_UNIT=0
set INSTALL_DEPS=0

REM Parse arguments
:parse_args
if "%~1"=="" goto :done_args
if /i "%~1"=="--backend" (
    set RUN_BACKEND=1
    set RUN_PLAYWRIGHT_JAVA=0
    set RUN_PLAYWRIGHT_TS=0
    set RUN_MOBILE_UNIT=0
    shift
    goto :parse_args
)
if /i "%~1"=="--playwright-java" (
    set RUN_BACKEND=0
    set RUN_PLAYWRIGHT_JAVA=1
    shift
    goto :parse_args
)
if /i "%~1"=="--playwright-ts" (
    set RUN_BACKEND=0
    set RUN_PLAYWRIGHT_TS=1
    shift
    goto :parse_args
)
if /i "%~1"=="--mobile-unit" (
    set RUN_BACKEND=0
    set RUN_MOBILE_UNIT=1
    shift
    goto :parse_args
)
if /i "%~1"=="--all" (
    set RUN_BACKEND=1
    set RUN_PLAYWRIGHT_JAVA=1
    set RUN_PLAYWRIGHT_TS=1
    set RUN_MOBILE_UNIT=1
    shift
    goto :parse_args
)
if /i "%~1"=="--install-deps" (
    set INSTALL_DEPS=1
    shift
    goto :parse_args
)
if /i "%~1"=="--help" goto :show_help
echo [FAIL] Unknown option: %~1
exit /b 1
goto :parse_args

:show_help
echo Usage: scripts\run-all-tests.bat [options]
echo.
echo Options:
echo   --backend          Run only backend Java tests (JUnit + Mockito + Cucumber)
echo   --playwright-java  Run only Playwright Java E2E tests
echo   --playwright-ts    Run only Playwright TypeScript E2E tests
echo   --mobile-unit      Run only mobile Jest unit tests
echo   --all              Run all test suites
echo   --install-deps     Install dependencies before running tests
echo   --help             Show this help message
exit /b 0

:done_args

echo [INFO] Platform: Windows

REM Install dependencies
if "%INSTALL_DEPS%"=="1" (
    echo [INFO] Installing dependencies...
    if exist mvnw.cmd (
        echo [INFO]   Installing Maven dependencies...
        call mvnw.cmd dependency:resolve -q 2>nul
    )
    where npm >nul 2>nul
    if !errorlevel! equ 0 (
        echo [INFO]   Installing e2e dependencies...
        pushd e2e
        call npm install 2>nul
        popd
        echo [INFO]   Installing mobile dependencies...
        pushd mobile
        call npm install 2>nul
        popd
    )
)

REM ─── Backend Java Tests ─────────────────────────────────────────────────
if "%RUN_BACKEND%"=="1" (
    echo.
    echo [INFO] ===============================================================
    echo [INFO]   Backend Java Tests (JUnit + Mockito + Cucumber BDD)
    echo [INFO] ===============================================================

    where java >nul 2>nul
    if !errorlevel! neq 0 (
        echo [FAIL] Java not found - skipping backend tests
        set /a TOTAL_FAIL+=1
    ) else (
        echo [INFO] Running: mvnw.cmd test
        call mvnw.cmd test
        if !errorlevel! equ 0 (
            echo [PASS] Backend tests passed
        ) else (
            echo [FAIL] Backend tests failed
            set /a TOTAL_FAIL+=1
        )
    )
)

REM ─── Playwright Java E2E Tests ──────────────────────────────────────────
if "%RUN_PLAYWRIGHT_JAVA%"=="1" (
    echo.
    echo [INFO] ===============================================================
    echo [INFO]   Playwright Java E2E Tests (29 browser tests)
    echo [INFO] ===============================================================

    echo [INFO] Running: mvnw.cmd test -Dtest=PlaywrightE2ETest -Dplaywright=true
    call mvnw.cmd test -Dtest=PlaywrightE2ETest -Dplaywright=true
    if !errorlevel! equ 0 (
        echo [PASS] Playwright Java E2E tests passed
    ) else (
        echo [FAIL] Playwright Java E2E tests failed
        set /a TOTAL_FAIL+=1
    )
)

REM ─── Playwright TypeScript E2E Tests ────────────────────────────────────
if "%RUN_PLAYWRIGHT_TS%"=="1" (
    echo.
    echo [INFO] ===============================================================
    echo [INFO]   Playwright TypeScript E2E Tests (162 browser tests)
    echo [INFO] ===============================================================

    where npm >nul 2>nul
    if !errorlevel! neq 0 (
        echo [FAIL] npm not found - skipping Playwright TS tests
        set /a TOTAL_FAIL+=1
    ) else (
        if not exist e2e\node_modules (
            echo [INFO] Installing e2e dependencies...
            pushd e2e
            call npm install
            popd
        )
        echo [INFO] Ensuring Chromium is installed...
        pushd e2e
        call npx playwright install chromium
        echo [INFO] Running: npm test
        call npm test
        popd
        if !errorlevel! equ 0 (
            echo [PASS] Playwright TypeScript E2E tests passed
        ) else (
            echo [FAIL] Playwright TypeScript E2E tests failed
            set /a TOTAL_FAIL+=1
        )
    )
)

REM ─── Mobile Jest Unit Tests ─────────────────────────────────────────────
if "%RUN_MOBILE_UNIT%"=="1" (
    echo.
    echo [INFO] ===============================================================
    echo [INFO]   Mobile Jest Unit Tests (60+ tests)
    echo [INFO] ===============================================================

    where npm >nul 2>nul
    if !errorlevel! neq 0 (
        echo [FAIL] npm not found - skipping mobile unit tests
        set /a TOTAL_FAIL+=1
    ) else (
        if not exist mobile\node_modules (
            echo [INFO] Installing mobile dependencies...
            pushd mobile
            call npm install
            popd
        )
        pushd mobile
        echo [INFO] Running: npm test
        call npm test
        popd
        if !errorlevel! equ 0 (
            echo [PASS] Mobile Jest unit tests passed
        ) else (
            echo [FAIL] Mobile Jest unit tests failed
            set /a TOTAL_FAIL+=1
        )
    )
)

REM ─── Summary ────────────────────────────────────────────────────────────
echo.
echo [INFO] ===============================================================
if !TOTAL_FAIL! equ 0 (
    echo [PASS]  ALL TEST SUITES PASSED
) else (
    echo [FAIL]  !TOTAL_FAIL! TEST SUITE(S) FAILED
)
echo [INFO] ===============================================================

exit /b !TOTAL_FAIL!
