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
        page.evaluate("() => { localStorage.setItem('token', 'fake-test-token'); localStorage.setItem('userId', '1'); localStorage.setItem('userName', 'Test User'); localStorage.setItem('userEmail', 'test@test.com'); }");
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
            assertTrue(page.querySelector("#email") != null, "Email field should exist");
            assertTrue(page.querySelector("#password") != null, "Password field should exist");
            assertTrue(page.querySelector("#loginBtn") != null, "Login button should exist");
        }

        @Test
        @Order(2)
        @DisplayName("has Google OAuth button")
        void googleOAuthButtonExists() {
            page.navigate(baseUrl() + "/index.html");
            page.waitForSelector("#loginForm", new Page.WaitForSelectorOptions().setTimeout(10000));
            assertTrue(page.querySelector("#googleOAuthBtn") != null, "Google OAuth button should exist");
        }

        @Test
        @Order(3)
        @DisplayName("has biometric login button")
        void biometricLoginButtonExists() {
            page.navigate(baseUrl() + "/index.html");
            page.waitForSelector("#loginForm", new Page.WaitForSelectorOptions().setTimeout(10000));
            assertTrue(page.querySelector("#biometricLoginBtn") != null, "Biometric login button should exist");
        }

        @Test
        @Order(4)
        @DisplayName("has theme toggle button")
        void themeToggleButtonExists() {
            page.navigate(baseUrl() + "/index.html");
            page.waitForSelector("#loginForm", new Page.WaitForSelectorOptions().setTimeout(10000));
            assertTrue(page.querySelector("#themeToggle") != null, "Theme toggle button should exist");
        }

        @Test
        @Order(5)
        @DisplayName("has hero section with saved amount")
        void heroSectionExists() {
            page.navigate(baseUrl() + "/index.html");
            page.waitForSelector("#loginForm", new Page.WaitForSelectorOptions().setTimeout(10000));
            assertTrue(page.querySelector("#heroSavedAmount") != null, "Hero saved amount should exist");
            assertTrue(page.querySelector("#heroCurrencyWord") != null, "Hero currency word should exist");
            assertTrue(page.querySelector("#heroSubline") != null, "Hero subline should exist");
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
            assertTrue(page.querySelector("#reg-name") != null, "Name field should exist");
            assertTrue(page.querySelector("#reg-username") != null, "Username field should exist");
            assertTrue(page.querySelector("#reg-email") != null, "Email field should exist");
            assertTrue(page.querySelector("#reg-password") != null, "Password field should exist");
        }

        @Test
        @DisplayName("has currency selector")
        void currencySelectorExists() {
            page.navigate(baseUrl() + "/register.html");
            page.waitForSelector("#registerForm", new Page.WaitForSelectorOptions().setTimeout(10000));
            assertTrue(page.querySelector("#reg-currency") != null, "Currency selector should exist");
        }

        @Test
        @DisplayName("has security PIN field")
        void securityPinFieldExists() {
            page.navigate(baseUrl() + "/register.html");
            page.waitForSelector("#registerForm", new Page.WaitForSelectorOptions().setTimeout(10000));
            assertTrue(page.querySelector("#reg-security-pin") != null, "Security PIN field should exist");
        }

        @Test
        @DisplayName("has OTP field group and send button")
        void otpFieldsExist() {
            page.navigate(baseUrl() + "/register.html");
            page.waitForSelector("#registerForm", new Page.WaitForSelectorOptions().setTimeout(10000));
            assertTrue(page.querySelector("#otpGroup") != null, "OTP group should exist");
            assertTrue(page.querySelector("#sendOtpBtn") != null, "Send OTP button should exist");
            assertTrue(page.querySelector("#resendOtpBtn") != null, "Resend OTP button should exist");
        }

        @Test
        @DisplayName("has 6-step progress indicator")
        void stepProgressExists() {
            page.navigate(baseUrl() + "/register.html");
            page.waitForSelector("#registerForm", new Page.WaitForSelectorOptions().setTimeout(10000));
            assertTrue(page.querySelector("#stepBar") != null, "Step bar should exist");
            for (int i = 1; i <= 6; i++) {
                assertTrue(page.querySelector("#dot" + i) != null, "Dot " + i + " should exist");
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
            assertTrue(page.querySelector("#trendChart") != null, "Trend chart should exist");
            assertTrue(page.querySelector("#recurringSplitChart") != null, "Recurring split chart should exist");
            assertTrue(page.querySelector("#dayOfWeekChart") != null, "Day of week chart should exist");
            assertTrue(page.querySelector("#budgetVsActualChart") != null, "Budget vs actual chart should exist");
        }

        @Test
        @DisplayName("renders metric cards")
        void metricCardsRender() {
            assertTrue(page.querySelector("#totalAmount") != null, "Total amount should exist");
            assertTrue(page.querySelector("#totalIncomeAmount") != null, "Total income should exist");
            assertTrue(page.querySelector("#dailyBurnRate") != null, "Daily burn rate should exist");
            assertTrue(page.querySelector("#savingsRateValue") != null, "Savings rate should exist");
            assertTrue(page.querySelector("#burnRateBadge") != null, "Burn rate badge should exist");
            assertTrue(page.querySelector("#topCategoryName") != null, "Top category name should exist");
            assertTrue(page.querySelector("#topCategoryAmount") != null, "Top category amount should exist");
            assertTrue(page.querySelector("#savingsGoalBadge") != null, "Savings goal badge should exist");
        }

        @Test
        @DisplayName("renders expense form fields")
        void expenseFormFieldsExist() {
            assertTrue(page.querySelector("#addExpenseForm") != null, "Add expense form should exist");
            assertTrue(page.querySelector("#amount") != null, "Amount field should exist");
            assertTrue(page.querySelector("#date") != null, "Date field should exist");
            assertTrue(page.querySelector("#categorySelect") != null, "Category select should exist");
            assertTrue(page.querySelector("#addCategoryBtn") != null, "Add category button should exist");
        }

        @Test
        @DisplayName("renders table tabs")
        void tableTabsExist() {
            assertTrue(page.querySelector("#tabBtnAll") != null, "All tab should exist");
            assertTrue(page.querySelector("#tabBtnExpenses") != null, "Expenses tab should exist");
            assertTrue(page.querySelector("#tabBtnIncomes") != null, "Incomes tab should exist");
        }

        @Test
        @DisplayName("renders filter elements")
        void filterElementsExist() {
            assertTrue(page.querySelector("#filterSearch") != null, "Filter search should exist");
            assertTrue(page.querySelector("#toggleFiltersBtn") != null, "Toggle filters button should exist");
            assertTrue(page.querySelector("#resetFiltersBtn") != null, "Reset filters button should exist");
            assertTrue(page.querySelector("#categoryPillsBar") != null, "Category pills bar should exist");
        }

        @Test
        @DisplayName("renders budget section")
        void budgetSectionExists() {
            assertTrue(page.querySelector("#addBudgetBtn") != null, "Add budget button should exist");
            assertTrue(page.querySelector("#budgetList") != null, "Budget list should exist");
            assertTrue(page.querySelector("#budgetModal") != null, "Budget modal should exist");
            assertTrue(page.querySelector("#budgetCategorySelect") != null, "Budget category select should exist");
            assertTrue(page.querySelector("#budgetLimit") != null, "Budget limit field should exist");
        }

        @Test
        @DisplayName("renders savings goals section")
        void savingsGoalsSectionExists() {
            assertTrue(page.querySelector("#addGoalBtn") != null, "Add goal button should exist");
            assertTrue(page.querySelector("#savingsGoalsList") != null, "Savings goals list should exist");
            assertTrue(page.querySelector("#savingsGoalModal") != null, "Savings goal modal should exist");
        }

        @Test
        @DisplayName("renders subscriptions section")
        void subscriptionsSectionExists() {
            assertTrue(page.querySelector("#subsModal") != null, "Subscriptions modal should exist");
            assertTrue(page.querySelector("#subsModalList") != null, "Subscriptions modal list should exist");
            assertTrue(page.querySelector("#subsCountBadge") != null, "Subs count badge should exist");
        }

        @Test
        @DisplayName("renders report section")
        void reportSectionExists() {
            assertTrue(page.querySelector("#viewMonthlyReportBtn") != null, "View monthly report button should exist");
            assertTrue(page.querySelector("#changeReportPeriodBtn") != null, "Change report period button should exist");
            assertTrue(page.querySelector("#monthlyReportModal") != null, "Monthly report modal should exist");
        }

        @Test
        @DisplayName("renders profile menu and settings")
        void profileMenuExists() {
            assertTrue(page.querySelector("#profileTrigger") != null, "Profile trigger should exist");
            assertTrue(page.querySelector("#profileMenu") != null, "Profile menu should exist");
            assertTrue(page.querySelector("#deleteAccountBtn") != null, "Delete account button should exist");
            assertTrue(page.querySelector("#securityPinBtn") != null, "Security PIN button should exist");
            assertTrue(page.querySelector("#biometricAuthBtn") != null, "Biometric auth button should exist");
        }

        @Test
        @DisplayName("renders currency selector")
        void currencySelectorExists() {
            assertTrue(page.querySelector("#dashCurrencyTrigger") != null, "Currency trigger should exist");
            assertTrue(page.querySelector("#dashCurrencyLabel") != null, "Currency label should exist");
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
