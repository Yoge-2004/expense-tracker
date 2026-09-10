Feature: Expense Management
  As an authenticated user
  I want to create, read, update, and delete expenses
  So that I can track my spending

  Background:
    Given the application is running with a test database
    And I am logged in as user "expenseuser@test.com" with password "SecurePass123"

  Scenario: Create a new expense
    Given the category "Food" exists for my user
    When I create an expense with amount 50.00 description "Lunch" date "2026-09-10" and category "Food"
    Then the response status should be 201
    And the expense should be saved with amount 50.00
    And the expense should have description "Lunch"

  Scenario: Create an expense with a negative amount fails
    Given the category "Transport" exists for my user
    When I create an expense with amount -25.00 description "Invalid" date "2026-09-10" and category "Transport"
    Then the response status should be 400

  Scenario: List all expenses for my user
    Given I have 3 expenses
    When I request all expenses for my user
    Then the response status should be 200
    And the response should contain at least 3 expenses

  Scenario: Update an existing expense
    Given I have an expense with amount 100.00 and description "Old description"
    When I update that expense with amount 150.00 and description "Updated description"
    Then the response status should be 200
    And the expense should be saved with amount 150.00
    And the expense should have description "Updated description"

  Scenario: Delete an expense
    Given I have an expense with amount 30.00 and description "To delete"
    When I delete that expense
    Then the response status should be 204
    And the expense should no longer exist

  Scenario: Cannot update another user's expense
    Given another user has an expense with id 999
    When I try to update expense 999
    Then the response status should be 400

  Scenario: Setting a budget for a category
    Given the category "Entertainment" exists for my user
    When I set a budget of 500.00 for category "Entertainment"
    Then the response status should be 200
    And the response message should contain "Budget set successfully"
