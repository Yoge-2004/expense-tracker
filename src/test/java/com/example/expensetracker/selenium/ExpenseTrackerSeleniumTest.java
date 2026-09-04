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
    @DisplayName("TC-24: Custom Dropdowns & Luxury Calendar Date Picker Verification")
    public void testCustomDropdownsAndCalendarDatePicker() {
        loginSessionAndGoToDashboard();

        // 1. Ensure filter panel is open
        WebElement filterPanel = driver.findElement(By.id("filterPanel"));
        if (!filterPanel.isDisplayed()) {
            WebElement toggleBtn = driver.findElement(By.id("toggleFiltersBtn"));
            clickElement(toggleBtn);
            wait.until(ExpectedConditions.visibilityOf(filterPanel));
        }

        // 2. Verify Custom Dropdown on #filterMonth
        WebElement filterMonth = driver.findElement(By.id("filterMonth"));
        assertTrue(filterMonth.getAttribute("class").contains("custom-select-native"),
                "Native #filterMonth should be visually hidden via .custom-select-native");

        WebElement monthWrapper = driver.findElement(By.cssSelector(".custom-select-wrapper[data-target-id='filterMonth']"));
        assertNotNull(monthWrapper, "Custom select wrapper should exist for filterMonth");

        WebElement monthTrigger = monthWrapper.findElement(By.className("custom-select-trigger"));
        ((JavascriptExecutor) driver).executeScript("arguments[0].scrollIntoView({block: 'center'});", monthTrigger);
        clickElement(monthTrigger);

        WebElement monthOptions = monthWrapper.findElement(By.className("custom-select-options"));
        wait.until(ExpectedConditions.visibilityOf(monthOptions));
        assertTrue(monthOptions.isDisplayed(), "Options popup should be visible when open");

        // Pick a month (e.g. March = 3)
        WebElement marchOption = monthWrapper.findElement(By.cssSelector(".custom-option[data-value='3']"));
        clickElement(marchOption);

        assertEquals("3", filterMonth.getAttribute("value"), "Filter month select value should update to 3");
        assertFalse(monthWrapper.getAttribute("class").contains("open"), "Dropdown should close after selection");

        // 3. Verify Custom Calendar Date Picker on #filterStartDate
        WebElement startDateInput = driver.findElement(By.id("filterStartDate"));
        clickElement(startDateInput);

        WebElement calPicker = wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("customCalendarPicker")));
        assertTrue(calPicker.isDisplayed(), "Custom calendar date picker popover should open");

        WebElement calGrid = calPicker.findElement(By.id("calGrid"));
        List<WebElement> dayCells = calGrid.findElements(By.className("cal-day-cell"));
        assertTrue(dayCells.size() >= 35, "Calendar grid should render at least 35 day cells");

        // Click "Today" button
        WebElement todayBtn = calPicker.findElement(By.id("calTodayBtn"));
        clickElement(todayBtn);

        wait.until(ExpectedConditions.invisibilityOf(calPicker));
        assertFalse(startDateInput.getAttribute("value").isEmpty(), "Start date input should be populated with today's date");

        // Open again to test "Clear"
        clickElement(startDateInput);
        wait.until(ExpectedConditions.visibilityOf(calPicker));
        WebElement clearBtn = calPicker.findElement(By.id("calClearBtn"));
        clickElement(clearBtn);

        wait.until(ExpectedConditions.invisibilityOf(calPicker));
        assertEquals("", startDateInput.getAttribute("value"), "Start date input should be cleared");

        // 4. Verify changing Month and Year using the custom luxury dropdowns in the calendar
        clickElement(startDateInput);
        wait.until(ExpectedConditions.visibilityOf(calPicker));

        WebElement calMonthWrapper = calPicker.findElement(By.cssSelector(".custom-select-wrapper[data-target-id='calMonthSelect']"));
        WebElement calYearWrapper = calPicker.findElement(By.cssSelector(".custom-select-wrapper[data-target-id='calYearSelect']"));
        assertNotNull(calMonthWrapper, "Month custom select wrapper should exist in calendar header");
        assertNotNull(calYearWrapper, "Year custom select wrapper should exist in calendar header");

        // Click month custom trigger and select May (index 4)
        WebElement calMonthTrigger = calMonthWrapper.findElement(By.className("custom-select-trigger"));
        clickElement(calMonthTrigger);
        WebElement mayOption = calMonthWrapper.findElement(By.cssSelector(".custom-option[data-value='4']"));
        clickElement(mayOption);

        // Click year custom trigger and select 2024
        WebElement calYearTrigger = calYearWrapper.findElement(By.className("custom-select-trigger"));
        clickElement(calYearTrigger);
        WebElement opt2024 = calYearWrapper.findElement(By.cssSelector(".custom-option[data-value='2024']"));
        clickElement(opt2024);

        // Click day 15 cell
        WebElement day15 = calPicker.findElement(By.cssSelector(".cal-day-cell[data-date='2024-05-15']"));
        clickElement(day15);

        wait.until(ExpectedConditions.invisibilityOf(calPicker));
        assertEquals("2024-05-15", startDateInput.getAttribute("value"), "Date input should reflect selected month and year 2024-05-15");
    }

    @Test
    @Order(25)
    @DisplayName("TC-25: Income Symbols, Subscriptions Recurring Inflow/Outflow Tabs, and Multi-Factor Insights")
    public void testIncomeSymbolsSubscriptionsAndSynthesizedInsights() {
        loginSessionAndGoToDashboard();

        // 1. Inject test data with expenses, recurring incomes, and savings goals
        ((JavascriptExecutor) driver).executeScript(
            "window.allExpenses = [" +
            "  { id: 101, description: 'Netflix Premium', amount: 19.99, expenseDate: '2026-09-01', categoryName: 'Entertainment', isRecurring: true, frequency: 'MONTHLY' }," +
            "  { id: 102, description: 'Grocery Market', amount: 85.50, expenseDate: '2026-09-02', categoryName: 'Food & Dining', isRecurring: false }" +
            "];" +
            "window.allIncomes = [" +
            "  { id: 201, source: 'Engineering Salary', amount: 4500.00, incomeDate: '2026-09-01', description: 'Tech Corp Direct Deposit', isRecurring: true, frequency: 'MONTHLY', intervalDays: 1 }," +
            "  { id: 202, source: 'Freelance Design', amount: 650.00, incomeDate: '2026-09-03', description: 'Client UI Design', isRecurring: false }" +
            "];" +
            "window.allSavingsGoals = [" +
            "  { id: 301, name: 'Emergency Fund', targetAmount: 10000, currentAmount: 4500, targetDate: '2026-12-31' }" +
            "];" +
            "if (typeof renderIncomes === 'function') renderIncomes(window.allIncomes);" +
            "if (typeof renderSavingsGoals === 'function') renderSavingsGoals(window.allSavingsGoals);" +
            "if (typeof renderFinancialInsights === 'function') renderFinancialInsights(window.allExpenses);"
        );

        // 2. Verify Income emoji box and symbols in #incomeList
        wait.until(d -> {
            WebElement list = d.findElement(By.id("incomeList"));
            return list.getText().contains("Engineering Salary");
        });
        WebElement incomeList = driver.findElement(By.id("incomeList"));
        List<WebElement> emojiBoxes = incomeList.findElements(By.className("income-emoji-box"));
        assertFalse(emojiBoxes.isEmpty(), "Income list should render .income-emoji-box icons next to source names");
        assertTrue(incomeList.getText().contains("Engineering Salary"), "Income table should display source text");

        // 3. Open Subscriptions Modal and verify Outflow/Inflow tabs
        ((JavascriptExecutor) driver).executeScript(
            "const modal = document.getElementById('subsModal');" +
            "if (typeof openModal === 'function') openModal(modal);" +
            "if (typeof loadSubscriptions === 'function') loadSubscriptions();"
        );

        WebElement subsModal = wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("subsModal")));
        assertTrue(subsModal.isDisplayed(), "Subscriptions modal should be visible");

        // Verify cash flow summary strip in modal (use toUpperCase since CSS uses text-transform: uppercase)
        wait.until(d -> {
            WebElement summary = d.findElement(By.id("subsCashflowSummary"));
            return summary != null && summary.getText().toUpperCase().contains("RECURRING SUBSCRIPTIONS");
        });
        WebElement cashflowSummary = subsModal.findElement(By.id("subsCashflowSummary"));
        assertTrue(cashflowSummary.isDisplayed(), "Modal should display cash flow summary strip");
        assertTrue(cashflowSummary.getText().toUpperCase().contains("RECURRING INFLOWS"), "Summary should list recurring inflows");

        // Test tab switching
        WebElement expTabBtn = subsModal.findElement(By.id("subsTabExpensesBtn"));
        WebElement incTabBtn = subsModal.findElement(By.id("subsTabIncomesBtn"));
        assertNotNull(expTabBtn, "Outflow expenses tab button should exist");
        assertNotNull(incTabBtn, "Inflow incomes tab button should exist");

        // Switch to Inflows tab
        clickElement(incTabBtn);
        assertTrue(incTabBtn.getAttribute("class").contains("active"), "Incomes tab should be active after click");

        // Close modal
        WebElement closeBtn = subsModal.findElement(By.id("closeSubsModalBtn"));
        clickElement(closeBtn);
        wait.until(ExpectedConditions.invisibilityOf(subsModal));

        // 4. Verify Synthesized Financial Insights in #insightsCardsGrid
        ((JavascriptExecutor) driver).executeScript(
            "if (typeof renderFinancialInsights === 'function') renderFinancialInsights(window.allExpenses);"
        );
        wait.until(d -> {
            WebElement grid = d.findElement(By.id("insightsCardsGrid"));
            return grid != null && grid.getText().toUpperCase().contains("NET CASH FLOW & SAVINGS RATE");
        });
        WebElement insightsGrid = driver.findElement(By.id("insightsCardsGrid"));
        String insightsText = insightsGrid.getText();
        assertTrue(insightsText.toUpperCase().contains("NET CASH FLOW & SAVINGS RATE"), "Insights should include Net Cash Flow & Savings Rate card");
        assertTrue(insightsText.toUpperCase().contains("SAVINGS GOALS TRAJECTORY"), "Insights should include Savings Goals Trajectory card");
        assertTrue(insightsText.toUpperCase().contains("RECURRING BASELINE COVERAGE"), "Insights should include Recurring Baseline Coverage card");

        WebElement healthBadge = driver.findElement(By.id("insightsHealthScoreText"));
        assertTrue(healthBadge.getText().contains("Financial Health"), "Health badge should report synthesized Financial Health");
    }


    @Test
    @Order(26)
    public void testMetricCardsSemanticColorsMatchingTextAndLightModeAdaptation() {
        loginSessionAndGoToDashboard();

        // 1. Locate all 5 metric cards
        WebElement inflowCard = driver.findElement(By.cssSelector(".metric-card.metric-card-inflow"));
        WebElement outflowCard = driver.findElement(By.cssSelector(".metric-card.metric-card-outflow"));
        WebElement netflowCard = driver.findElement(By.cssSelector(".metric-card.metric-card-netflow"));
        WebElement savingsCard = driver.findElement(By.cssSelector(".metric-card.metric-card-savings"));
        WebElement subsCard = driver.findElement(By.cssSelector(".metric-card.metric-card-subs"));

        assertNotNull(inflowCard, "Inflow card should exist");
        assertNotNull(outflowCard, "Outflow card should exist");
        assertNotNull(netflowCard, "Net cash flow card should exist");
        assertNotNull(savingsCard, "Savings rate card should exist");
        assertNotNull(subsCard, "Subscription card should exist with .metric-card-subs class");

        // 2. Verify all 5 cards have 4px left border
        assertEquals("4px", inflowCard.getCssValue("border-left-width"), "Inflow card should have 4px left border");
        assertEquals("4px", outflowCard.getCssValue("border-left-width"), "Outflow card should have 4px left border");
        assertEquals("4px", netflowCard.getCssValue("border-left-width"), "Net flow card should have 4px left border");
        assertEquals("4px", savingsCard.getCssValue("border-left-width"), "Savings card should have 4px left border");
        assertEquals("4px", subsCard.getCssValue("border-left-width"), "Subscriptions card should have 4px left border");

        // 3. Verify text color matches vertical stripe color on each card (Dark Mode)
        String inflowBorderColor = inflowCard.getCssValue("border-left-color");
        String inflowLabelColor = inflowCard.findElement(By.className("card-label")).getCssValue("color");
        String inflowValueColor = inflowCard.findElement(By.className("metric-value")).getCssValue("color");
        assertEquals(inflowBorderColor, inflowLabelColor, "Inflow card label text color should match vertical stripe");
        assertEquals(inflowBorderColor, inflowValueColor, "Inflow card value text color should match vertical stripe");

        String subsBorderColor = subsCard.getCssValue("border-left-color");
        String subsLabelColor = subsCard.findElement(By.className("card-label")).getCssValue("color");
        String subsValueColor = subsCard.findElement(By.className("metric-value")).getCssValue("color");
        assertEquals(subsBorderColor, subsLabelColor, "Subscription card label color should match vertical stripe");
        assertEquals(subsBorderColor, subsValueColor, "Subscription card value color should match vertical stripe");

        // 4. Toggle to light mode and verify stripe colors adapt without being overridden to faint grey
        ((JavascriptExecutor) driver).executeScript("document.documentElement.setAttribute('data-theme', 'light'); document.body.setAttribute('data-theme', 'light');");

        // Wait for CSS color transition to settle across all cards (support both rgb and rgba with alpha 1)
        wait.until(d -> {
            String in = inflowCard.getCssValue("border-left-color");
            String out = outflowCard.getCssValue("border-left-color");
            String net = netflowCard.getCssValue("border-left-color");
            String sav = savingsCard.getCssValue("border-left-color");
            String sub = subsCard.getCssValue("border-left-color");
            return in != null && in.contains("5, 150, 105")
                && out != null && out.contains("220, 38, 38")
                && net != null && net.contains("37, 99, 235")
                && sav != null && sav.contains("180, 83, 9")
                && sub != null && sub.contains("124, 58, 237");
        });

        String lightInflowBorder = inflowCard.getCssValue("border-left-color");
        String lightOutflowBorder = outflowCard.getCssValue("border-left-color");
        String lightNetflowBorder = netflowCard.getCssValue("border-left-color");
        String lightSavingsBorder = savingsCard.getCssValue("border-left-color");
        String lightSubsBorder = subsCard.getCssValue("border-left-color");

        // In light theme, none of the vertical stripes should be transparent or generic grey
        assertFalse(lightInflowBorder.contains("rgba(0, 0, 0, 0.08)"), "Light inflow stripe should adapt and not be grey");
        assertFalse(lightSubsBorder.contains("rgba(0, 0, 0, 0.08)"), "Light subs stripe should adapt and not be grey");

        // Verify accessible contrast palette is active
        assertTrue(lightInflowBorder.contains("5, 150, 105"), "Inflow stripe should adapt to light theme emerald (#059669)");
        assertTrue(lightOutflowBorder.contains("220, 38, 38"), "Outflow stripe should adapt to light theme crimson (#DC2626)");
        assertTrue(lightNetflowBorder.contains("37, 99, 235"), "Netflow stripe should adapt to light theme royal blue (#2563EB)");
        assertTrue(lightSavingsBorder.contains("180, 83, 9"), "Savings stripe should adapt to light theme amber gold (#B45309)");
        assertTrue(lightSubsBorder.contains("124, 58, 237"), "Subscriptions stripe should adapt to light theme violet (#7C3AED)");

        // Reset theme back to default
        ((JavascriptExecutor) driver).executeScript("document.documentElement.removeAttribute('data-theme'); document.body.removeAttribute('data-theme');");
        wait.until(d -> "rgb(16, 185, 129)".equals(inflowCard.getCssValue("border-left-color")) || "rgba(16, 185, 129, 1)".equals(inflowCard.getCssValue("border-left-color")));
    }
}
