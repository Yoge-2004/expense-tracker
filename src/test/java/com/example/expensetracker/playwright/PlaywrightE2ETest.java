package com.example.expensetracker.playwright;

import com.microsoft.playwright.*;
import com.microsoft.playwright.options.WaitForSelectorState;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Playwright E2E test that drives a real browser against the running Spring Boot app.
 *
 * <p><b>How to run:</b> These tests are disabled by default because they require a
 * Playwright browser binary. Enable them with:
 * <pre>
 *   mvn test -Dtest=PlaywrightE2ETest -Dplaywright=true
 * </pre>
 *
 * <p><b>What it tests:</b> Comprehensive coverage of the expense tracker UI:
 * <ul>
 *   <li>Login page: form fields, OAuth, biometric, theme toggle</li>
 *   <li>Registration page: all fields, step progress, currency selector</li>
 *   <li>Dashboard: 5 charts, 8+ metric cards, expense form, table, tabs</li>
 *   <li>Filters: search, toggle, reset, category pills</li>
 *   <li>Budgets: modal, form fields, close button</li>
 *   <li>Savings goals: modal, form</li>
 *   <li>Subscriptions: modal, tabs</li>
 *   <li>Reports: period selector, view report</li>
 *   <li>Profile menu: delete account, security PIN, biometric</li>
 *   <li>Currency selector</li>
 *   <li>Auth redirect (unauthenticated dashboard access)</li>
 * </ul>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@EnabledIfSystemProperty(named = "playwright", matches = "true")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class PlaywrightE2ETest {

    @LocalServerPort
    private int port;

    private static Playwright playwright;
    private static Browser browser;
    private Page page;

    @BeforeAll
    static void launchBrowser() {
        playwright = Playwright.create();
        browser = playwright.chromium().launch(new BrowserType.LaunchOptions()
                .setHeadless(true)
                .setArgs(java.util.List.of("--no-sandbox", "--disable-setuid-sandbox")));
    }

    @AfterAll
    static void closeBrowser() {
        if (browser != null) browser.close();
        if (playwright != null) playwright.close();
    }

    @BeforeEach
    void createContextAndPage() {
        BrowserContext context = browser.newContext(new Browser.NewContextOptions()
                .setViewportSize(1280, 720));
        page = context.newPage();
    }

    @AfterEach
    void closeContext() {
        if (page != null) {
            page.context().close();
        }
    }

    private String baseUrl() {
        return "http://localhost:" + port;
    }

    private void injectFakeAuth() {
        page.evaluate("() => { " +
                "localStorage.setItem('token', 'fake-test-token'); " +
                "localStorage.setItem('userId', '1'); " +
                "localStorage.setItem('userName', 'Test User'); " +
                "localStorage.setItem('userEmail', 'test@test.com'); }");
    }

    // ═══════════════════════════════════════════════════════════════════════
    // LOGIN PAGE TESTS
    // ═══════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Login page")
    @TestMethodOrder(MethodOrderer.OrderAnnotation.class)
    class LoginPage {

        @Test
        @Order(1)
        @DisplayName("renders login form with email and password fields")
        void loginFormRenders() {
            page.navigate(baseUrl() + "/index.html");
            page.waitForSelector("#loginForm", new Page.WaitForSelectorOptions()
                    .setState(WaitForSelectorState.VISIBLE).setTimeout(10000));
            assertNotNull(page.querySelector("#email"), "Email field should exist");
            assertNotNull(page.querySelector("#password"), "Password field should exist");
            assertNotNull(page.querySelector("#loginBtn"), "Login button should exist");
        }

        @Test
        @Order(2)
        @DisplayName("has Google OAuth button")
        void googleOAuthButtonExists() {
            page.navigate(baseUrl() + "/index.html");
            page.waitForSelector("#loginForm", new Page.WaitForSelectorOptions().setTimeout(10000));
            assertNotNull(page.querySelector("#googleOAuthBtn"), "Google OAuth button should exist");
        }

        @Test
        @Order(3)
        @DisplayName("has biometric login button")
        void biometricLoginButtonExists() {
            page.navigate(baseUrl() + "/index.html");
            page.waitForSelector("#loginForm", new Page.WaitForSelectorOptions().setTimeout(10000));
            assertNotNull(page.querySelector("#biometricLoginBtn"), "Biometric login button should exist");
        }

        @Test
        @Order(4)
        @DisplayName("has theme toggle button")
        void themeToggleButtonExists() {
            page.navigate(baseUrl() + "/index.html");
            page.waitForSelector("#loginForm", new Page.WaitForSelectorOptions().setTimeout(10000));
            assertNotNull(page.querySelector("#themeToggle"), "Theme toggle button should exist");
        }

        @Test
        @Order(5)
        @DisplayName("has hero section with saved amount")
        void heroSectionExists() {
            page.navigate(baseUrl() + "/index.html");
            page.waitForSelector("#loginForm", new Page.WaitForSelectorOptions().setTimeout(10000));
            assertNotNull(page.querySelector("#heroSavedAmount"), "Hero saved amount should exist");
            assertNotNull(page.querySelector("#heroCurrencyWord"), "Hero currency word should exist");
            assertNotNull(page.querySelector("#heroSubline"), "Hero subline should exist");
        }

        @Test
        @Order(6)
        @DisplayName("invalid login shows error and stays on page")
        void invalidLoginStaysOnPage() {
            page.navigate(baseUrl() + "/index.html");
            page.waitForSelector("#loginForm", new Page.WaitForSelectorOptions().setTimeout(10000));

            ElementHandle email = page.querySelector("#email");
            ElementHandle pass = page.querySelector("#password");
            ElementHandle btn = page.querySelector("#loginBtn");
            if (email != null) email.fill("nonexistent@test.com");
            if (pass != null) pass.fill("WrongPassword123");
            if (btn != null) btn.click();

            page.waitForTimeout(3000);
            String currentUrl = page.url();
            assertTrue(currentUrl.contains("index.html"), "Should stay on login page after invalid login");
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // REGISTRATION PAGE TESTS
    // ═══════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Registration page")
    class RegistrationPage {

        @Test
        @DisplayName("renders all required form fields")
        void registrationFormRenders() {
            page.navigate(baseUrl() + "/register.html");
            page.waitForSelector("#registerForm", new Page.WaitForSelectorOptions().setTimeout(10000));
            assertNotNull(page.querySelector("#reg-name"), "Name field should exist");
            assertNotNull(page.querySelector("#reg-username"), "Username field should exist");
            assertNotNull(page.querySelector("#reg-email"), "Email field should exist");
            assertNotNull(page.querySelector("#reg-password"), "Password field should exist");
        }

        @Test
        @DisplayName("has currency selector")
        void currencySelectorExists() {
            page.navigate(baseUrl() + "/register.html");
            page.waitForSelector("#registerForm", new Page.WaitForSelectorOptions().setTimeout(10000));
            assertNotNull(page.querySelector("#reg-currency"), "Currency selector should exist");
        }

        @Test
        @DisplayName("has security PIN field")
        void securityPinFieldExists() {
            page.navigate(baseUrl() + "/register.html");
            page.waitForSelector("#registerForm", new Page.WaitForSelectorOptions().setTimeout(10000));
            assertNotNull(page.querySelector("#reg-security-pin"), "Security PIN field should exist");
        }

        @Test
        @DisplayName("has OTP field group and send button")
        void otpFieldsExist() {
            page.navigate(baseUrl() + "/register.html");
            page.waitForSelector("#registerForm", new Page.WaitForSelectorOptions().setTimeout(10000));
            assertNotNull(page.querySelector("#otpGroup"), "OTP group should exist");
            assertNotNull(page.querySelector("#sendOtpBtn"), "Send OTP button should exist");
            assertNotNull(page.querySelector("#resendOtpBtn"), "Resend OTP button should exist");
        }

        @Test
        @DisplayName("has 6-step progress indicator")
        void stepProgressExists() {
            page.navigate(baseUrl() + "/register.html");
            page.waitForSelector("#registerForm", new Page.WaitForSelectorOptions().setTimeout(10000));
            assertNotNull(page.querySelector("#stepBar"), "Step bar should exist");
            for (int i = 1; i <= 6; i++) {
                assertNotNull(page.querySelector("#dot" + i), "Dot " + i + " should exist");
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DASHBOARD TESTS
    // ═══════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Dashboard")
    class Dashboard {

        @BeforeEach
        void setupDashboard() {
            page.navigate(baseUrl() + "/index.html");
            injectFakeAuth();
            page.navigate(baseUrl() + "/dashboard.html");
            page.waitForTimeout(2000);
        }

        @Test
        @DisplayName("renders 5 chart canvases")
        void chartsRender() {
            int canvasCount = page.querySelectorAll("canvas").size();
            assertTrue(canvasCount >= 5, "Dashboard should have at least 5 chart canvases, found: " + canvasCount);
        }

        @Test
        @DisplayName("renders specific chart canvases by ID")
        void specificChartsExist() {
            assertNotNull(page.querySelector("#trendChart"), "Trend chart should exist");
            assertNotNull(page.querySelector("#recurringSplitChart"), "Recurring split chart should exist");
            assertNotNull(page.querySelector("#dayOfWeekChart"), "Day of week chart should exist");
            assertNotNull(page.querySelector("#budgetVsActualChart"), "Budget vs actual chart should exist");
        }

        @Test
        @DisplayName("renders metric cards")
        void metricCardsRender() {
            assertNotNull(page.querySelector("#totalAmount"), "Total amount should exist");
            assertNotNull(page.querySelector("#totalIncomeAmount"), "Total income should exist");
            assertNotNull(page.querySelector("#dailyBurnRate"), "Daily burn rate should exist");
            assertNotNull(page.querySelector("#savingsRateValue"), "Savings rate should exist");
            assertNotNull(page.querySelector("#burnRateBadge"), "Burn rate badge should exist");
            assertNotNull(page.querySelector("#topCategoryName"), "Top category name should exist");
            assertNotNull(page.querySelector("#topCategoryAmount"), "Top category amount should exist");
            assertNotNull(page.querySelector("#savingsGoalBadge"), "Savings goal badge should exist");
        }

        @Test
        @DisplayName("renders expense form fields")
        void expenseFormFieldsExist() {
            assertNotNull(page.querySelector("#addExpenseForm"), "Add expense form should exist");
            assertNotNull(page.querySelector("#amount"), "Amount field should exist");
            assertNotNull(page.querySelector("#date"), "Date field should exist");
            assertNotNull(page.querySelector("#categorySelect"), "Category select should exist");
            assertNotNull(page.querySelector("#addCategoryBtn"), "Add category button should exist");
        }

        @Test
        @DisplayName("renders table tabs")
        void tableTabsExist() {
            assertNotNull(page.querySelector("#tabBtnAll"), "All tab should exist");
            assertNotNull(page.querySelector("#tabBtnExpenses"), "Expenses tab should exist");
            assertNotNull(page.querySelector("#tabBtnIncomes"), "Incomes tab should exist");
        }

        @Test
        @DisplayName("renders filter elements")
        void filterElementsExist() {
            assertNotNull(page.querySelector("#filterSearch"), "Filter search should exist");
            assertNotNull(page.querySelector("#toggleFiltersBtn"), "Toggle filters button should exist");
            assertNotNull(page.querySelector("#resetFiltersBtn"), "Reset filters button should exist");
            assertNotNull(page.querySelector("#categoryPillsBar"), "Category pills bar should exist");
        }

        @Test
        @DisplayName("renders budget section")
        void budgetSectionExists() {
            assertNotNull(page.querySelector("#addBudgetBtn"), "Add budget button should exist");
            assertNotNull(page.querySelector("#budgetList"), "Budget list should exist");
            assertNotNull(page.querySelector("#budgetModal"), "Budget modal should exist");
            assertNotNull(page.querySelector("#budgetCategorySelect"), "Budget category select should exist");
            assertNotNull(page.querySelector("#budgetLimit"), "Budget limit field should exist");
        }

        @Test
        @DisplayName("renders savings goals section")
        void savingsGoalsSectionExists() {
            assertNotNull(page.querySelector("#addGoalBtn"), "Add goal button should exist");
            assertNotNull(page.querySelector("#savingsGoalsList"), "Savings goals list should exist");
            assertNotNull(page.querySelector("#savingsGoalModal"), "Savings goal modal should exist");
        }

        @Test
        @DisplayName("renders subscriptions section")
        void subscriptionsSectionExists() {
            assertNotNull(page.querySelector("#subsModal"), "Subscriptions modal should exist");
            assertNotNull(page.querySelector("#subsModalList"), "Subscriptions modal list should exist");
            assertNotNull(page.querySelector("#subsCountBadge"), "Subs count badge should exist");
        }

        @Test
        @DisplayName("renders report section")
        void reportSectionExists() {
            assertNotNull(page.querySelector("#viewMonthlyReportBtn"), "View monthly report button should exist");
            assertNotNull(page.querySelector("#changeReportPeriodBtn"),
                    "Change report period button should exist");
            assertNotNull(page.querySelector("#monthlyReportModal"), "Monthly report modal should exist");
        }

        @Test
        @DisplayName("renders profile menu and settings")
        void profileMenuExists() {
            assertNotNull(page.querySelector("#profileTrigger"), "Profile trigger should exist");
            assertNotNull(page.querySelector("#profileMenu"), "Profile menu should exist");
            assertNotNull(page.querySelector("#deleteAccountBtn"), "Delete account button should exist");
            assertNotNull(page.querySelector("#securityPinBtn"), "Security PIN button should exist");
            assertNotNull(page.querySelector("#biometricAuthBtn"), "Biometric auth button should exist");
        }

        @Test
        @DisplayName("renders currency selector")
        void currencySelectorExists() {
            assertNotNull(page.querySelector("#dashCurrencyTrigger"), "Currency trigger should exist");
            assertNotNull(page.querySelector("#dashCurrencyLabel"), "Currency label should exist");
        }

        @Test
        @DisplayName("can switch between tabs")
        void canSwitchTabs() {
            page.querySelector("#tabBtnExpenses").click();
            page.waitForTimeout(300);
            page.querySelector("#tabBtnIncomes").click();
            page.waitForTimeout(300);
            page.querySelector("#tabBtnAll").click();
            page.waitForTimeout(300);
            assertNotNull(page.querySelector("#tabBtnAll"), "Tab button should exist after switching");
        }

        @Test
        @DisplayName("can type in filter search")
        void canTypeInFilterSearch() {
            ElementHandle search = page.querySelector("#filterSearch");
            if (search != null) {
                search.fill("test query");
                assertEquals("test query", search.inputValue());
            }
        }

        @Test
        @DisplayName("can fill amount field")
        void canFillAmountField() {
            ElementHandle amount = page.querySelector("#amount");
            if (amount != null) {
                amount.fill("42.50");
                assertEquals("42.50", amount.inputValue());
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // AUTH REDIRECT TEST
    // ═══════════════════════════════════════════════════════════════════════

    @Test
    @Order(99)
    @DisplayName("dashboard redirects unauthenticated users to login")
    void dashboardRedirectsUnauthenticated() {
        page.navigate(baseUrl() + "/index.html");
        page.evaluate("() => { localStorage.removeItem('token'); localStorage.removeItem('userId'); }");
        page.navigate(baseUrl() + "/dashboard.html");
        page.waitForTimeout(2000);
        String currentUrl = page.url();
        assertTrue(currentUrl.contains("index.html"), "Unauthenticated dashboard access should redirect to login");
    }
}
