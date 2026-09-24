Feature: Category Management
  As an authenticated user
  I want to manage expense categories
  So that I can classify my transactions effectively

  Background:
    Given the application is running with a test database
    And I am logged in as user "categoryuser@test.com" with password "SecurePass123"

  Scenario: Create a custom category
    Given I do not have a category named "Online Books"
    When I create a category named "Online Books"
    Then the response status should be 201
    And the category should have name "Online Books"

  Scenario: Create a category with blank name fails
    When I create a category named ""
    Then the response status should be 400

  Scenario: Prevent duplicate category name for the same user
    Given I have a category named "Fitness"
    When I create a category named "Fitness"
    Then the response status should be 400

  Scenario: List global categories
    When I request all global categories
    Then the response status should be 200
    And the response should contain global category "Food"
    And the response should contain global category "Transport"

  Scenario: List personal categories for user
    Given I have a category named "Hobbies"
    When I request all personal categories
    Then the response status should be 200
    And the response should contain category "Hobbies"

  Scenario: Delete an unused personal category
    Given I have a category named "Temporary Category"
    When I delete that category
    Then the response status should be 204
    And that category should no longer exist

  Scenario: Prevent deleting category currently associated with an expense
    Given I have a category named "Groceries Custom"
    And I have an expense of 45.50 under category "Groceries Custom"
    When I delete that category
    Then the response status should be 409
