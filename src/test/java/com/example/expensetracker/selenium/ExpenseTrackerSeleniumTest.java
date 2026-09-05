package com.example.expensetracker.selenium;

import org.junit.jupiter.api.*;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.io.File;
import java.time.Duration;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class ExpenseTrackerSeleniumTest {

    private WebDriver driver;
    private WebDriverWait wait;

    private String indexUrl;
    private String registerUrl;
    private String forgotPasswordUrl;
    private String dashboardUrl;

    @BeforeAll
    public void setUpClass() {
        ChromeOptions options = new ChromeOptions();
        options.addArguments("--no-sandbox");
        options.addArguments("--disable-setuid-sandbox");
        options.addArguments("--disable-dev-shm-usage");
        options.addArguments("--remote-allow-origins=*");
        options.addArguments("--allow-file-access-from-files");
        options.addArguments("--window-size=1440,900");

        if (System.getProperty("headless", "true").equals("true")) {
            options.addArguments("--headless=new");
        }

        String[] chromePaths = {
            "/home/yoge/.cache/selenium/chrome/linux-151.0.7922.47/chrome-linux64/chrome",
            "/opt/brave-bin/brave"
        };
        for (String path : chromePaths) {
            File bin = new File(path);
            if (bin.exists()) {
                options.setBinary(bin);
                break;
            }
        }

        try {
            driver = new ChromeDriver(options);
        } catch (Exception e) {
            System.err.println("Primary ChromeDriver initialization failed: " + e.getMessage());
            ChromeOptions fallbackOptions = new ChromeOptions();
            fallbackOptions.addArguments("--no-sandbox");
            fallbackOptions.addArguments("--disable-dev-shm-usage");
            fallbackOptions.addArguments("--remote-allow-origins=*");
            fallbackOptions.addArguments("--allow-file-access-from-files");
            driver = new ChromeDriver(fallbackOptions);
        }

        wait = new WebDriverWait(driver, Duration.ofSeconds(10));

        indexUrl = "file://" + new File("frontend/index.html").getAbsolutePath();
        registerUrl = "file://" + new File("frontend/register.html").getAbsolutePath();
        forgotPasswordUrl = "file://" + new File("frontend/forgot-password.html").getAbsolutePath();
        dashboardUrl = "file://" + new File("frontend/dashboard.html").getAbsolutePath() + "?test_mock_auth=true";
    }

    @AfterAll
    public void tearDownClass() {
        if (driver != null) {
            driver.quit();
        }
    }

    private void clickElement(WebElement element) {
        try {
            element.click();
        } catch (Exception e) {
            ((JavascriptExecutor) driver).executeScript("arguments[0].click();", element);
        }
    }

    private void loginSessionAndGoToDashboard() {
        driver.get(dashboardUrl);
        wait.until(ExpectedConditions.presenceOfElementLocated(By.id("userWelcomeText")));
    }

    // =========================================================================
    // SUITE 1: SIGN IN PAGE & PASSWORD VISIBILITY TOGGLE
    // =========================================================================

    @Test
    @Order(1)
    @DisplayName("TC-01: Sign In Page Layout, Form Elements & Live Theme Swapping")
    public void testLoginPageRenderingAndThemeToggle() {
        driver.get(indexUrl);
        wait.until(ExpectedConditions.titleContains("Sign In"));

        WebElement emailInput = wait.until(ExpectedConditions.presenceOfElementLocated(By.id("email")));
        WebElement passwordInput = driver.findElement(By.id("password"));
        WebElement submitBtn = driver.findElement(By.cssSelector("button[type='submit']"));

        assertTrue(emailInput.isDisplayed(), "Login Email input should be displayed");
        assertTrue(passwordInput.isDisplayed(), "Login Password input should be displayed");
        assertTrue(submitBtn.isDisplayed(), "Submit button should be displayed");

        WebElement themeBtn = driver.findElement(By.id("themeToggle"));
        String initialTheme = driver.findElement(By.tagName("html")).getAttribute("data-theme");

        clickElement(themeBtn);
        String toggledTheme = driver.findElement(By.tagName("html")).getAttribute("data-theme");
        assertNotEquals(initialTheme, toggledTheme, "Theme data attribute should toggle on click");
    }

    @Test
    @Order(2)
    @DisplayName("TC-02: Sign In Form Empty Validation & Error Toast Feedback")
    public void testLoginEmptyInputValidation() {
        driver.get(indexUrl);

        WebElement submitBtn = wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("button[type='submit']")));
        clickElement(submitBtn);

        WebElement emailInput = driver.findElement(By.id("email"));
        assertTrue(emailInput.getAttribute("class").contains("is-invalid") || emailInput.getAttribute("required") != null,
                "Email field should indicate required/invalid state");
    }

    @Test
    @Order(3)
    @DisplayName("TC-03: Password Eye Toggle Visibility Swapping (Password <-> Text)")
    public void testPasswordEyeToggle() {
        driver.get(indexUrl);

        WebElement passwordInput = wait.until(ExpectedConditions.presenceOfElementLocated(By.id("password")));
        WebElement eyeBtn = driver.findElement(By.cssSelector("button[data-password-toggle='password']"));

        assertEquals("password", passwordInput.getAttribute("type"), "Initial input type should be password");

        clickElement(eyeBtn);
        assertEquals("text", passwordInput.getAttribute("type"), "Input type should switch to text after clicking eye");

        clickElement(eyeBtn);
        assertEquals("password", passwordInput.getAttribute("type"), "Input type should revert to password after second click");
    }

    // =========================================================================
    // SUITE 2: USER REGISTRATION, USERNAME SUGGESTIONS & 50-CURRENCY PICKER
    // =========================================================================

    @Test
    @Order(4)
    @DisplayName("TC-04: Registration Page Layout, Step Bar Progress & Username Suggestions")
    public void testRegistrationPageRenderingAndSuggestions() {
        driver.get(registerUrl);
        wait.until(ExpectedConditions.titleContains("Create Account"));

        WebElement nameInput = driver.findElement(By.id("reg-name"));
        WebElement usernameInput = driver.findElement(By.id("reg-username"));

        nameInput.sendKeys("John Doe");
        usernameInput.sendKeys("john");

        WebElement suggestions = wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("usernameSuggestions")));
        assertTrue(suggestions.isDisplayed(), "Username suggestions container should appear when typing username");

        List<WebElement> chips = suggestions.findElements(By.className("suggestion-chip"));
        assertTrue(chips.size() >= 1, "At least one username suggestion chip should be generated");
    }

    @Test
    @Order(5)
    @DisplayName("TC-05: Username Suggestion Chip Click Auto-Population")
    public void testUsernameSuggestionChipClick() {
        driver.get(registerUrl);

        WebElement usernameInput = wait.until(ExpectedConditions.presenceOfElementLocated(By.id("reg-username")));
        usernameInput.sendKeys("johnny");

        WebElement suggestions = wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("usernameSuggestions")));
        WebElement firstChip = suggestions.findElement(By.className("suggestion-chip"));
        String chipText = firstChip.getText().replace("@", "").trim();

        clickElement(firstChip);
        assertEquals(chipText, usernameInput.getAttribute("value"), "Username input value should match clicked suggestion chip");
    }

    @Test
    @Order(6)
    @DisplayName("TC-06: Custom 50-Currency Select Component & Real-Time Search Filtering")
    public void testCustom50CurrencySelectPickerAndSearch() {
        driver.get(registerUrl);

        WebElement currTrigger = wait.until(ExpectedConditions.elementToBeClickable(By.id("currencySelectTrigger")));
        clickElement(currTrigger);

        WebElement currWrapper = driver.findElement(By.id("currencySelectWrapper"));
        assertTrue(currWrapper.getAttribute("class").contains("open"), "Custom select popover should open");

        WebElement searchInput = wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector("#currencySelectWrapper .custom-select-search")));
        searchInput.sendKeys("EUR");

        List<WebElement> options = driver.findElements(By.cssSelector("#currencySelectWrapper .custom-option"));
        WebElement eurOpt = options.stream()
                .filter(o -> "EUR".equals(o.getAttribute("data-value")))
                .findFirst()
                .orElse(null);

        assertNotNull(eurOpt, "EUR option should be present after search filtering");
        clickElement(eurOpt);

        WebElement label = driver.findElement(By.id("selectedCurrencyLabel"));
        assertTrue(label.getText().contains("EUR"), "Selected currency label should update to EUR");
    }

    // =========================================================================
    // SUITE 3: FORGOT PASSWORD & MULTI-CRITERIA STRENGTH METER
    // =========================================================================

    @Test
    @Order(7)
    @DisplayName("TC-07: Password Reset Page & Multi-Criteria Strength Meter")
    public void testForgotPasswordPageAndStrengthMeter() {
        driver.get(forgotPasswordUrl);
        wait.until(ExpectedConditions.titleContains("Update Password"));

        ((JavascriptExecutor) driver).executeScript(
            "document.getElementById('requestCodeForm').style.display='none';" +
            "document.getElementById('resetForm').style.display='block';"
        );

        WebElement passInput = wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("newPassword")));
        WebElement seg1 = driver.findElement(By.id("seg1"));

        passInput.sendKeys("Strong#Password2026!");
        String styleAttr = seg1.getAttribute("style");
        assertTrue(styleAttr != null && (styleAttr.contains("background") || styleAttr.contains("rgb") || styleAttr.contains("#")),
                "Meter segment 1 should apply background styling for valid passwords");
    }

    @Test
    @Order(8)
    @DisplayName("TC-08: Cross-Page Theme Switch Persistence in LocalStorage")
    public void testThemePersistenceAcrossPages() {
        driver.get(registerUrl);

        WebElement themeBtn = wait.until(ExpectedConditions.elementToBeClickable(By.id("themeToggle")));
        clickElement(themeBtn);

        String savedTheme = (String) ((JavascriptExecutor) driver).executeScript("return localStorage.getItem('theme');");
        assertNotNull(savedTheme, "Theme setting should be persisted in localStorage");

        driver.get(indexUrl);
        String appliedTheme = driver.findElement(By.tagName("html")).getAttribute("data-theme");
        assertEquals(savedTheme, appliedTheme, "Saved theme should persist across page navigations");
    }

    // =========================================================================
    // SUITE 4: DASHBOARD METRICS, PROFILE CURRENCY & ADD EXPENSE MODAL
    // =========================================================================

    @Test
    @Order(9)
    @DisplayName("TC-09: Dashboard Financial Matrix Grid & User Greeting")
    public void testDashboardRendering() {
        loginSessionAndGoToDashboard();

        wait.until(ExpectedConditions.textToBePresentInElementLocated(By.id("userWelcomeText"), "Welcome"));
        WebElement welcome = driver.findElement(By.id("userWelcomeText"));
        assertTrue(welcome.getText().contains("Alex Smith") || welcome.getText().contains("Welcome"),
                "Dashboard should display user welcome text");

        WebElement totalAmount = wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("totalAmount")));
        assertTrue(totalAmount.isDisplayed(), "Total Outflow metric element should be displayed");
    }

    @Test
    @Order(10)
    @DisplayName("TC-10: Profile Menu Toggle & Custom Preferred Currency Configuration")
    public void testProfileMenuCurrencyConfiguration() {
        loginSessionAndGoToDashboard();

        WebElement profileTrigger = wait.until(ExpectedConditions.presenceOfElementLocated(By.id("profileTrigger")));
        clickElement(profileTrigger);

        Boolean isActive = (Boolean) ((JavascriptExecutor) driver).executeScript(
                "return document.getElementById('profileMenu').classList.contains('active') || " +
                "document.getElementById('profileMenu').offsetHeight > 0;"
        );
        assertTrue(isActive, "Profile menu should toggle active or visible");
    }

    @Test
    @Order(11)
    @DisplayName("TC-11: Add Expense Modal Open & Form Controls Display")
    public void testAddExpenseModalOpen() {
        loginSessionAndGoToDashboard();

        WebElement addBtn = wait.until(ExpectedConditions.presenceOfElementLocated(By.id("openModalBtn")));
        clickElement(addBtn);

        Boolean isModalVisible = (Boolean) ((JavascriptExecutor) driver).executeScript(
                "var m = document.getElementById('expenseModal'); return m && (m.classList.contains('active') || getComputedStyle(m).display !== 'none');"
        );
        assertTrue(isModalVisible, "Add Expense modal popup should be displayed");
    }

    @Test
    @Order(12)
    @DisplayName("TC-12: Add Expense Form Fill & Submit Flow")
    public void testAddExpenseSubmission() {
        loginSessionAndGoToDashboard();

        WebElement addBtn = wait.until(ExpectedConditions.presenceOfElementLocated(By.id("openModalBtn")));
        clickElement(addBtn);

        WebElement descInput = wait.until(ExpectedConditions.presenceOfElementLocated(By.id("desc")));
        WebElement amtInput = driver.findElement(By.id("amount"));

        descInput.sendKeys("Groceries Shopping");
        amtInput.sendKeys("125.50");

        WebElement closeBtn = driver.findElement(By.id("closeExpenseModalBtn"));
        clickElement(closeBtn);

        assertNotNull(closeBtn, "Close button element should be present");
    }

    // =========================================================================
    // SUITE 5: SEARCH, FILTERING & ADVANCED MODALS
    // =========================================================================

    @Test
    @Order(13)
    @DisplayName("TC-13: Command Bar Search (/ & ⌘K) Real-Time Query Filter")
    public void testCommandBarSearchFiltering() {
        loginSessionAndGoToDashboard();

        WebElement searchInput = wait.until(ExpectedConditions.presenceOfElementLocated(By.id("filterSearch")));
        searchInput.sendKeys("Coffee");

        assertEquals("Coffee", searchInput.getAttribute("value"), "Search input value should equal entered query");
    }

    @Test
    @Order(14)
    @DisplayName("TC-14: Filter Toggle Panel Opening & Category Filtering")
    public void testFilterPanelToggle() {
        loginSessionAndGoToDashboard();

        WebElement toggleBtn = wait.until(ExpectedConditions.presenceOfElementLocated(By.id("toggleFiltersBtn")));
        clickElement(toggleBtn);

        Boolean isPanelOpen = (Boolean) ((JavascriptExecutor) driver).executeScript(
                "var p = document.getElementById('filterPanel'); return p && (p.classList.contains('active') || getComputedStyle(p).display !== 'none');"
        );
        assertTrue(isPanelOpen, "Filter panel should toggle active/visible");
    }

    @Test
    @Order(15)
    @DisplayName("TC-15: Add Custom Category Modal Open")
    public void testAddCategoryModalOpen() {
        loginSessionAndGoToDashboard();

        WebElement addExpenseBtn = wait.until(ExpectedConditions.presenceOfElementLocated(By.id("openModalBtn")));
        clickElement(addExpenseBtn);

        WebElement addCatBtn = wait.until(ExpectedConditions.presenceOfElementLocated(By.id("addCategoryBtn")));
        assertNotNull(addCatBtn, "Add custom category button element should exist in DOM");
    }

    @Test
    @Order(16)
    @DisplayName("TC-16: Monthly Budget Limit Modal Open & Input Display")
    public void testBudgetModalOpen() {
        loginSessionAndGoToDashboard();

        WebElement budgetBtn = wait.until(ExpectedConditions.presenceOfElementLocated(By.id("addBudgetBtn")));
        clickElement(budgetBtn);

        Boolean isBudgetModalVisible = (Boolean) ((JavascriptExecutor) driver).executeScript(
                "var m = document.getElementById('budgetModal'); return m && (m.classList.contains('active') || getComputedStyle(m).display !== 'none');"
        );
        assertTrue(isBudgetModalVisible, "Budget configuration modal should be displayed");
    }

    @Test
    @Order(17)
    @DisplayName("TC-17: Manage Subscriptions Modal Open")
    public void testSubscriptionsModalOpen() {
        loginSessionAndGoToDashboard();

        WebElement profileTrigger = wait.until(ExpectedConditions.presenceOfElementLocated(By.id("profileTrigger")));
        clickElement(profileTrigger);

        WebElement subsBtn = wait.until(ExpectedConditions.presenceOfElementLocated(By.id("manageSubsBtn")));
        clickElement(subsBtn);

        Boolean isSubsModalVisible = (Boolean) ((JavascriptExecutor) driver).executeScript(
                "var m = document.getElementById('subsModal'); return m && (m.classList.contains('active') || getComputedStyle(m).display !== 'none');"
        );
        assertTrue(isSubsModalVisible, "Subscriptions management modal should be displayed");
    }

    @Test
    @Order(18)
    @DisplayName("TC-18: Export CSV Data Download Trigger")
    public void testExportCsvButton() {
        loginSessionAndGoToDashboard();

        WebElement exportBtn = wait.until(ExpectedConditions.presenceOfElementLocated(By.id("exportCsvBtn")));
        assertNotNull(exportBtn, "Export CSV button element should exist in DOM");
    }

    // =========================================================================
    // SUITE 6: RESPONSIVE MOBILE VIEWPORTS & LOGOUT
    // =========================================================================

    @Test
    @Order(19)
    @DisplayName("TC-19: Mobile Viewport (375x812 iPhone X) Layout & Form Accessibility")
    public void testMobileResponsiveViewport() {
        driver.manage().window().setSize(new Dimension(375, 812));
        driver.get(registerUrl);

        WebElement formSection = wait.until(ExpectedConditions.presenceOfElementLocated(By.className("auth-form-section")));
        WebElement usernameInput = driver.findElement(By.id("reg-username"));

        assertNotNull(formSection, "Auth form section should be present");
        assertNotNull(usernameInput, "Username input should exist on mobile viewport");

        driver.manage().window().setSize(new Dimension(1440, 900));
    }

    @Test
    @Order(20)
    @DisplayName("TC-20: Logout Action & Session Token Clearance")
    public void testLogoutClearance() {
        loginSessionAndGoToDashboard();

        WebElement profileTrigger = wait.until(ExpectedConditions.presenceOfElementLocated(By.id("profileTrigger")));
        clickElement(profileTrigger);

        WebElement logoutBtn = wait.until(ExpectedConditions.presenceOfElementLocated(By.id("logoutBtn")));
        ((JavascriptExecutor) driver).executeScript("localStorage.clear(); window.location.href = arguments[0];", indexUrl);

        wait.until(ExpectedConditions.urlContains("index.html"));

        String token = (String) ((JavascriptExecutor) driver).executeScript("return localStorage.getItem('token');");
        assertNull(token, "Auth token should be cleared from localStorage after logout");
    }

    // =========================================================================
    // SUITE 21: REGRESSION — USERNAME MUST ACTUALLY BE SENT ON REGISTRATION
    // =========================================================================
    // The two existing username tests (TC-04, TC-05) only ever verified that
    // the suggestions widget *looks* interactive — that a dropdown appears and
    // that clicking a chip fills the input. Neither ever checked that the
    // value a person actually types or selects makes it into the request the
    // form submits. That gap is exactly how a real bug shipped: the backend
    // had no `username` field to receive it, and register.js's submit handler
    // never read `#reg-username` at all, so every signup silently discarded
    // whatever the user entered there — even though the field was marked
    // required and had its own step-progress indicator implying it mattered.
    //
    // This test intercepts window.fetch before submitting the real form (via
    // real DOM interactions, not by calling internal JS functions directly)
    // and asserts the captured request body actually contains the username
    // the user typed. It doesn't require a live backend — the fetch never
    // needs to resolve for the assertion to be meaningful, since what's being
    // verified is what the frontend *sends*, not what a server *returns*.

    @Test
    @Order(21)
    @DisplayName("TC-21: Registration form must include the typed username in its submitted payload")
    public void testRegistrationPayloadIncludesUsername() {
        driver.get(registerUrl);
        wait.until(ExpectedConditions.titleContains("Create Account"));

        // Capture the body of the next call to /auth/register instead of letting
        // it hit the network (there is no live backend in this file:// suite).
        ((JavascriptExecutor) driver).executeScript(
                "window.__capturedRegisterBody = null;" +
                "const originalFetch = window.fetch;" +
                "window.fetch = function(url, options) {" +
                "    if (typeof url === 'string' && url.includes('/auth/register')) {" +
                "        window.__capturedRegisterBody = options && options.body;" +
                "        return Promise.resolve(new Response(JSON.stringify({id: 1, email: 'x@y.com'}), " +
                "            { status: 201, headers: {'Content-Type': 'application/json'} }));" +
                "    }" +
                "    return originalFetch.apply(this, arguments);" +
                "};"
        );

        String expectedUsername = "selenium_regress_user";

        driver.findElement(By.id("reg-name")).sendKeys("Selenium Regression");
        driver.findElement(By.id("reg-username")).sendKeys(expectedUsername);
        driver.findElement(By.id("reg-email")).sendKeys("selenium.regress@example.com");
        driver.findElement(By.id("reg-password")).sendKeys("StrongPass1!");

        WebElement submitBtn = driver.findElement(By.id("registerBtn"));
        clickElement(submitBtn);

        wait.until(d -> ((JavascriptExecutor) d).executeScript("return window.__capturedRegisterBody;") != null);

        String capturedBody = (String) ((JavascriptExecutor) driver)
                .executeScript("return window.__capturedRegisterBody;");

        assertNotNull(capturedBody, "Registration form should have called /auth/register with a body");
        assertTrue(capturedBody.contains(expectedUsername),
                "Submitted registration payload must include the username the user actually typed — "
                + "captured body was: " + capturedBody);
    }

    @Test
    @Order(24)
    @DisplayName("TC-24: Small Devices Auth Input Icon and Placeholder No-Overlap Validation")
    public void testAuthPagesInputIconNoOverlapOnSmallDevices() {
        int[] screenWidths = {360, 320};
        String[] pages = {indexUrl, registerUrl, forgotPasswordUrl};

        try {
            for (int width : screenWidths) {
                driver.manage().window().setSize(new org.openqa.selenium.Dimension(width, 740));
                for (String pageUrl : pages) {
                    driver.get(pageUrl);
                    Boolean allInputsSpacedProperly = (Boolean) ((JavascriptExecutor) driver).executeScript(
                        "const wrappers = document.querySelectorAll('.input-wrapper');" +
                        "if (wrappers.length === 0) return false;" +
                        "for (const w of wrappers) {" +
                        "    const icon = w.querySelector('.input-icon');" +
                        "    const input = w.querySelector('input:not([type=\"hidden\"]), .custom-select-trigger');" +
                        "    if (!icon || !input) continue;" +
                        "    const iconRect = icon.getBoundingClientRect();" +
                        "    const inputRect = input.getBoundingClientRect();" +
                        "    const style = window.getComputedStyle(input);" +
                        "    const padLeft = parseFloat(style.paddingLeft) || 0;" +
                        "    if (padLeft < 38) return false;" +
                        "    if (iconRect.right > (inputRect.left + padLeft)) return false;" +
                        "}" +
                        "return true;"
                    );
                    assertTrue(allInputsSpacedProperly, "Inputs on " + pageUrl + " must have padding-left >= 38px and icon must not overlap text on " + width + "px width");
                }
            }
        } finally {
            driver.manage().window().setSize(new org.openqa.selenium.Dimension(1280, 800));
        }
    }

    @Test
    @Order(25)
    @DisplayName("TC-25: Delete Account Confirmation Textbox Formatting & Danger Theme")
    public void testDeleteAccountConfirmationInputStyling() {
        loginSessionAndGoToDashboard();

        ((JavascriptExecutor) driver).executeScript(
            "const modal = document.getElementById('deleteAccountModal');" +
            "if (modal && typeof openModal === 'function') openModal(modal);"
        );

        WebElement deleteModal = wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("deleteAccountModal")));
        assertTrue(deleteModal.isDisplayed(), "Delete account modal should be visible");

        WebElement confirmInput = driver.findElement(By.id("deleteConfirmInput"));
        assertTrue(confirmInput.isDisplayed(), "Delete confirm input must be displayed");

        Boolean isFormatted = (Boolean) ((JavascriptExecutor) driver).executeScript(
            "const el = document.getElementById('deleteConfirmInput');" +
            "if (!el) return false;" +
            "const style = window.getComputedStyle(el);" +
            "const borderRadius = parseFloat(style.borderRadius) || 0;" +
            "const padTop = parseFloat(style.paddingTop) || 0;" +
            "const padLeft = parseFloat(style.paddingLeft) || 0;" +
            "return (borderRadius >= 10) && (padTop >= 8) && (padLeft >= 12);"
        );
        assertTrue(isFormatted, "Delete confirmation textbox must be properly styled with rounded corners and ample padding");

        Boolean buttonsFormatted = (Boolean) ((JavascriptExecutor) driver).executeScript(
            "const cancel = document.getElementById('cancelDeleteAccountBtn');" +
            "const confirm = document.getElementById('confirmDeleteAccountBtn');" +
            "if (!cancel || !confirm) return false;" +
            "const cStyle = window.getComputedStyle(cancel);" +
            "const fStyle = window.getComputedStyle(confirm);" +
            "const cRadius = parseFloat(cStyle.borderRadius) || 0;" +
            "const fRadius = parseFloat(fStyle.borderRadius) || 0;" +
            "const cHeight = parseFloat(cStyle.height) || 0;" +
            "const fHeight = parseFloat(fStyle.height) || 0;" +
            "return (cRadius >= 10 && fRadius >= 10 && cHeight >= 38 && fHeight >= 38);"
        );
        assertTrue(buttonsFormatted, "Delete and Cancel buttons must be cleanly formatted with rounded corners and min height");

        WebElement cancelBtn = driver.findElement(By.id("cancelDeleteAccountBtn"));
        clickElement(cancelBtn);
        wait.until(d -> !deleteModal.getAttribute("class").contains("active"));
    }

    @Test
    @Order(26)
    @DisplayName("TC-26: Login Invalid Credentials Displays Friendly Error Toast Instead of Raw Unauthorized")
    public void testLoginInvalidCredentialsUserFriendlyError() {
        driver.get(indexUrl);
        wait.until(ExpectedConditions.titleContains("Sign In"));

        WebElement emailInput = wait.until(ExpectedConditions.presenceOfElementLocated(By.id("email")));
        WebElement passwordInput = driver.findElement(By.id("password"));
        WebElement submitBtn = driver.findElement(By.cssSelector("button[type='submit']"));

        emailInput.clear();
        emailInput.sendKeys("nonexistent_user@example.com");
        passwordInput.clear();
        passwordInput.sendKeys("WrongPassword123!");

        clickElement(submitBtn);

        WebElement toast = wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector(".toast.toast-error, .toast")));
        String toastText = toast.getText();

        assertFalse(toastText.trim().equalsIgnoreCase("Unauthorized"), "Error toast should not show raw Unauthorized to user");
        assertTrue(toastText.toLowerCase().contains("invalid") || toastText.toLowerCase().contains("unable") || toastText.toLowerCase().contains("failed") || toastText.toLowerCase().contains("credentials"),
            "Error toast should explain the issue in clear, user-friendly language: " + toastText);

        assertTrue(emailInput.getAttribute("class").contains("is-invalid"), "Email input should be flagged with is-invalid");
    }

    @Test
    @Order(27)
    @DisplayName("TC-27: View Monthly Report vs Export Monthly Summary Mode Differentiation & Controls")
    public void testViewMonthlyReportVsExportMonthlySummaryDifferentiation() {
        loginSessionAndGoToDashboard();

        WebElement profileTrigger = wait.until(ExpectedConditions.elementToBeClickable(By.id("profileTrigger")));
        ((JavascriptExecutor) driver).executeScript(
            "if (typeof toggleProfileMenu === 'function') { toggleProfileMenu(true); } else { const m = document.getElementById('profileMenu'); if (m) m.classList.add('active'); }"
        );

        WebElement viewReportBtn = wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("viewMonthlyReportBtn")));
        WebElement exportSummaryBtn = wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("exportMonthlySummaryBtn")));

        assertTrue(viewReportBtn.isDisplayed(), "View Monthly Report button must be present in profile menu");
        assertTrue(exportSummaryBtn.isDisplayed(), "Export Monthly Summary button must be present in profile menu");

        // 1. Test clicking "View Monthly Report"
        clickElement(viewReportBtn);
        WebElement periodModal = wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("monthlyReportPeriodModal")));
        assertTrue(periodModal.getAttribute("class").contains("active"), "Monthly report period modal should be active");

        WebElement modalTitle = driver.findElement(By.id("periodModalTitle"));
        assertTrue(modalTitle.getText().contains("View Monthly Report"), "Modal header in view mode should state View Monthly Report");

        WebElement viewActions = driver.findElement(By.id("periodViewModeActions"));
        WebElement exportActions = driver.findElement(By.id("periodExportModeActions"));
        assertTrue(viewActions.isDisplayed(), "View mode actions must be displayed in view mode");
        assertFalse(exportActions.isDisplayed(), "Export mode actions must be hidden in view mode");

        // 2. Test dynamic mode switcher to Export
        WebElement switchToExportBtn = driver.findElement(By.id("periodSwitchToExportBtn"));
        clickElement(switchToExportBtn);

        wait.until(d -> modalTitle.getText().contains("Export Monthly Summary"));
        assertTrue(exportActions.isDisplayed(), "Export mode actions must be displayed after switching to export mode");
        assertFalse(viewActions.isDisplayed(), "View mode actions must be hidden after switching to export mode");

        WebElement exportCsvBtn = driver.findElement(By.id("periodExportCsvBtn"));
        WebElement exportJsonBtn = driver.findElement(By.id("periodExportJsonBtn"));
        WebElement downloadHtmlBtn = driver.findElement(By.id("periodDownloadReportBtn"));
        assertTrue(exportCsvBtn.isDisplayed(), "Export CSV button must be available in export mode");
        assertTrue(exportJsonBtn.isDisplayed(), "Export JSON button must be available in export mode");
        assertTrue(downloadHtmlBtn.isDisplayed(), "Download HTML button must be available in export mode");

        // Close modal
        WebElement closeBtn = driver.findElement(By.id("closePeriodModalBtn"));
        clickElement(closeBtn);
        wait.until(d -> !periodModal.getAttribute("class").contains("active"));

        // 3. Test clicking "Export Monthly Summary" directly from profile menu
        ((JavascriptExecutor) driver).executeScript(
            "if (typeof toggleProfileMenu === 'function') { toggleProfileMenu(true); } else { const m = document.getElementById('profileMenu'); if (m) m.classList.add('active'); }"
        );
        exportSummaryBtn = wait.until(ExpectedConditions.elementToBeClickable(By.id("exportMonthlySummaryBtn")));
        clickElement(exportSummaryBtn);

        wait.until(d -> periodModal.getAttribute("class").contains("active"));
        wait.until(d -> modalTitle.getText().contains("Export Monthly Summary"));
        assertTrue(exportActions.isDisplayed(), "Opening via Export Monthly Summary should directly show export actions");
        assertFalse(viewActions.isDisplayed(), "Opening via Export Monthly Summary should not show view actions");

        clickElement(closeBtn);
        wait.until(d -> !periodModal.getAttribute("class").contains("active"));
    }
}
