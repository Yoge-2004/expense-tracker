Feature: Recurring Expense (Subscription) API
  As an authenticated user
  I want to configure, view, update, and cancel recurring monthly expenses
  So that subscription payments are automatically tracked

  Background:
    Given I am a registered and authenticated user

  # ─── Add Recurring Expense ────────────────────────────────────────────────

  Scenario: Register a new monthly subscription successfully
    Registers a ₹649 Netflix Premium subscription starting 2025-06-01 under
    the Entertainment category (id=4). Expects HTTP 200 with the success
    message. Internally creates a RecurringExpense record with frequency=MONTHLY
    and nextDueDate set to one month after the start date (2025-07-01).

    When I add a recurring expense of 649.00 for "Netflix Premium" starting "2025-06-01" under category 4
    Then the response status code should be 200
    And the response should contain message "Recurring Expense Setup Successfully"

  Scenario: Registering a subscription also creates the first expense immediately
    Verifies that adding a recurring expense not only saves a RecurringExpense
    record but also immediately creates an Expense record for the first billing
    cycle. After adding the Spotify subscription, the expense list for the user
    must contain "Spotify" as a description.

    When I add a recurring expense of 119.00 for "Spotify" starting "2025-06-05" under category 4
    And I get all expenses for my user
    Then the response body should contain "Spotify"

  Scenario: Add recurring expense fails for unknown category id
    Attempts to register a subscription with categoryId 999999 which does not
    exist. The controller calls categoryRepository.findById and throws
    IllegalArgumentException("Category not found") which maps to HTTP 400.

    When I add a recurring expense of 499.00 for "Unknown App" starting "2025-06-01" under category 999999
    Then the response status code should be 400

  Scenario: Add recurring expense fails for unknown user id
    Attempts to register a subscription under userId 999999 which does not exist.
    The controller calls userService.findById and throws IllegalArgumentException
    ("User not found") which GlobalExceptionHandler maps to HTTP 400.

    When I add a recurring expense of 199.00 for "App Sub" starting "2025-06-01" under category 4 for user id 999999
    Then the response status code should be 400

  # ─── Get Subscriptions ────────────────────────────────────────────────────

  Scenario: Retrieve all active subscriptions for the authenticated user
    Seeds two subscriptions (Netflix Premium and Spotify) then calls
    GET /api/expenses/recurring/user/{userId}. Verifies both descriptions
    appear in the returned list. Only active (non-cancelled) subscriptions
    are returned.

    Given I have added a recurring expense of 649.00 for "Netflix Premium" starting "2025-06-01" under category 4
    And I have added a recurring expense of 119.00 for "Spotify" starting "2025-06-05" under category 4
    When I get all subscriptions for my user
    Then the response status code should be 200
    And the subscriptions list should contain "Netflix Premium"
    And the subscriptions list should contain "Spotify"

  Scenario: Get subscriptions returns empty list when no subscriptions exist
    Calls GET /api/expenses/recurring/user/{userId} for a user who has not
    registered any recurring expenses. Expects HTTP 200 with an empty JSON
    array []. This is a valid state for new users.

    When I get all subscriptions for my user
    Then the response status code should be 200
    And the response should be an empty list

  Scenario: Each subscription entry contains required fields
    Seeds one subscription then retrieves the subscription list. Verifies that
    every entry in the list contains all 6 required fields: id, description,
    amount, nextDueDate, frequency, and categoryName. None of these fields
    may be null in the response.

    Given I have added a recurring expense of 649.00 for "Netflix Premium" starting "2025-06-01" under category 4
    When I get all subscriptions for my user
    Then the response status code should be 200
    And each subscription should contain fields "id", "description", "amount", "nextDueDate", "frequency", "categoryName"

  # ─── Update Subscription ─────────────────────────────────────────────────

  Scenario: Update a subscription amount and description
    Seeds a "Netflix Standard" subscription then updates it to a higher-tier
    plan by changing the amount to ₹799 and the description to
    "Netflix Premium (4K)". Expects HTTP 200 with the success message.
    Only the provided keys are updated; unspecified fields remain unchanged.

    Given I have added a recurring expense of 649.00 for "Netflix Standard" starting "2025-06-01" under category 4
    When I update the subscription with amount 799.00 and description "Netflix Premium (4K)"
    Then the response status code should be 200
    And the response should contain message "Subscription updated successfully"

  Scenario: Update subscription next due date
    Seeds a subscription then reschedules it by updating only the nextDueDate
    field to 2025-08-01. Expects HTTP 200 with the success message. Verifies
    that a partial update (only nextDueDate) works without affecting amount
    or description.

    Given I have added a recurring expense of 649.00 for "Netflix" starting "2025-06-01" under category 4
    When I update the subscription next due date to "2025-08-01"
    Then the response status code should be 200
    And the response should contain message "Subscription updated successfully"

  Scenario: Update subscription fails for unknown subscription id
    Attempts to update a RecurringExpense with id 999999 which does not exist.
    The controller calls recurringRepository.findById and throws
    IllegalArgumentException("Subscription not found") which maps to HTTP 400.

    When I update a non-existent subscription id 999999 with amount 500
    Then the response status code should be 400

  # ─── Cancel Subscription ─────────────────────────────────────────────────

  Scenario: Cancel a subscription successfully
    Seeds a subscription marked "To Be Cancelled" then calls
    DELETE /api/expenses/recurring/{recId}. Expects HTTP 200 with the
    cancellation message. The RecurringExpense record is permanently deleted.

    Given I have added a recurring expense of 649.00 for "To Be Cancelled" starting "2025-06-01" under category 4
    When I cancel the subscription
    Then the response status code should be 200
    And the response should contain message "Subscription cancelled successfully"

  Scenario: Cancelled subscription no longer appears in the subscription list
    Seeds a "Gone Service" subscription, cancels it, then re-fetches the
    subscription list. Verifies that "Gone Service" no longer appears in the
    response body, confirming the RecurringExpense record was fully removed.

    Given I have added a recurring expense of 649.00 for "Gone Service" starting "2025-06-01" under category 4
    When I cancel the subscription
    And I get all subscriptions for my user
    Then the response body should not contain "Gone Service"

  Scenario: Cancelling a subscription does not delete historical expense records
    Seeds a "Keep History" subscription (which also creates an immediate Expense
    record), then cancels the subscription. Verifies that the original Expense
    record still appears in the user's expense list. Cancellation only removes
    the recurring schedule — past charges are preserved.

    Given I have added a recurring expense of 649.00 for "Keep History" starting "2025-06-01" under category 4
    When I cancel the subscription
    And I get all expenses for my user
    Then the response body should contain "Keep History"
