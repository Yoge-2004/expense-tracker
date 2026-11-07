Feature: End-to-End Personal Financial Management Lifecycle
  As a new user
  I want to register, record income, establish budgets, track expenses, and allocate savings
  So that I have full oversight and control over my financial health

  Background:
    Given the application is running with a test database
    And I am logged in as user "financialhero@test.com" with password "SecurePass123"

  Scenario: Complete monthly financial lifecycle from income to savings and report generation
    Given I have an income with amount 5000.00 and source "Software Engineering"
    And the category "Food & Dining" exists for my user
    And I have a budget of 1000.00 for category "Food & Dining" with period "MONTHLY"
    And I create a savings goal named "Down Payment" with target amount 10000.00
    When I record an expense of 300.00 under category "Food & Dining" on today's date
    And I record an expense of 200.00 under category "Food & Dining" on today's date
    And I deposit 1500.00 towards my savings goal
    When I request the budget status for my user
    Then the response status should be 200
    And the budget for category "Food & Dining" should have spent 500.00
    And the budget for category "Food & Dining" should have percentage utilization of 50.0
    When I request the monthly cash flow summary for year 2026 and month 9
    Then the response status should be 200
    And the cash flow total income should be 5000.00
