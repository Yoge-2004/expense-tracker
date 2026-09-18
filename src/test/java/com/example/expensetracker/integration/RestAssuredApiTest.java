package com.example.expensetracker.integration;

import io.restassured.RestAssured;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.*;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDate;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

/**
 * Modern integration test suite using RestAssured.
 *
 * <p>Validates full HTTP pipeline, Spring Security filter chain, JWT authentication,
 * domain validation, screaming error envelopes, and end-to-end CRUD flows.</p>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class RestAssuredApiTest {

    @LocalServerPort
    private int port;

    private static String jwtToken;
    private static Long registeredUserId;
    private static Long createdCategoryId;
    private static Long createdExpenseId;

    @BeforeEach
    void setUp() {
        RestAssured.port = port;
        RestAssured.enableLoggingOfRequestAndResponseIfValidationFails();
    }

    // ─── 1. PUBLIC AUTH & REGISTRATION FLOWS ────────────────────────────────

    @Test
    @Order(1)
    @DisplayName("POST /api/auth/register - Successfully registers user and returns UserDto")
    void registerUserSuccessfully() {
        Map<String, Object> registerRequest = Map.of(
                "name", "Integration Tester",
                "username", "itest_user",
                "email", "itest@example.com",
                "password", "SecureP@ssw0rd123!",
                "currency", "INR"
        );

        var response = given()
                .contentType(ContentType.JSON)
                .body(registerRequest)
        .when()
                .post("/api/auth/register")
        .then()
                .statusCode(201)
                .body("id", notNullValue())
                .body("email", equalTo("itest@example.com"))
                .body("username", equalTo("itest_user"))
                .extract();

        registeredUserId = ((Number) response.path("id")).longValue();
        Assertions.assertNotNull(registeredUserId);
    }

    @Test
    @Order(2)
    @DisplayName("POST /api/auth/register - Screaming 400 Bad Request on invalid email format")
    void registerWithInvalidEmailFails() {
        Map<String, Object> invalidRequest = Map.of(
                "name", "Bad Email",
                "username", "bad_email_usr",
                "email", "not-an-email",
                "password", "ValidP@ss123"
        );

        given()
                .contentType(ContentType.JSON)
                .body(invalidRequest)
        .when()
                .post("/api/auth/register")
        .then()
                .statusCode(400)
                .body("status", equalTo(400));
    }

    @Test
    @Order(3)
    @DisplayName("POST /api/auth/login - Successfully authenticates user and issues fresh JWT")
    void loginSuccessfully() {
        Map<String, String> loginRequest = Map.of(
                "email", "itest@example.com",
                "password", "SecureP@ssw0rd123!"
        );

        var response = given()
                .contentType(ContentType.JSON)
                .body(loginRequest)
        .when()
                .post("/api/auth/login")
        .then()
                .statusCode(200)
                .body("token", notNullValue())
                .body("email", equalTo("itest@example.com"))
                .extract();

        jwtToken = response.path("token");
        Assertions.assertNotNull(jwtToken);
    }

    @Test
    @Order(4)
    @DisplayName("POST /api/auth/login - Screaming 400 or 401 Bad Request on wrong password")
    void loginWithWrongPasswordFails() {
        Map<String, String> badLogin = Map.of(
                "email", "itest@example.com",
                "password", "IncorrectPassword999!"
        );

        given()
                .contentType(ContentType.JSON)
                .body(badLogin)
        .when()
                .post("/api/auth/login")
        .then()
                .statusCode(anyOf(is(400), is(401)))
                .body("error", notNullValue());
    }

    // ─── 2. SECURITY FILTER CHAIN & SCREAMING ERROR CHECKS ──────────────────

    @Test
    @Order(5)
    @DisplayName("GET /api/categories/global - Screaming 401 Unauthorized when no JWT token provided")
    void categoriesUnauthorizedWithoutToken() {
        given()
        .when()
                .get("/api/categories/global")
        .then()
                .statusCode(401);
    }

    @Test
    @Order(6)
    @DisplayName("GET /api/categories/global - Screaming 401 Unauthorized on malformed JWT Bearer token")
    void categoriesUnauthorizedWithMalformedToken() {
        given()
                .header("Authorization", "Bearer bad.token.here")
        .when()
                .get("/api/categories/global")
        .then()
                .statusCode(401);
    }

    // ─── 3. CATEGORY RETRIEVAL & CREATION ────────────────────────────────────

    @Test
    @Order(7)
    @DisplayName("GET /api/categories/global - Successfully retrieves global categories with valid JWT")
    void getCategoriesAuthorized() {
        var response = given()
                .header("Authorization", "Bearer " + jwtToken)
        .when()
                .get("/api/categories/global")
        .then()
                .statusCode(200)
                .body("$", not(empty()))
                .extract();

        createdCategoryId = ((Number) response.path("[0].id")).longValue();
        Assertions.assertNotNull(createdCategoryId);
    }

    // ─── 4. EXPENSE CRUD & BUSINESS LOGIC ───────────────────────────────────

    @Test
    @Order(8)
    @DisplayName("POST /api/expenses/user/{userId} - Successfully creates a new expense")
    void createExpenseSuccessfully() {
        Map<String, Object> expenseRequest = Map.of(
                "amount", 250.75,
                "description", "Team Lunch Integration Test",
                "expenseDate", LocalDate.now().toString(),
                "categoryId", createdCategoryId
        );

        var response = given()
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(ContentType.JSON)
                .body(expenseRequest)
        .when()
                .post("/api/expenses/user/" + registeredUserId)
        .then()
                .statusCode(201)
                .body("id", notNullValue())
                .body("amount", equalTo(250.75f))
                .body("description", equalTo("Team Lunch Integration Test"))
                .extract();

        createdExpenseId = ((Number) response.path("id")).longValue();
    }

    @Test
    @Order(9)
    @DisplayName("POST /api/expenses/user/{userId} - Screaming 400 Bad Request on negative amount")
    void createExpenseWithNegativeAmountFails() {
        Map<String, Object> invalidExpense = Map.of(
                "amount", -50.0,
                "description", "Negative test",
                "expenseDate", LocalDate.now().toString(),
                "categoryId", createdCategoryId
        );

        given()
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(ContentType.JSON)
                .body(invalidExpense)
        .when()
                .post("/api/expenses/user/" + registeredUserId)
        .then()
                .statusCode(400);
    }

    @Test
    @Order(10)
    @DisplayName("GET /api/expenses/user/{userId} - Retrieves user expenses list containing created item")
    void getUserExpensesSuccessfully() {
        given()
                .header("Authorization", "Bearer " + jwtToken)
        .when()
                .get("/api/expenses/user/" + registeredUserId)
        .then()
                .statusCode(200)
                .body("$", not(empty()))
                .body("find { it.id == " + createdExpenseId + " }.description",
                        equalTo("Team Lunch Integration Test"));
    }

    @Test
    @Order(11)
    @DisplayName("PUT /api/expenses/{id}/user/{userId} - Updates an existing expense")
    void updateExpenseSuccessfully() {
        Map<String, Object> updateRequest = Map.of(
                "amount", 300.00,
                "description", "Updated Team Dinner",
                "expenseDate", LocalDate.now().toString(),
                "categoryId", createdCategoryId
        );

        given()
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(ContentType.JSON)
                .body(updateRequest)
        .when()
                .put("/api/expenses/" + createdExpenseId + "/user/" + registeredUserId)
        .then()
                .statusCode(200)
                .body("amount", equalTo(300.0f))
                .body("description", equalTo("Updated Team Dinner"));
    }

    @Test
    @Order(12)
    @DisplayName("DELETE /api/expenses/{id}/user/{userId} - Deletes an existing expense")
    void deleteExpenseSuccessfully() {
        given()
                .header("Authorization", "Bearer " + jwtToken)
        .when()
                .delete("/api/expenses/" + createdExpenseId + "/user/" + registeredUserId)
        .then()
                .statusCode(204);

        // Verify expense is no longer present
        given()
                .header("Authorization", "Bearer " + jwtToken)
        .when()
                .get("/api/expenses/user/" + registeredUserId)
        .then()
                .statusCode(200)
                .body("find { it.id == " + createdExpenseId + " }", nullValue());
    }

    // ─── 5. USER PROFILE & USERNAME LOOKUP ──────────────────────────────────

    @Test
    @Order(13)
    @DisplayName("GET /api/users/check-username - Returns availability status")
    void checkUsernameAvailability() {
        given()
                .header("Authorization", "Bearer " + jwtToken)
                .queryParam("username", "completely_new_usr_99")
        .when()
                .get("/api/users/check-username")
        .then()
                .statusCode(200)
                .body("available", equalTo(true));
    }

    @Test
    @Order(14)
    @DisplayName("GET /api/users/{userId} - Returns user profile with valid authentication")
    void getUserProfileSuccessfully() {
        given()
                .header("Authorization", "Bearer " + jwtToken)
        .when()
                .get("/api/users/" + registeredUserId)
        .then()
                .statusCode(200)
                .body("id", equalTo(registeredUserId.intValue()))
                .body("email", equalTo("itest@example.com"))
                .body("currency", equalTo("INR"));
    }
}
