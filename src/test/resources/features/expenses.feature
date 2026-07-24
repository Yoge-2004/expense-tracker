Feature: Expense Management API
  As an authenticated user
  I want to create, view, update, and delete expense records
  So that I can track where my money is going

  Background:
    Given I am a registered and authenticated user

  # ─── Create Expense ───────────────────────────────────────────────────────

  Scenario: Create a new expense successfully
    Creates a valid expense record for the authenticated user with a positive
    amount, a non-blank description, a valid ISO-8601 date, and a categoryId
    that references one of the globally seeded categories (Food = id 1).
    Expects HTTP 201 with the saved expense returned including a generated id.

    When I create an expense with amount 199.99, description "Lunch at Saravana Bhavan", date "2025-06-15", and categoryId 1
    Then the response status code should be 201
    And the response should contain field "amount" with value "199.99"
    And the response should contain field "description" with value "Lunch at Saravana Bhavan"
    And the response should contain an expense id

  Scenario: Create expense fails when amount is zero
    Submits an expense with amount = 0. The "@Positive" constraint on
    ExpenseRequest.amount rejects zero values, triggering bean validation
    and returning HTTP 400 before the service layer is reached.

    When I create an expense with amount 0, description "Free lunch", date "2025-06-15", and categoryId 1
    Then the response status code should be 400

  Scenario: Create expense fails when amount is negative
    Submits an expense with a negative amount (-500). The "@Positive" constraint
    on ExpenseRequest.amount rejects negative values, triggering bean validation
    and returning HTTP 400.

    When I create an expense with amount -500, description "Negative test", date "2025-06-15", and categoryId 1
    Then the response status code should be 400

  Scenario: Create expense fails when date is missing
    Submits an expense with the expenseDate field omitted entirely. The "@NotNull"
    constraint on ExpenseRequest.expenseDate triggers bean validation failure
    and returns HTTP 400.

    When I create an expense without a date with amount 100, description "No date", and categoryId 1
    Then the response status code should be 400

  Scenario: Create expense fails when categoryId is missing
    Submits an expense with the categoryId field omitted. The "@NotNull" constraint
    on ExpenseRequest.categoryId triggers bean validation failure and returns
    HTTP 400. A category is mandatory for every expense record.

    When I create an expense without a categoryId with amount 100, description "No category", and date "2025-06-15"
    Then the response status code should be 400

  Scenario: Create expense fails when request is unauthenticated
    Submits a create-expense request with no Authorization header. Spring
    Security's JWT filter rejects the request before it reaches the controller
    and returns HTTP 401 Unauthorized.

    When I create an expense without a JWT token with amount 100, description "Unauthenticated", date "2025-06-15", and categoryId 1
    Then the response status code should be 401

  # ─── Get Expenses ─────────────────────────────────────────────────────────

  Scenario: Retrieve all expenses for the authenticated user
    Seeds two expense records under different global categories (Food and
    Utilities) then calls GET /api/expenses/user/{id}. Verifies that both
    records are returned and the list contains at least 2 items.

    Given I have created an expense of 299.00 for "Grocery shopping" on "2025-06-10" under category 1
    And I have created an expense of 599.00 for "Electric bill" on "2025-06-12" under category 3
    When I get all expenses for my user
    Then the response status code should be 200
    And the response should contain at least 2 expenses

  Scenario: Retrieve expenses returns empty list for new user
    Calls GET /api/expenses/user/{id} on a freshly created user who has not
    yet recorded any expenses. Expects HTTP 200 with an empty JSON array [].

    When I get all expenses for my user
    Then the response status code should be 200
    And the response should be an empty list

  Scenario: Retrieve expenses fails for unknown user id
    Calls GET /api/expenses/user/999999 with a userId that does not exist in
    the database. The controller throws IllegalArgumentException("User not found")
    which GlobalExceptionHandler maps to HTTP 400 Bad Request.

    When I get all expenses for user id 999999
    Then the response status code should be 400

  # ─── Update Expense ───────────────────────────────────────────────────────

  Scenario: Update an existing expense successfully
    Creates an expense then updates its amount and description via
    PUT /api/expenses/{expenseId}/user/{userId}. Verifies that the response
    reflects the new description. Ownership is validated server-side.

    Given I have created an expense of 150.00 for "Auto fare" on "2025-06-01" under category 2
    When I update the expense with amount 175.00, description "Auto fare (surge)", date "2025-06-01", and categoryId 2
    Then the response status code should be 200
    And the response should contain field "description" with value "Auto fare (surge)"

  Scenario: Update expense fails for non-existent expense
    Attempts to update expense id 999999 which does not exist in the database.
    ExpenseServiceImpl.updateExpense throws RuntimeException("Expense not found")
    which falls through to the generic "@ExceptionHandler(Exception.class)" and
    returns HTTP 500 Internal Server Error.

    When I update a non-existent expense id 999999 with amount 100 and description "Ghost expense"
    Then the response status code should be 500

  # ─── Delete Expense ───────────────────────────────────────────────────────

  Scenario: Delete an expense successfully
    Creates an expense then deletes it via DELETE /api/expenses/{id}/user/{userId}.
    Expects HTTP 204 No Content. The service validates that the expense belongs
    to the requesting user before deletion.

    Given I have created an expense of 250.00 for "Movie tickets" on "2025-06-05" under category 4
    When I delete the created expense
    Then the response status code should be 204

  Scenario: Deleted expense is no longer retrievable
    Creates an expense, deletes it, then re-fetches all expenses for the user.
    Verifies that the deleted expense's description no longer appears in the
    response body, confirming the record was fully removed from the database.

    Given I have created an expense of 80.00 for "Tea and snacks" on "2025-06-05" under category 1
    When I delete the created expense
    And I get all expenses for my user
    Then the response body should not contain "Tea and snacks"

  Scenario: Delete expense fails for unknown user id
    Attempts to delete an existing expense but supplies a non-existent userId
    in the path. The controller throws IllegalArgumentException("User not found")
    which maps to HTTP 400. The expense is NOT deleted.

    Given I have created an expense of 100.00 for "To delete" on "2025-06-06" under category 1
    When I delete the expense for unknown user id 999999
    Then the response status code should be 400
