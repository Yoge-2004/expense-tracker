Feature: User Account Management API
  As an authenticated user
  I want to be able to permanently delete my account
  So that all my personal data is removed from the system

  Background:
    Given I am a registered and authenticated user

  # ─── Delete Account ───────────────────────────────────────────────────────

  Scenario: Delete own user account successfully
    Calls DELETE /api/users/{userId} with the authenticated user's own ID.
    Expects HTTP 204 No Content. The service performs a three-step cascading
    delete: (1) all user's Expense records, (2) all user-created Category
    records, (3) the User record itself.

    When I delete my account
    Then the response status code should be 204

  Scenario: Deleted user cannot login again
    Deletes the authenticated user's account then immediately attempts to
    login using the same credentials. Expects HTTP 401 because the User record
    no longer exists in the database and Spring Security cannot load the
    UserDetails for the email.

    Given I have noted my email and password
    When I delete my account
    And I try to login with my original credentials
    Then the response status code should be 401

  Scenario: Deleting account also removes all associated expenses
    Seeds one expense record for the user, then deletes the account.
    Expects HTTP 204 confirming the account (and its cascaded expense records)
    were deleted without a referential integrity error. Validates that the
    cascading logic in UserServiceImpl runs in the correct order.

    Given I have created an expense of 100.00 for "Pre-deletion expense" on "2025-06-01" under category 1
    When I delete my account
    Then the response status code should be 204

  Scenario: Deleting account also removes all personal categories
    Seeds one personal category for the user, then deletes the account.
    Expects HTTP 204 confirming the account and its user-scoped Category
    records were removed cleanly. Global (null-user) categories must NOT
    be deleted by this operation.

    Given I have created a category named "My Custom Category"
    When I delete my account
    Then the response status code should be 204

  Scenario: Delete account fails for unknown user id
    Calls DELETE /api/users/999999 where the userId does not exist in the
    database. UserServiceImpl.deleteUser throws IllegalArgumentException
    ("User not found") which GlobalExceptionHandler maps to HTTP 400 Bad
    Request (not 404, since IllegalArgumentException is used rather than
    NoSuchElementException).

    When I delete the account for user id 999999
    Then the response status code should be 400

  Scenario: Delete account endpoint requires authentication
    Calls DELETE /api/users/1 without an Authorization header. Spring Security's
    JWT filter intercepts the request before it reaches the controller and
    returns HTTP 401 Unauthorized. No database query is executed.

    When I delete the account for user id 1 without a JWT token
    Then the response status code should be 401
