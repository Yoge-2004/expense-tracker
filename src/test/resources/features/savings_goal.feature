Feature: Savings Goal Management
  As an authenticated user
  I want to create, fund, track, and complete savings goals
  So that I can achieve my financial targets

  Background:
    Given the application is running with a test database
    And I am logged in as user "savingsuser@test.com" with password "SecurePass123"

  Scenario: Create a new savings goal
    When I create a savings goal named "Emergency Fund" with target amount 10000.00
    Then the response status should be 201
    And the savings goal should have name "Emergency Fund"
    And the savings goal should have target amount 10000.00
    And the savings goal should have current amount 0.00

  Scenario: Create a savings goal with non-positive target fails
    When I create a savings goal named "Invalid Target" with target amount -100.00
    Then the response status should be 400

  Scenario: Deposit funds towards a savings goal
    Given I have a savings goal named "Laptop Fund" with target amount 1000.00 and current amount 200.00
    When I deposit 300.00 towards my savings goal
    Then the response status should be 200
    And the savings goal should have current amount 500.00
    And the savings goal progress percentage should be 50.0

  Scenario: Deposit funds auto-completes savings goal when target reached
    Given I have a savings goal named "Trip Fund" with target amount 500.00 and current amount 400.00
    When I deposit 150.00 towards my savings goal
    Then the response status should be 200
    And the savings goal should have current amount 550.00
    And the savings goal status should be "COMPLETED"

  Scenario: Delete a savings goal
    Given I have a savings goal named "Old Goal" with target amount 500.00 and current amount 0.00
    When I delete that savings goal
    Then the response status should be 204
    And the savings goal should no longer exist
