Feature: Income and Cash Flow Management
  As an authenticated user
  I want to create, view, update, and delete my income records
  And monitor my monthly net cash flow and savings rate

  Background:
    Given the application is running with a test database
    And I am logged in as user "incomeuser@test.com" with password "SecurePass123"

  Scenario: Create a new income record
    When I create an income with amount 5000.00 source "Monthly Salary" description "Full-time salary" date "2026-09-01"
    Then the response status should be 201
    And the income should be saved with amount 5000.00
    And the income should have source "Monthly Salary"

  Scenario: Create an income with non-positive amount fails
    When I create an income with amount -500.00 source "Invalid Income" description "Negative amount" date "2026-09-01"
    Then the response status should be 400

  Scenario: Create an income with blank source fails
    When I create an income with amount 500.00 source "   " description "Blank source" date "2026-09-01"
    Then the response status should be 400

  Scenario: List all income records for my user
    Given I have 2 income records
    When I request all incomes for my user
    Then the response status should be 200
    And the response should contain at least 2 incomes

  Scenario: Update an existing income record
    Given I have an income with amount 1200.00 and source "Freelance Old"
    When I update that income with amount 1500.00 and source "Freelance New"
    Then the response status should be 200
    And the income should be saved with amount 1500.00
    And the income should have source "Freelance New"

  Scenario: Delete an income record
    Given I have an income with amount 300.00 and source "Consulting"
    When I delete that income
    Then the response status should be 204
    And the income should no longer exist

  Scenario: Retrieve monthly cash flow summary
    Given I have an income with amount 4000.00 and source "Primary Job"
    When I request the monthly cash flow summary for year 2026 and month 9
    Then the response status should be 200
    And the cash flow total income should be at least 4000.00
