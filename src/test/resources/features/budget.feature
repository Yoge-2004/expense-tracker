Feature: Category Budget and Spending Limit Management
  As an authenticated user
  I want to establish spending limits for expense categories across customizable periods
  And track my real-time spending utilization against these ceilings

  Background:
    Given the application is running with a test database
    And I am logged in as user "budgetuser@test.com" with password "SecurePass123"

  Scenario: Create a monthly budget limit for a category
    Given I have a category named "Groceries Budget"
    When I set a budget of 450.00 for category "Groceries Budget" with period "MONTHLY"
    Then the response status should be 200
    And the budget response message should be "Budget set successfully"

  Scenario: Set budget with negative or zero limit fails
    Given I have a category named "Negative Budget Cat"
    When I set a budget of -100.00 for category "Negative Budget Cat" with period "MONTHLY"
    Then the response status should be 400

  Scenario: Update existing category budget limit
    Given I have a category named "Entertainment Budget"
    And I have a budget of 200.00 for category "Entertainment Budget" with period "MONTHLY"
    When I set a budget of 350.00 for category "Entertainment Budget" with period "MONTHLY"
    Then the response status should be 200
    When I request the budget status for my user
    Then the budget for category "Entertainment Budget" should have limit 350.00

  Scenario: Track budget utilization when expenses occur
    Given I have a category named "Dining Out"
    And I have a budget of 500.00 for category "Dining Out" with period "MONTHLY"
    And I record an expense of 150.00 under category "Dining Out" on today's date
    When I request the budget status for my user
    Then the response status should be 200
    And the budget for category "Dining Out" should have spent at least 150.00
    And the budget for category "Dining Out" should have percentage utilization of at least 30.0

  Scenario: Delete category budget limit
    Given I have a category named "Travel Budget"
    And I have a budget of 800.00 for category "Travel Budget" with period "MONTHLY"
    When I delete the budget for category "Travel Budget"
    Then the response status should be 200
    When I request the budget status for my user
    Then the budget status should not contain category "Travel Budget"

  Scenario: Set a custom interval budget limit
    Given I have a category named "Project Supplies"
    When I set a custom budget of 1200.00 for category "Project Supplies" with interval 45 days
    Then the response status should be 200
    When I request the budget status for my user
    Then the budget for category "Project Supplies" should have period "CUSTOM"
