Feature: Category Management API
  As an authenticated user
  I want to manage my own expense categories and view global ones
  So that I can organise expenses under meaningful labels

  Background:
    Given I am a registered and authenticated user

  # ─── Create Category ──────────────────────────────────────────────────────

  Scenario: Create a personal category successfully
    Creates a new user-scoped category named "Petrol" for the authenticated user.
    Expects HTTP 201 with the created category returned including a generated id
    and the exact name provided. The category is only visible to this user and
    will not appear in the global category list.

    When I create a category named "Petrol"
    Then the response status code should be 201
    And the response should contain field "name" with value "Petrol"
    And the response should contain a category id

  Scenario: Create another personal category with a different name
    Creates a second user-scoped category named "Medicines" for the same user.
    Verifies that multiple unique categories can be created per user and that
    each returns the correct name in the response body.

    When I create a category named "Medicines"
    Then the response status code should be 201
    And the response should contain field "name" with value "Medicines"

  Scenario: Create category fails when name is blank
    Submits a category creation request with an empty string as the name.
    The "@NotBlank" constraint on CategoryRequest.name triggers bean validation
    failure before the service layer is reached, returning HTTP 400.

    When I create a category with a blank name
    Then the response status code should be 400

  Scenario: Create category fails for unknown user id
    Attempts to create a category under userId 999999 which does not exist.
    The controller calls userService.findById and throws IllegalArgumentException
    ("User not found") which GlobalExceptionHandler maps to HTTP 400.

    When I create a category named "Ghost Category" for user id 999999
    Then the response status code should be 400

  # ─── Get User Categories ──────────────────────────────────────────────────

  Scenario: Retrieve all personal categories for the authenticated user
    Seeds two personal categories ("Petrol" and "Medicines") then calls
    GET /api/categories/user/{userId}. Verifies that both categories are
    present in the response list by name. Global system categories are NOT
    included in this endpoint's response.

    Given I have created a category named "Petrol"
    And I have created a category named "Medicines"
    When I get all categories for my user
    Then the response status code should be 200
    And the response should contain at least 2 categories
    And the category list should include "Petrol"
    And the category list should include "Medicines"

  Scenario: New user has no personal categories
    Calls GET /api/categories/user/{userId} for a user who has not yet created
    any personal categories. Expects HTTP 200 with an empty JSON array [].
    Global categories are intentionally excluded from this endpoint.

    When I get all categories for my user
    Then the response status code should be 200
    And the response should be an empty list

  Scenario: Get user categories fails for unknown user id
    Calls GET /api/categories/user/999999 where userId does not exist.
    The controller throws IllegalArgumentException("User not found") which
    GlobalExceptionHandler maps to HTTP 400 Bad Request.

    When I get categories for user id 999999
    Then the response status code should be 400

  # ─── Get Global Categories ────────────────────────────────────────────────

  Scenario: Retrieve global categories returns the seeded system categories
    Calls GET /api/categories/global and verifies that the response contains
    the system categories seeded by data.sql at application startup ("Food"
    and "Transport" at minimum). These categories have a null user_id and are
    shared across all users for expense classification.

    When I get all global categories
    Then the response status code should be 200
    And the global category list should include "Food"
    And the global category list should include "Transport"

  Scenario: Global categories endpoint is accessible without owning a user id
    Verifies that GET /api/categories/global does not require a userId path
    variable and returns a non-empty list. Any authenticated user can call
    this endpoint regardless of their own category setup.

    When I get all global categories
    Then the response status code should be 200
    And the response should not be empty
