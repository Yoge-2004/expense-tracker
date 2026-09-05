Feature: Budget Management API
  As an authenticated user
  I want to set monthly spending limits per category
  So that I can monitor whether I am staying within my budget

  Background:
    Given I am a registered and authenticated user

  # ─── Set Budget ──────────────────────────────────────────────────────────

  Scenario: Set a budget for a category successfully
    Creates a monthly budget of ₹3000 for the global "Food" category (id=1).
    Expects HTTP 200 with {"message":"Budget set successfully"}. If a budget
    for this user+category combination already exists it is updated; otherwise
    a new Budget record is inserted.

    When I set a budget of 3000.00 for category id 1
    Then the response status code should be 200
    And the response should contain message "Budget set successfully"

  Scenario: Update an existing budget for the same category
    First sets a ₹3000 budget for Food, then updates it to ₹4500 for the same
    user and category. Verifies that the second call succeeds with HTTP 200.
    Internally, BudgetRepository.findByUserAndCategoryId finds the existing
    record and overwrites the limitAmount rather than creating a duplicate.

    Given I have set a budget of 3000.00 for category id 1
    When I set a budget of 4500.00 for category id 1
    Then the response status code should be 200
    And the response should contain message "Budget set successfully"

  Scenario: Set budget fails when limit amount is zero
    Attempts to set a budget with limitAmount = 0. The controller explicitly
    checks if limitAmount <= 0 before calling the repository and returns
    HTTP 400 with {"error":"Budget limit must be a positive number"}.

    When I set a budget of 0 for category id 1
    Then the response status code should be 400
    And the response should contain error message "Budget limit must be a positive number"

  Scenario: Set budget fails when limit amount is negative
    Attempts to set a budget with a negative limitAmount (-500). The positivity
    check (limitAmount.compareTo(ZERO) <= 0) in the controller catches this and
    returns HTTP 400 with {"error":"Budget limit must be a positive number"}
    before any database interaction occurs.

    When I set a budget of -500 for category id 1
    Then the response status code should be 400
    And the response should contain error message "Budget limit must be a positive number"

  Scenario: Set budget fails for unknown category id
    Attempts to set a budget for a categoryId (999999) that does not exist in
    the database. The controller calls categoryRepository.findById and throws
    IllegalArgumentException("Category not found") which maps to HTTP 400.

    When I set a budget of 1000 for category id 999999
    Then the response status code should be 400

  Scenario: Set budget fails for unknown user id
    Attempts to set a budget using a userId (999999) that does not match the
    authenticated user. IDOR security validation rejects the request with HTTP 403.

    When I set a budget of 1000 for category id 1 with user id 999999
    Then the response status code should be 403

  # ─── Budget Status ───────────────────────────────────────────────────────

  Scenario: Get budget status after setting budgets and recording expenses
    Sets a ₹3000 budget for Food then records a ₹1500 grocery expense in the
    same category. Calls GET /api/expenses/budget/status/user/{id} and verifies
    the response includes a "Food" entry with limit=3000, spent>0, and the
    correct percentage. Only expenses dated within the current calendar month
    are counted in the "spent" calculation.

    Given I have set a budget of 3000.00 for category id 1
    And I have created an expense of 1500.00 for "Grocery run" on "2025-06-15" under category 1
    When I get the budget status for my user
    Then the response status code should be 200
    And the budget status should contain category "Food"
    And the budget status for "Food" should have limit 3000.00
    And the budget status for "Food" should have spent greater than 0

  Scenario: Get budget status shows no entries when no budgets are configured
    Calls the budget status endpoint for a user who has not configured any
    budgets. Expects HTTP 200 with an empty JSON array []. An empty list is
    correct — it does not indicate an error.

    When I get the budget status for my user
    Then the response status code should be 200
    And the response should be an empty list

  Scenario: Budget percentage exceeds 100 when spending is over limit
    Sets a tight ₹500 budget for Food then records a ₹700 expense in the same
    category, intentionally exceeding the limit. Verifies that the percentage
    field in the budget status is greater than 100, indicating an over-budget
    state. The API does not block expenses once a budget is exceeded.

    Given I have set a budget of 500.00 for category id 1
    And I have created an expense of 700.00 for "Over-budget groceries" on "2025-06-15" under category 1
    When I get the budget status for my user
    Then the response status code should be 200
    And the budget status for "Food" should have percentage greater than 100

  Scenario: Delete budget limit successfully
    Given I have set a budget of 1000.00 for category id 1
    When I send a DELETE request to delete budget limit for category 1
    Then the response status code should be 200
    And the response should contain message "Budget limit deleted successfully"
